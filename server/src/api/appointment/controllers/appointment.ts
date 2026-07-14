/**
 * Appointment controller с ownership-фильтрацией.
 * - Patient видит только свои appointments
 * - Doctor видит только свои appointments
 * - Admin видит всё
 */
import { factories } from '@strapi/strapi';
import { getUserRole, userCanAccessMedicalCase } from '../../../utils/medtour-access';
import { normalizeCaseStatus } from '../../../utils/medical-case-workflow';

// Kazakhstan is UTC+5 with no DST (fixed offset, IANA: Asia/Almaty)
const KZ_OFFSET_MS = 5 * 60 * 60 * 1000;
const KZ_OFFSET_MIN = 5 * 60;
const APPOINTMENT_SLOT_UID = 'api::appointment-slot.appointment-slot' as any;

function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function formatKzDateTime(value: string | Date): string {
  return new Date(value).toLocaleString('ru-RU', {
    timeZone: 'Asia/Almaty',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function sameId(a: unknown, b: unknown) {
  return a != null && b != null && String(a) === String(b);
}

function isAppointmentDoctor(doctor: any, userId: unknown) {
  return sameId(doctor?.users_permissions_user?.id, userId) || sameId(doctor?.userId, userId);
}

function appointmentPopulateForRole(role: string) {
  const canSeePatientContact = ['admin', 'manager', 'coordinator'].includes(role);
  return {
    doctor: { populate: ['specialization', 'photo', 'users_permissions_user'] },
    patient: {
      fields: canSeePatientContact
        ? ['id', 'documentId', 'fullName', 'email', 'phone']
        : ['id', 'documentId', 'fullName'],
    },
    medical_documents: { populate: ['file'] },
    medical_case: {
      fields: [
        'id',
        'documentId',
        'caseNumber',
        'title',
        'status',
        'treatmentCategory',
        'urgency',
        'diagnosis',
        'symptoms',
        'currentTreatment',
        'doctorDecisionNotes',
      ],
    },
  } as any;
}

function redactAppointmentForRole(appointment: any, role: string) {
  if (!appointment || typeof appointment !== 'object') return appointment;
  if (role === 'patient') {
    const { doctorDecision, doctorDecisionNotes, ...publicAppointment } = appointment;
    if (publicAppointment.medical_case && typeof publicAppointment.medical_case === 'object') {
      const {
        doctorRecommendation,
        doctorDecisionNotes: _caseDoctorDecisionNotes,
        commissionDecision,
        commissionDecisionNotes,
        ...publicCase
      } = publicAppointment.medical_case;
      publicAppointment.medical_case = publicCase;
    }
    return publicAppointment;
  }
  if (role === 'doctor') {
    return {
      ...appointment,
      patient: appointment.patient
        ? {
          id: appointment.patient.id,
          documentId: appointment.patient.documentId,
          fullName: appointment.patient.fullName,
        }
        : null,
    };
  }
  return appointment;
}

async function userCanAccessAppointment(strapi: any, user: any, appointment: any) {
  const role = getUserRole(user);
  if (role === 'admin') return true;
  if (role === 'patient') {
    return sameId(appointment?.patient?.documentId, user.documentId) || sameId(appointment?.patient?.id, user.id);
  }
  if (role === 'doctor') {
    return isAppointmentDoctor(appointment?.doctor, user.id);
  }
  if (['manager', 'coordinator'].includes(role)) {
    const caseRef = appointment?.medical_case?.documentId || appointment?.medical_case?.id;
    return caseRef ? userCanAccessMedicalCase(strapi, user, caseRef) : false;
  }
  return false;
}

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

function isUniqueConstraintError(error: any): boolean {
  const code = String(error?.code || error?.original?.code || '');
  const message = String(error?.message || error?.original?.message || '').toLowerCase();
  const isSlotKeyValidation = Array.isArray(error?.details?.errors)
    && error.details.errors.some((item: any) => item?.path?.includes('slotKey') && String(item?.message || '').toLowerCase().includes('unique'));
  return code === '23505'
    || code === 'SQLITE_CONSTRAINT'
    || code === 'SQLITE_CONSTRAINT_UNIQUE'
    || isSlotKeyValidation
    || message.includes('must be unique')
    || message.includes('unique constraint')
    || message.includes('duplicate key');
}

async function releaseAppointmentSlot(strapi: any, appointmentDocumentId: string): Promise<void> {
  const locks = await strapi.documents(APPOINTMENT_SLOT_UID).findMany({
    filters: { appointmentDocumentId },
    limit: 10,
  });
  for (const lock of locks as any[]) {
    await strapi.documents(APPOINTMENT_SLOT_UID).delete({
      documentId: lock.documentId,
    });
  }
}

export default factories.createCoreController('api::appointment.appointment', () => ({
  async find(ctx) {
    const user = ctx.state.user;
    // API Token requests (from the signaling server) authenticate via the
    // content-api-token strategy — its strategy name is 'content-api-token'
    // in Strapi v5 (NOT 'api-token'). Accept the legacy name too, defensively.
    const strategyName = (ctx.state as any)?.auth?.strategy?.name;
    const isApiToken = strategyName === 'content-api-token' || strategyName === 'api-token';
    if (!user && !isApiToken) return ctx.forbidden('Not authenticated');

    const isAdmin = isApiToken || user?.role?.type === 'admin' || user?.userRole === 'admin';
    const role = user ? getUserRole(user) : 'admin';
    const populate = appointmentPopulateForRole(role);
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
        // New records use users_permissions_user; older seeded records may
        // still carry only userId. Keep both paths so consultations remain joinable.
        const doctorRecords = await strapi.documents('api::doctor.doctor').findMany({
          filters: {
            $or: [
              { users_permissions_user: { id: user.id } },
              { userId: user.id },
            ],
          },
          fields: ['documentId'],
          limit: 1,
        });
        const doctorRecord = doctorRecords?.[0];

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
          data: data.map((appointment: any) => redactAppointmentForRole(appointment, role)),
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
          data: data.map((appointment: any) => redactAppointmentForRole(appointment, role)),
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
      data: data.map((appointment: any) => redactAppointmentForRole(appointment, role)),
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
    const role = getUserRole(user);
    const populate = appointmentPopulateForRole(role);

    const appointment = await strapi.documents('api::appointment.appointment').findOne({
      documentId: id,
      populate,
    });

    if (!appointment) {
      return ctx.notFound('Appointment not found');
    }

    if (!(await userCanAccessAppointment(strapi, user, appointment))) {
      return ctx.notFound('Appointment not found');
    }

    return { data: redactAppointmentForRole(appointment, role) };
  },

  async create(ctx) {
    const user = ctx.state.user;
    // Requests from the signaling server arrive with an API token (no user session).
    // Treat them as trusted server-side calls, equivalent to admin for permission purposes.
    // Strapi v5 names the API-token strategy 'content-api-token' (NOT 'api-token').
    const strategyName = (ctx.state as any)?.auth?.strategy?.name;
    const isApiToken = strategyName === 'content-api-token' || strategyName === 'api-token';

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

    const ALLOWED_PURPOSES = ['initial_case_review', 'follow_up', 'pre_treatment', 'post_treatment'];
    const consultationPurpose = body.consultationPurpose || 'initial_case_review';
    if (!ALLOWED_PURPOSES.includes(consultationPurpose)) {
      return ctx.badRequest('Invalid consultationPurpose value');
    }

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
        const apptMinutes = (parsedDate.getUTCHours() * 60 + parsedDate.getUTCMinutes() + KZ_OFFSET_MIN) % 1440;
        const workStart = timeToMinutes(drForHours.workStartTime || '09:00');
        const workEnd   = timeToMinutes(drForHours.workEndTime   || '18:00');
        const breakStart = timeToMinutes(drForHours.breakStart    || '13:00');
        const breakEnd   = timeToMinutes(drForHours.breakEnd      || '14:00');

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

    // Accept only canonical doctor slots. Besides protecting the schedule from
    // malformed direct API calls, this guarantees that the unique DB lock below
    // represents the complete consultation interval rather than just a timestamp.
    const doctorSlotMinutes = Number(doctorRecord.slotDuration) || 30;
    const appointmentMinutesKz = (
      parsedDate.getUTCHours() * 60
      + parsedDate.getUTCMinutes()
      + KZ_OFFSET_MIN
    ) % 1440;
    const doctorWorkStart = timeToMinutes(doctorRecord.workStartTime || '09:00');
    const slotOffset = ((appointmentMinutesKz - doctorWorkStart) % doctorSlotMinutes + doctorSlotMinutes) % doctorSlotMinutes;
    if (
      !Number.isInteger(doctorSlotMinutes)
      || doctorSlotMinutes < 5
      || doctorSlotMinutes > 240
      || parsedDate.getUTCSeconds() !== 0
      || parsedDate.getUTCMilliseconds() !== 0
      || slotOffset !== 0
    ) {
      return ctx.badRequest('Appointment time must match an available doctor time slot');
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
      const allowedCaseStatuses = [
        'DOCTOR_ASSIGNED',
        'WAITING_PATIENT_CONFIRMATION',
        'UNDER_REVIEW',
        'DOCUMENTS_UPLOADED',
        'CONSULTATION_COMPLETED',
      ];
      if (!allowedCaseStatuses.includes(medicalCase?.status)) {
        return ctx.forbidden('Consultation time can only be selected while the case is waiting for booking.');
      }
    }

    // Free consultations are the current production default. Set
    // FREE_CONSULTATIONS=false only when paid consultations are re-enabled.
    const isFreeConsultation = process.env.FREE_CONSULTATIONS !== 'false';
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

    // The in-process mutex avoids redundant work locally. The unique slot record
    // is the actual cross-process guarantee for horizontally scaled instances.
    const canonicalDateTime = parsedDate.toISOString();
    const lockKey = `${doctorDocId}:${canonicalDateTime}`;

    let result: any;
    try {
      result = await withSlotLock(lockKey, async () => {
        try {
          return await strapi.db.transaction(async () => {
            const slotStart = new Date(parsedDate.getTime() - doctorSlotMinutes * 60 * 1000);
            const slotEnd = new Date(parsedDate.getTime() + doctorSlotMinutes * 60 * 1000);
            const existing = await strapi.documents('api::appointment.appointment').findMany({
              filters: {
                doctor: { documentId: doctorDocId },
                dateTime: {
                  $gt: slotStart.toISOString(),
                  $lt: slotEnd.toISOString(),
                },
                statuse: { $in: ['pending', 'confirmed', 'in_progress'] },
              },
            });
            if (existing.length > 0) return { conflict: true };

            const persistentLock: any = await strapi.documents(APPOINTMENT_SLOT_UID).create({
              data: {
                slotKey: lockKey,
                doctorDocumentId: doctorDocId,
                dateTime: canonicalDateTime,
              },
            });

            // The medical_case relation is deliberately attached at the DB layer:
            // draft and published entries have different numeric relation targets.
            const linkedCaseDocId = linkedCaseRef ? String(linkedCaseRef) : null;
            const populate: any = {
              doctor: { populate: ['specialization', 'photo'] },
              patient: { fields: ['id', 'fullName', 'email', 'phone'] },
            };
            let appointment: any = await strapi.documents('api::appointment.appointment').create({
              data: {
                dateTime: canonicalDateTime,
                type: body.type || 'video',
                consultationPurpose,
                statuse: requestedStatus,
                price: actualPrice,
                roomId: body.roomId,
                paymentStatus: requestedPaymentStatus,
                patient: patientDocId,
                doctor: doctorDocId,
              },
              status: 'published',
              populate,
            });

            if (linkedCaseDocId) {
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
                const caseRow = caseRows.find((item: any) => !!item.publishedAt === !!apptRow.publishedAt) || caseRows[0];
                await strapi.db.query('api::appointment.appointment').update({
                  where: { id: apptRow.id },
                  data: { medical_case: caseRow.id },
                });
              }
              appointment = await strapi.documents('api::appointment.appointment').findOne({
                documentId: appointment.documentId,
                status: 'published',
                populate: {
                  ...populate,
                  medical_case: { fields: ['id', 'documentId', 'status'] },
                },
              });
            }

            await strapi.documents(APPOINTMENT_SLOT_UID).update({
              documentId: persistentLock.documentId,
              data: { appointmentDocumentId: appointment.documentId },
            });

            if (linkedCaseDocId) {
              await strapi.documents('api::medical-case.medical-case' as any).update({
                documentId: linkedCaseDocId,
                data: { status: 'CONSULTATION_BOOKED' } as any,
                status: 'published',
              });
              await strapi.documents('api::case-event.case-event' as any).create({
                data: {
                  medical_case: linkedCaseDocId,
                  ...(user ? { actor: user.documentId || user.id } : {}),
                  eventType: 'CONSULTATION_SCHEDULED',
                  message: `Consultation scheduled: ${formatKzDateTime(canonicalDateTime)}`,
                  metadata: {
                    appointmentId: appointment.documentId,
                    dateTime: canonicalDateTime,
                    doctorName: appointment.doctor?.fullName || null,
                    scheduledBy: isPatient ? 'patient' : isStaff ? 'staff' : 'system',
                  },
                },
              });
            }

            return { conflict: false, appointment };
          });
        } catch (error) {
          if (isUniqueConstraintError(error)) return { conflict: true };
          throw error;
        }
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

    // The case status and activity event were committed with the appointment.
    // User notifications happen afterwards and may safely be retried independently.
    const linkedCase = body.medical_case || body.medicalCase;
    if (linkedCase) {
      const caseDocId = typeof linkedCase === 'string' ? linkedCase : String(linkedCase);
      if (isPatient) {
        try {
          const caseWithStaff: any = await strapi.documents('api::medical-case.medical-case' as any).findOne({
            documentId: caseDocId,
            populate: {
              manager: { fields: ['id', 'fullName'] },
              coordinator: { fields: ['id', 'fullName'] },
            },
          });
          const patientName = result.appointment?.patient?.fullName || 'Пациент';
          const doctorName = result.appointment?.doctor?.fullName || 'врач';
          const when = formatKzDateTime(body.dateTime);
          const appointmentId = result.appointment?.documentId;

          const recipients = [
            { user: caseWithStaff?.manager, role: 'manager' },
            { user: caseWithStaff?.coordinator, role: 'coordinator' },
          ].filter((item, index, items) => item.user?.id && items.findIndex(other => other.user?.id === item.user.id) === index);

          const notificationService = strapi.service('api::notification.notification');
          await Promise.all(recipients.map(({ user: recipient, role }) => notificationService.notifyUser(recipient.id, {
            title: 'Пациент выбрал время консультации',
            message: `${patientName} записался(лась) к врачу ${doctorName} — ${when} (время Алматы)`,
            type: 'appointment',
            link: `/${role}/cases/${caseDocId}`,
            metadata: { appointmentId, caseId: caseDocId, dateTime: body.dateTime },
          })));
        } catch (err: any) {
          // Booking must remain successful even if an auxiliary notification fails.
          strapi.log.warn(`Could not notify case staff about appointment: ${err?.message}`);
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
      const updated = await strapi.db.transaction(async () => {
        const saved = await strapi.documents('api::appointment.appointment').update({
          documentId,
          data: body,
          status: 'published',
        });
        if (body.statuse === 'cancelled') {
          await releaseAppointmentSlot(strapi, documentId);
        }
        return saved;
      });
      return { data: updated };
    }

    // Verify participant (policy also runs, this is defence-in-depth)
    const appointment = await strapi.documents('api::appointment.appointment').findOne({
      documentId,
      populate: {
        patient: { fields: ['id'] },
        doctor: { fields: ['userId'], populate: { users_permissions_user: { fields: ['id'] } } },
        medical_case: { fields: ['id', 'documentId', 'status'] },
      },
    });
    if (!appointment) return ctx.notFound('Appointment not found');

    const isPatient = appointment.patient?.id === user.id;
    const isDoctorParticipant = isAppointmentDoctor(appointment.doctor, user.id);

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
      // Doctors may advance/update status, write chatLog and leave internal
      // consultation feedback for MedTour staff. Patients never receive these
      // fields from the API redaction layer.
      const DOCTOR_ALLOWED_STATUSES = ['confirmed', 'in_progress', 'completed', 'cancelled'];
      if (body.statuse !== undefined) {
        if (!DOCTOR_ALLOWED_STATUSES.includes(body.statuse)) {
          return ctx.badRequest('Invalid status transition');
        }
        allowed.statuse = body.statuse;
      }
      if (body.chatLog !== undefined) allowed.chatLog = body.chatLog;
      if (body.doctorDecision !== undefined) {
        const allowedDecisions = ['treatment_required', 'no_treatment_needed', 'needs_more_documents'];
        if (body.doctorDecision !== null && body.doctorDecision !== '' && !allowedDecisions.includes(body.doctorDecision)) {
          return ctx.badRequest('Invalid doctorDecision value');
        }
        allowed.doctorDecision = body.doctorDecision || null;
      }
      if (body.doctorDecisionNotes !== undefined) {
        allowed.doctorDecisionNotes = String(body.doctorDecisionNotes || '').slice(0, 10000);
      }
    }

    if (Object.keys(allowed).length === 0) {
      return ctx.badRequest('No allowed fields to update');
    }

    const linkedCase = (appointment as any).medical_case;
    const updated = await strapi.db.transaction(async () => {
      const saved = await strapi.documents('api::appointment.appointment').update({
        documentId,
        data: allowed,
        status: 'published',
      });
      if (allowed.statuse === 'cancelled') {
        await releaseAppointmentSlot(strapi, documentId);
      }

      if (allowed.statuse === 'completed' && linkedCase?.documentId) {
        const previousCaseStatus = normalizeCaseStatus(linkedCase.status);
        const statusesToComplete = ['WAITING_PAYMENT', 'CONSULTATION_BOOKED'];
        if (statusesToComplete.includes(previousCaseStatus || '')) {
          // Do not use Document Service here. In Strapi v5 a published update
          // can replace the numeric row while the inverse appointment relation
          // still points at the previous row, causing relation validation to
          // reject the whole completion request. Updating both document rows
          // in place keeps the draft/published relation IDs stable.
          await strapi.db.query('api::medical-case.medical-case').updateMany({
            where: { documentId: linkedCase.documentId },
            data: { status: 'CONSULTATION_COMPLETED' } as any,
          });
          await strapi.documents('api::case-event.case-event' as any).create({
            data: {
              medical_case: linkedCase.documentId,
              actor: user.documentId || user.id,
              eventType: 'CONSULTATION_COMPLETED',
              fromStatus: previousCaseStatus,
              toStatus: 'CONSULTATION_COMPLETED',
              message: 'Consultation completed by doctor',
              metadata: { appointmentId: documentId },
            },
          });
        }
      }
      return saved;
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

  async delete(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');
    const isAdmin = user.role?.type === 'admin' || user.userRole === 'admin';
    if (!isAdmin) return ctx.forbidden('Only administrators can delete appointments');

    const { id: documentId } = ctx.params;
    const existing = await strapi.documents('api::appointment.appointment').findOne({ documentId });
    if (!existing) return ctx.notFound('Appointment not found');

    const deleted = await strapi.db.transaction(async () => {
      const result = await strapi.documents('api::appointment.appointment').delete({ documentId });
      await releaseAppointmentSlot(strapi, documentId);
      return result;
    });

    strapi.log.info(JSON.stringify({
      audit: 'APPOINTMENT_DELETED',
      documentId,
      deletedBy: user.id,
      ip: ctx.request.ip,
      ts: new Date().toISOString(),
    }));
    return { data: deleted };
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
          fields: ['id', 'consultationDuration', 'userId'],
          populate: { users_permissions_user: { fields: ['id'] } },
        },
        patient: { fields: ['id'] },
      },
    });

    const appointment = list?.[0];
    if (!appointment) return ctx.notFound('Appointment not found');

    const isAdmin = user.role?.type === 'admin' || user.userRole === 'admin';
    const isPatientParticipant = sameId(appointment.patient?.id, user.id);
    const isDoctorParticipant = isAppointmentDoctor(appointment.doctor, user.id);

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
