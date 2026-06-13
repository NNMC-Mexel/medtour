/**
 * Appointment controller с ownership-фильтрацией.
 * - Patient видит только свои appointments
 * - Doctor видит только свои appointments
 * - Admin видит всё
 */
import { factories } from '@strapi/strapi';
import { userCanAccessMedicalCase } from '../../../utils/medtour-access';

// Kazakhstan is UTC+5 with no DST (fixed offset, IANA: Asia/Almaty)
const KZ_OFFSET_MS = 5 * 60 * 60 * 1000;
const KZ_OFFSET_MIN = 5 * 60;

// ── Slot mutex: prevents two concurrent creates for the same doctor+time ──
const slotLocks = new Map<string, Promise<void>>();

/**
 * Strapi v5: creating a published appointment requires all relation targets to
 * also have a published version.  Medical cases may have been created as drafts
 * (e.g. via the admin panel) and therefore lack a published row.  This helper
 * tries every available Document-Service method to create/promote the published
 * version before the appointment is saved.
 */
async function ensureMedicalCasePublished(strapi: any, documentId: string): Promise<void> {
  const uid = 'api::medical-case.medical-case';
  try {
    // Check whether a published version already exists
    const published = await strapi.documents(uid).findOne({
      documentId,
      status: 'published',
    });
    if (published) return; // already published — nothing to do
  } catch {
    // findOne may not support status param in some Strapi versions; fall through
  }

  // Attempt 1: Document Service publish() — works when a draft exists
  try {
    await (strapi.documents(uid) as any).publish({ documentId });
    strapi.log.info(`ensureMedicalCasePublished: published case ${documentId} via publish()`);
    return;
  } catch (e1: any) {
    strapi.log.warn(`ensureMedicalCasePublished: publish() failed for ${documentId}: ${e1?.message}`);
  }

  // Attempt 2: update() with status:'published' — works when a published row exists
  try {
    await strapi.documents(uid).update({
      documentId,
      data: {},
      status: 'published',
    });
    strapi.log.info(`ensureMedicalCasePublished: published case ${documentId} via update()`);
    return;
  } catch (e2: any) {
    strapi.log.warn(`ensureMedicalCasePublished: update(published) failed for ${documentId}: ${e2?.message}`);
  }

  // Attempt 3: directly set publishedAt on the draft row via db.query
  try {
    const rows = await strapi.db.query(uid).findMany({
      where: { documentId },
      limit: 1,
    });
    if (rows.length > 0 && rows[0].publishedAt === null) {
      await strapi.db.query(uid).update({
        where: { documentId },
        data: { publishedAt: new Date() },
      });
      strapi.log.info(`ensureMedicalCasePublished: published case ${documentId} via db.query`);
    }
  } catch (e3: any) {
    strapi.log.warn(`ensureMedicalCasePublished: db.query fallback failed for ${documentId}: ${e3?.message}`);
  }
}

function withSlotLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = slotLocks.get(key) || Promise.resolve();
  const next = prev.then(fn, fn); // run fn after previous finishes (even if it threw)
  // Store the void chain so the next caller can wait for us.
  // IMPORTANT: capture voidNext in a variable — every .then() call creates a
  // NEW Promise object, so comparing slotLocks.get(key) === next.then(...)
  // inside finally() would always be false (different object reference) and
  // the key would never be deleted (memory leak).
  const voidNext = next.then(() => {}, () => {});
  slotLocks.set(key, voidNext);
  next.finally(() => {
    if (slotLocks.get(key) === voidNext) {
      slotLocks.delete(key);
    }
  });
  return next;
}

export default factories.createCoreController('api::appointment.appointment', () => ({
  async find(ctx) {
    const user = ctx.state.user;
    // API Token requests (from signaling server) have ctx.state.auth.strategy === 'api-token'
    const isApiToken = ctx.state.auth?.strategy?.name === 'api-token';
    if (!user && !isApiToken) return ctx.forbidden('Not authenticated');

    const isAdmin = isApiToken || user?.role?.type === 'admin' || user?.userRole === 'admin';
    const populate = {
      doctor: { populate: ['specialization', 'photo'] },
      patient: { fields: ['id', 'fullName'] },
      medical_case: true,
    } as any;
    const sort = (ctx.query?.sort as any) || ['dateTime:desc'];

    // Parse filters from query params
    const queryFilters = ctx.query?.filters as any;
    const roomIdFilter = queryFilters?.roomId?.$eq;

    // Build additional filters (passed through from query)
    let additionalFilters: any = {};
    if (roomIdFilter) {
      additionalFilters.roomId = roomIdFilter;
    }

    // Apply dateTime range filter (used by getBookedSlots to check slot availability)
    const dateTimeGte = queryFilters?.dateTime?.$gte;
    const dateTimeLte = queryFilters?.dateTime?.$lte;
    if (dateTimeGte || dateTimeLte) {
      additionalFilters.dateTime = {};
      if (dateTimeGte) additionalFilters.dateTime.$gte = dateTimeGte;
      if (dateTimeLte) additionalFilters.dateTime.$lte = dateTimeLte;
    }

    // Apply statuse (ne) filter
    const statuseNe = queryFilters?.statuse?.$ne;
    if (statuseNe) {
      additionalFilters.statuse = { $ne: statuseNe };
    }

    // Apply doctor filter (so patients only see bookings for the requested doctor)
    const doctorIdFilter = queryFilters?.doctor?.id?.$eq;
    if (doctorIdFilter) {
      additionalFilters.doctor = { id: doctorIdFilter };
    }

    if (!isAdmin) {
      const isDoctor = user.role?.type === 'doctor' || user.userRole === 'doctor';

      if (isDoctor) {
        // Находим doctor запись по users_permissions_user (id)
        const doctorRecord = await strapi
          .query('api::doctor.doctor')
          .findOne({ where: { users_permissions_user: user.id } });

        if (!doctorRecord?.documentId) {
          return { data: [], meta: { pagination: { page: 1, pageSize: 0, pageCount: 0, total: 0 } } };
        }

        // Use ONLY documentId — avoids IDOR via numeric id cross-contamination
        const data = await strapi.documents('api::appointment.appointment').findMany({
          filters: { doctor: { documentId: doctorRecord.documentId }, ...additionalFilters },
          sort,
          populate,
        });
        return {
          data,
          meta: { pagination: { page: 1, pageSize: data.length, pageCount: 1, total: data.length } },
        };
      } else {
        // Фильтруем по patient (users-permissions user) — только по documentId
        const patientDocId = user.documentId;
        if (!patientDocId) {
          return { data: [], meta: { pagination: { page: 1, pageSize: 0, pageCount: 0, total: 0 } } };
        }
        const data = await strapi.documents('api::appointment.appointment').findMany({
          filters: { patient: { documentId: patientDocId }, ...additionalFilters },
          sort,
          populate,
        });
        return {
          data,
          meta: { pagination: { page: 1, pageSize: data.length, pageCount: 1, total: data.length } },
        };
      }
    }

    const data = await strapi.documents('api::appointment.appointment').findMany({
      filters: additionalFilters,
      sort,
      populate,
    });

    return {
      data,
      meta: {
        pagination: {
          page: 1,
          pageSize: data.length,
          pageCount: 1,
          total: data.length,
        },
      },
    };
  },

  async findOne(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');

    const { id } = ctx.params;
    const populate = {
      doctor: { populate: ['specialization', 'photo'] },
      patient: { fields: ['id', 'fullName'] },
      medical_documents: { populate: ['file'] },
      medical_case: true,
    } as any;

    const appointment = await strapi.documents('api::appointment.appointment').findOne({
      documentId: id,
      populate,
    });

    if (!appointment) {
      return ctx.notFound('Appointment not found');
    }

    return { data: appointment };
  },

  async create(ctx) {
    const user = ctx.state.user;
    // Requests from the signaling server arrive with an API token (no user session).
    // Treat them as trusted server-side calls, equivalent to admin for permission purposes.
    const isApiToken = (ctx.state as any)?.auth?.strategy?.name === 'api-token';

    if (!user && !isApiToken) return ctx.forbidden('Not authenticated');

    const isPatient = !isApiToken && (user.role?.type === 'patient' || user.userRole === 'patient');
    const isAdmin = isApiToken || user?.role?.type === 'admin' || user?.userRole === 'admin';
    const isHumanAdmin = user?.role?.type === 'admin' || user?.userRole === 'admin';
    const isStaff = !isApiToken && (['manager', 'coordinator'].includes(user?.userRole) || ['manager', 'coordinator'].includes(user?.role?.type));
    const body = (ctx.request.body as any)?.data || ctx.request.body || {};
    const linkedCaseRef = body.medical_case || body.medicalCase;

    if (isPatient && !linkedCaseRef) {
      return ctx.forbidden('Patients can only book consultation time for an assigned MedTour case.');
    }

    if (!isAdmin && !isStaff) {
      if (!isPatient) return ctx.forbidden('Only staff can create appointments');
    }

    // --- Input validation ---
    if (!body.dateTime) return ctx.badRequest('dateTime is required');
    const parsedDate = new Date(body.dateTime);
    if (isNaN(parsedDate.getTime())) return ctx.badRequest('dateTime must be a valid ISO 8601 date');
    if (parsedDate <= new Date()) return ctx.badRequest('dateTime must be in the future');

    const ALLOWED_TYPES = ['video', 'chat'];
    const appointmentType = body.type || 'video';
    if (!ALLOWED_TYPES.includes(appointmentType)) return ctx.badRequest('type must be video or chat');

    if (!body.doctor) return ctx.badRequest('doctor is required');
    if (!body.roomId || typeof body.roomId !== 'string' || body.roomId.length > 128) {
      return ctx.badRequest('roomId is required and must be a valid string');
    }
    if (linkedCaseRef) {
      if (!isApiToken && !(await userCanAccessMedicalCase(strapi, user, linkedCaseRef))) {
        return ctx.forbidden('Medical case is not available for this appointment');
      }
      // In Strapi v5, relations in published documents require the related document
      // to also be published. Ensure a published version of the medical case exists.
      const caseDocId = typeof linkedCaseRef === 'string'
        ? linkedCaseRef
        : String(linkedCaseRef);
      await ensureMedicalCasePublished(strapi, caseDocId);
    }

    // --- Working hours validation (skip for admin and staff) ---
    if (!isAdmin && !isStaff) {
      const drRef = body.doctor;
      const drForHours: any = typeof drRef === 'number'
        ? await strapi.query('api::doctor.doctor').findOne({ where: { id: drRef } })
        : await strapi.query('api::doctor.doctor').findOne({ where: { documentId: drRef } });

      if (drForHours) {
        // Check working day (workingDays = "1,2,3,4,5", Mon=1 Sun=7 per ISO)
        // Используем казахстанское время (UTC+5) для определения дня недели
        const kzDate = new Date(parsedDate.getTime() + KZ_OFFSET_MS);
        const isoDay = kzDate.getUTCDay() === 0 ? 7 : kzDate.getUTCDay();
        const workingDays = (drForHours.workingDays || '1,2,3,4,5')
          .split(',').map((d: string) => parseInt(d.trim(), 10));
        if (!workingDays.includes(isoDay)) {
          return ctx.badRequest('Doctor does not work on the selected day');
        }

        // Check working hours — times stored as "HH:MM"
        // Используем UTC+5 (Астана/Алматы) для сравнения с рабочими часами врача
        const toMinutes = (t: string) => {
          const [h, m] = t.split(':').map(Number);
          return h * 60 + m;
        };
        const apptMinutes = (parsedDate.getUTCHours() * 60 + parsedDate.getUTCMinutes() + KZ_OFFSET_MIN) % 1440;
        const workStart = toMinutes(drForHours.workStartTime || '09:00');
        const workEnd   = toMinutes(drForHours.workEndTime   || '18:00');
        const breakStart = toMinutes(drForHours.breakStart    || '13:00');
        const breakEnd   = toMinutes(drForHours.breakEnd      || '14:00');

        if (apptMinutes < workStart || apptMinutes >= workEnd) {
          return ctx.badRequest('Appointment time is outside doctor working hours');
        }
        if (apptMinutes >= breakStart && apptMinutes < breakEnd) {
          return ctx.badRequest('Appointment time falls during doctor break time');
        }
      }
    }

    // --- Resolve patient documentId ---
    let patientDocId: string | undefined;
    if (!isAdmin && !isStaff) {
      // Force current user as patient
      patientDocId = user.documentId;
    } else if (body.patient) {
      if (typeof body.patient === 'number') {
        const found = await strapi.query('plugin::users-permissions.user').findOne({ where: { id: body.patient } });
        patientDocId = found?.documentId;
      } else {
        patientDocId = body.patient;
      }
    }

    // --- Resolve doctor documentId ---
    let doctorDocId: string | undefined;
    let doctorRecord: any;
    if (body.doctor) {
      if (typeof body.doctor === 'number') {
        doctorRecord = await strapi.query('api::doctor.doctor').findOne({ where: { id: body.doctor } });
        doctorDocId = doctorRecord?.documentId;
      } else {
        doctorDocId = body.doctor;
        doctorRecord = await strapi.query('api::doctor.doctor').findOne({ where: { documentId: body.doctor } });
      }
    }

    // --- Validate price against canonical doctor price ---
    if (!doctorRecord) {
      return ctx.badRequest('Doctor not found');
    }

    if (isPatient) {
      const caseDocId = typeof linkedCaseRef === 'string' ? linkedCaseRef : String(linkedCaseRef);
      const medicalCase = await strapi.documents('api::medical-case.medical-case' as any).findOne({
        documentId: caseDocId,
        populate: { doctor: { fields: ['id', 'documentId'] } },
      });
      const assignedDoctorDocId = medicalCase?.doctor?.documentId;
      if (!assignedDoctorDocId) {
        return ctx.forbidden('A doctor must be assigned before the patient can choose consultation time.');
      }
      if (assignedDoctorDocId !== doctorDocId) {
        return ctx.forbidden('Patients can only book time with the doctor assigned to their MedTour case.');
      }
      const allowedCaseStatuses = ['DOCTOR_ASSIGNED', 'WAITING_PATIENT_CONFIRMATION', 'UNDER_REVIEW', 'DOCUMENTS_UPLOADED'];
      if (!allowedCaseStatuses.includes(medicalCase?.status)) {
        return ctx.forbidden('Consultation time can only be selected while the case is waiting for booking.');
      }
    }

    const isFreeConsultation = process.env.FREE_CONSULTATIONS === 'true';
    const isPaymentsLive = process.env.PAYMENTS_LIVE === 'true';
    const allowTestPaymentsInProduction = process.env.ALLOW_TEST_PAYMENTS_IN_PRODUCTION === 'true';

    // When free-consultation mode is active, price is always 0 regardless of the doctor's rate.
    // Price validation is also skipped for case-based and staff-created appointments.
    const actualPrice = isFreeConsultation ? 0 : Number(doctorRecord.price);
    const isCaseBased = !!linkedCaseRef;
    if (!isFreeConsultation && !isCaseBased && !isStaff) {
      const submittedPrice = Number(body.price);
      if (!submittedPrice || submittedPrice !== actualPrice) {
        return ctx.badRequest('Invalid appointment price');
      }
    }

    // --- Restrict paymentStatus: only signaling server / admin may mark as paid ---
    const ALLOWED_STATUSES = ['pending', 'confirmed', 'cancelled', 'completed', 'in_progress'];
    const ALLOWED_PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'refunded'];
    const requestedStatus = body.statuse || body.status || 'pending';
    // In free-consultation mode every appointment is automatically considered paid.
    const requestedPaymentStatus = isFreeConsultation ? 'paid' : (body.paymentStatus || 'pending');

    if (!ALLOWED_STATUSES.includes(requestedStatus)) {
      return ctx.badRequest('Invalid status value');
    }
    if (!ALLOWED_PAYMENT_STATUSES.includes(requestedPaymentStatus)) {
      return ctx.badRequest('Invalid paymentStatus value');
    }

    // Payment gateway checks are bypassed in free-consultation mode.
    if (!isFreeConsultation) {
      const isProduction = process.env.NODE_ENV === 'production';
      if (isProduction && !isPaymentsLive && !allowTestPaymentsInProduction && (isApiToken || isPatient)) {
        return ctx.badRequest('Live payments must be enabled before appointments can be created in production');
      }
      if (!isHumanAdmin && !isApiToken && isPatient && isPaymentsLive) {
        return ctx.badRequest('Appointments must be created through the payment gateway');
      }
      if (isPaymentsLive && !isAdmin && requestedPaymentStatus === 'paid') {
        return ctx.badRequest('Payment must be confirmed through the payment gateway');
      }
    }

    // --- Atomic check + create using mutex (prevents race condition) ---
    const lockKey = `${doctorDocId}:${body.dateTime}`;

    let result: any;
    try {
      result = await withSlotLock(lockKey, async () => {
      if (body.dateTime && doctorDocId) {
        const requestedTime = new Date(body.dateTime);

        // Find doctor to get slotDuration
        const doctorRecord = await strapi.documents('api::doctor.doctor').findOne({
          documentId: doctorDocId,
          fields: ['id', 'slotDuration'],
        });
        const slotMinutes = (doctorRecord as any)?.slotDuration || 30;

        // Check for existing active appointments at the same time for this doctor
        const slotStart = new Date(requestedTime);
        const slotEnd = new Date(requestedTime.getTime() + slotMinutes * 60 * 1000);

        // Filter by documentId (same for draft + published) so this works
        // with Strapi v5's default draft-biased findMany. Keeping it on drafts
        // also means cancelled bookings (default update writes to draft) are
        // treated as free, letting the slot be re-booked.
        const existing = await strapi.documents('api::appointment.appointment').findMany({
          filters: {
            doctor: { documentId: doctorDocId },
            dateTime: {
              $gte: slotStart.toISOString(),
              $lt: slotEnd.toISOString(),
            },
            statuse: { $in: ['pending', 'confirmed', 'in_progress'] },
          },
        });

        if (existing.length > 0) {
          return { conflict: true };
        }
      }

      // Create appointment inside the lock — no one else can create for same slot.
      //
      // The medical_case relation is deliberately NOT part of the create data.
      // In Strapi v5 the document service maps the case documentId to the DRAFT
      // entity id, while validation of a published entry only accepts PUBLISHED
      // entity ids — so create() (and publish() of a draft) consistently fails
      // with "relation(s) ... do not exist" even though both versions of the
      // case exist. The relation is attached right after create at the DB layer
      // (entity ids, draft↔draft / published↔published), which bypasses that
      // broken validation and never loses the link.
      const linkedCaseDocId = linkedCaseRef ? String(linkedCaseRef) : null;
      const appointmentData: any = {
        dateTime: body.dateTime,
        type: body.type || 'video',
        statuse: requestedStatus,
        price: actualPrice,
        roomId: body.roomId,
        paymentStatus: requestedPaymentStatus,
        patient: patientDocId,
        doctor: doctorDocId,
      };
      const populate: any = {
        doctor: { populate: ['specialization', 'photo'] },
        patient: { fields: ['id', 'fullName', 'email', 'phone'] },
      };

      let appointment: any = await strapi.documents('api::appointment.appointment').create({
        data: appointmentData,
        status: 'published',
        populate,
      });

      if (linkedCaseDocId) {
        try {
          const caseRows = await strapi.db.query('api::medical-case.medical-case').findMany({
            where: { documentId: linkedCaseDocId },
            select: ['id', 'publishedAt'],
          });
          const apptRows = await strapi.db.query('api::appointment.appointment').findMany({
            where: { documentId: appointment.documentId },
            select: ['id', 'publishedAt'],
          });
          if (!caseRows.length || !apptRows.length) {
            throw new Error('medical case or appointment versions not found');
          }
          for (const apptRow of apptRows) {
            const caseRow =
              caseRows.find((c: any) => !!c.publishedAt === !!apptRow.publishedAt) || caseRows[0];
            await strapi.db.query('api::appointment.appointment').update({
              where: { id: apptRow.id },
              data: { medical_case: caseRow.id },
            });
          }
          // Re-read so the response carries the persisted link.
          appointment = await strapi.documents('api::appointment.appointment').findOne({
            documentId: appointment.documentId,
            status: 'published',
            populate: {
              ...populate,
              medical_case: { fields: ['id', 'documentId', 'status'] },
            },
          });
        } catch (linkErr: any) {
          // An appointment must not exist without its case link — roll back and fail.
          strapi.log.error(
            `appointment.create: failed to link medical_case ${linkedCaseDocId}, rolling appointment back: ${linkErr?.message}`
          );
          await strapi.documents('api::appointment.appointment').delete({
            documentId: appointment.documentId,
          });
          throw new Error('Failed to link the appointment to the medical case');
        }
      }

      return { conflict: false, appointment };
    });
    } catch (err: any) {
      const message = err?.message || '';
      if (message.includes('do not exist') || err?.name === 'YupValidationError' || err?.name === 'ValidationError') {
        return ctx.badRequest(message || 'Validation error while creating appointment');
      }
      strapi.log.error('Appointment create failed:', err);
      return ctx.internalServerError('Failed to create appointment');
    }

    if (result.conflict) {
      return ctx.badRequest('This time slot was just booked by another patient. Please choose a different time.');
    }

    // Audit log — structured so it can be filtered/exported
    strapi.log.info(JSON.stringify({
      audit: 'APPOINTMENT_CREATED',
      appointmentId: result.appointment?.documentId,
      patientId: patientDocId,
      doctorId: doctorDocId,
      dateTime: body.dateTime,
      price: actualPrice,
      paymentStatus: requestedPaymentStatus,
      createdBy: user?.id ?? 'api-token',
      ip: ctx.request.ip,
      ts: new Date().toISOString(),
    }));

    // When the appointment is linked to a medical case, advance the case status
    // server-side so the patient doesn't need a separate permission-restricted call.
    const linkedCase = body.medical_case || body.medicalCase;
    if (linkedCase) {
      const caseDocId = typeof linkedCase === 'string' ? linkedCase : String(linkedCase);
      try {
        await strapi.documents('api::medical-case.medical-case' as any).update({
          documentId: caseDocId,
          data: { status: 'CONSULTATION_BOOKED' } as any,
          status: 'published',
        });
      } catch {
        // If published update fails, try draft-only update
        try {
          await strapi.documents('api::medical-case.medical-case' as any).update({
            documentId: caseDocId,
            data: { status: 'CONSULTATION_BOOKED' } as any,
          });
        } catch (err: any) {
          strapi.log.warn(`Could not set CONSULTATION_BOOKED on case ${caseDocId}: ${err?.message}`);
        }
      }
    }

    return { data: result.appointment };
  },

  async update(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');

    const isAdmin = user.role?.type === 'admin' || user.userRole === 'admin';
    const isDoctor = user.role?.type === 'doctor' || user.userRole === 'doctor';

    const { id: documentId } = ctx.params;
    const body = (ctx.request.body as any)?.data || ctx.request.body || {};

    // Admins bypass field restrictions
    if (isAdmin) {
      const updated = await strapi.documents('api::appointment.appointment').update({
        documentId,
        data: body,
        status: 'published',
      });
      return { data: updated };
    }

    // Verify participant (policy also runs, this is defence-in-depth)
    const appointment = await strapi.documents('api::appointment.appointment').findOne({
      documentId,
      populate: {
        patient: { fields: ['id'] },
        doctor: { populate: { users_permissions_user: { fields: ['id'] } } },
      },
    });
    if (!appointment) return ctx.notFound('Appointment not found');

    const isPatient = appointment.patient?.id === user.id;
    const isDoctorParticipant = appointment.doctor?.users_permissions_user?.id === user.id;

    if (!isPatient && !isDoctorParticipant) return ctx.forbidden('Not a participant');

    // --- Field allowlists by role ---
    let allowed: Record<string, any> = {};

    const CANCEL_REFUND_CUTOFF_HOURS = 24;

    if (isPatient) {
      if (body.statuse !== undefined) {
        if (body.statuse !== 'cancelled') {
          return ctx.badRequest('Patients can only cancel appointments');
        }

        const appointmentTime = new Date((appointment as any).dateTime);
        if (appointmentTime <= new Date()) {
          return ctx.badRequest('Cannot cancel a past appointment');
        }

        allowed.statuse = 'cancelled';

        // Refund only if cancelled more than CANCEL_REFUND_CUTOFF_HOURS before appointment
        if ((appointment as any).paymentStatus === 'paid') {
          const hoursUntil = (appointmentTime.getTime() - Date.now()) / (1000 * 60 * 60);
          allowed.paymentStatus = hoursUntil >= CANCEL_REFUND_CUTOFF_HOURS ? 'refunded' : 'paid';
        }
      }

      if (body.rating !== undefined || body.review !== undefined) {
        if ((appointment as any).statuse !== 'completed') {
          return ctx.badRequest('Rating and review can only be set after a completed consultation');
        }
        if (body.rating !== undefined) allowed.rating = body.rating;
        if (body.review !== undefined) allowed.review = body.review;
      }
    } else if (isDoctorParticipant || isDoctor) {
      // Doctors may advance/update status and write chatLog
      const DOCTOR_ALLOWED_STATUSES = ['confirmed', 'in_progress', 'completed', 'cancelled'];
      if (body.statuse !== undefined) {
        if (!DOCTOR_ALLOWED_STATUSES.includes(body.statuse)) {
          return ctx.badRequest('Invalid status transition');
        }
        allowed.statuse = body.statuse;
      }
      if (body.chatLog !== undefined) allowed.chatLog = body.chatLog;
    }

    if (Object.keys(allowed).length === 0) {
      return ctx.badRequest('No allowed fields to update');
    }

    const updated = await strapi.documents('api::appointment.appointment').update({
      documentId,
      data: allowed,
      status: 'published',
    });

    strapi.log.info(JSON.stringify({
      audit: 'APPOINTMENT_UPDATED',
      documentId,
      fields: Object.keys(allowed),
      updatedBy: user.id,
      role: isPatient ? 'patient' : 'doctor',
      ip: ctx.request.ip,
      ts: new Date().toISOString(),
    }));

    return { data: updated };
  },

  /**
   * GET /appointments/booked-slots/:doctorId?date=YYYY-MM-DD
   * Возвращает массив занятых времён ["HH:mm"] в часовом поясе Казахстана
   * (UTC+5) для указанного врача и даты. Обходит ownership-фильтр find(),
   * но НЕ возвращает никаких данных пациентов — только строки времени.
   * Используется UI записи чтобы не показывать забронированные слоты.
   */
  async findBookedSlots(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('Not authenticated');

    const { doctorId } = ctx.params;
    const date = ctx.query?.date as string | undefined;

    if (!doctorId) return ctx.badRequest('doctorId required');
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return ctx.badRequest('date is required (YYYY-MM-DD)');
    }

    // Диапазон суток в UTC с запасом, чтобы покрыть записи, которые по UTC
    // попадают в соседние сутки при KZ +5 (19:00 UTC = 00:00 KZ+1д).
    const startUtc = new Date(`${date}T00:00:00.000Z`);
    const endUtc = new Date(`${date}T23:59:59.999Z`);
    const rangeStart = new Date(startUtc.getTime() - 6 * 60 * 60 * 1000);
    const rangeEnd = new Date(endUtc.getTime() + 6 * 60 * 60 * 1000);

    // Фронт обычно шлёт numeric id (published version of the doctor). In
    // Strapi v5 each document has a draft row and a published row with
    // DIFFERENT numeric ids, and the draft appointment links to the draft
    // doctor (not the published one). findMany defaults to drafts, so filtering
    // drafts by the published doctor's numeric id silently returns nothing.
    // Resolve to documentId (shared across draft+published) before querying.
    let doctorDocId: string | undefined;
    if (/^\d+$/.test(String(doctorId))) {
      const d = await strapi.query('api::doctor.doctor').findOne({ where: { id: Number(doctorId) } });
      doctorDocId = d?.documentId;
    } else {
      doctorDocId = String(doctorId);
    }
    if (!doctorDocId) {
      return { data: { slots: [] } };
    }

    const rows = await strapi.documents('api::appointment.appointment').findMany({
      filters: {
        doctor: { documentId: doctorDocId },
        dateTime: { $gte: rangeStart.toISOString(), $lte: rangeEnd.toISOString() },
        statuse: { $ne: 'cancelled' },
      },
      fields: ['dateTime'],
      limit: 500,
    });

    const slots = new Set<string>();
    for (const row of rows as any[]) {
      if (!row?.dateTime) continue;
      const kz = new Date(new Date(row.dateTime).getTime() + KZ_OFFSET_MS);
      // Оставляем только слоты, попадающие на запрошенную KZ-дату
      const y = kz.getUTCFullYear();
      const m = String(kz.getUTCMonth() + 1).padStart(2, '0');
      const d = String(kz.getUTCDate()).padStart(2, '0');
      if (`${y}-${m}-${d}` !== date) continue;
      const h = String(kz.getUTCHours()).padStart(2, '0');
      const min = String(kz.getUTCMinutes()).padStart(2, '0');
      slots.add(`${h}:${min}`);
    }

    return { data: { slots: Array.from(slots).sort() } };
  },

  /**
   * GET /appointments/can-join/:roomId
   * Возвращает авторитетное решение серверного времени:
   *   allowed, reason, serverTime, windowStart, windowEnd, dateTime.
   * Защищает от неверных часов/TZ на клиентском устройстве.
   */
  async canJoin(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('Not authenticated');

    const { roomId } = ctx.params;
    if (!roomId || typeof roomId !== 'string') {
      return ctx.badRequest('roomId required');
    }

    const list = await strapi.documents('api::appointment.appointment').findMany({
      filters: { roomId },
      populate: {
        doctor: {
          fields: ['id', 'consultationDuration'],
          populate: { users_permissions_user: { fields: ['id'] } },
        },
        patient: { fields: ['id'] },
      },
    });

    const appointment = list?.[0];
    if (!appointment) return ctx.notFound('Appointment not found');

    const isAdmin = user.role?.type === 'admin' || user.userRole === 'admin';
    const isPatientParticipant = appointment.patient?.id === user.id;
    const isDoctorParticipant = appointment.doctor?.users_permissions_user?.id === user.id;

    if (!isAdmin && !isPatientParticipant && !isDoctorParticipant) {
      return ctx.forbidden('Not a participant of this appointment');
    }

    const now = new Date();
    const dateTime = appointment.dateTime ? new Date(appointment.dateTime) : null;
    if (!dateTime || isNaN(dateTime.getTime())) {
      return ctx.badRequest('Appointment has invalid dateTime');
    }

    const duration = Number((appointment.doctor as any)?.consultationDuration) || 30;
    const BUFFER_BEFORE_MS = 15 * 60 * 1000;
    const BUFFER_AFTER_MS = 5 * 60 * 1000;
    const windowStart = new Date(dateTime.getTime() - BUFFER_BEFORE_MS);
    const windowEnd = new Date(dateTime.getTime() + duration * 60 * 1000 + BUFFER_AFTER_MS);

    const allowedStatuses = ['pending', 'confirmed', 'in_progress'];
    const status = (appointment as any).statuse;

    let allowed = true;
    let reason: string | null = null;

    if (!allowedStatuses.includes(status)) {
      allowed = false;
      reason = status === 'cancelled' ? 'cancelled' : 'wrong_status';
    } else if (now < windowStart) {
      allowed = false;
      reason = 'too_early';
    } else if (now > windowEnd) {
      allowed = false;
      reason = 'too_late';
    }

    return {
      data: {
        allowed,
        reason,
        serverTime: now.toISOString(),
        dateTime: dateTime.toISOString(),
        windowStart: windowStart.toISOString(),
        windowEnd: windowEnd.toISOString(),
        status,
        consultationDuration: duration,
      },
    };
  },
}));
