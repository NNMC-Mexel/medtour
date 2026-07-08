/**
 * Medical-document controller с ownership-фильтрацией и sharing.
 * - Patient видит только свои документы
 * - Doctor видит документы своих пациентов + расшаренные ему
 * - Admin видит всё
 */
import { factories } from '@strapi/strapi';
import { normalizeCaseStatus } from '../../../utils/medical-case-workflow';
import {
  getMedicalCaseAccessFilter,
  getUserRole,
  isAdminUser,
  userCanAccessMedicalCase,
} from '../../../utils/medtour-access';

const DOCUMENT_REVIEW_STATUSES = [
  'REQUESTED',
  'UPLOADED',
  'IN_REVIEW',
  'APPROVED',
  'REJECTED',
  'TRANSLATION_NEEDED',
  'TRANSLATED',
];

const PATIENT_UPDATE_FIELDS = ['title', 'type', 'description'];
const STAFF_UPDATE_FIELDS = [
  'title',
  'type',
  'description',
  'file',
  'reviewStatus',
  'reviewNotes',
  'requestedLanguage',
  'dueDate',
];
const STAFF_CREATE_FIELDS = ['reviewStatus', 'reviewNotes', 'requestedLanguage', 'dueDate'];

function pickFields(body: Record<string, any>, fields: string[]) {
  return Object.fromEntries(Object.entries(body).filter(([key]) => fields.includes(key)));
}

function getRelationRef(value: any) {
  if (!value) return undefined;
  return typeof value === 'object' ? value.documentId || value.id : value;
}

export default factories.createCoreController('api::medical-document.medical-document', () => ({
  async find(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');

    const role = getUserRole(user);
    const isAdmin = isAdminUser(user);
    const populate = ['file', 'user', 'doctor', 'appointment', 'medical_case', 'sharedWithDoctors'] as any;
    const sort = (ctx.query?.sort as any) || ['createdAt:desc'];

    const queryFilters = ctx.query?.filters as any;
    const typeFilter = queryFilters?.type?.$eq;
    const userIdFilter = queryFilters?.user?.id?.$eq;

    let filters: any = {};
    if (typeFilter) {
      filters.type = typeFilter;
    }

    if (!isAdmin) {
      const isDoctor = role === 'doctor';

      if (isDoctor) {
        const doctorRecord = await strapi
          .query('api::doctor.doctor')
          .findOne({ where: { users_permissions_user: user.id } });

        if (!doctorRecord) {
          return { data: [], meta: { pagination: { page: 1, pageSize: 0, pageCount: 0, total: 0 } } };
        }

        if (userIdFilter) {
          // Doctor viewing specific patient's docs — show appointment-linked + shared
          const allDocs = await strapi.documents('api::medical-document.medical-document').findMany({
            filters: { user: { id: userIdFilter } },
            sort,
            populate,
          });

          // Filter: doctor's own docs OR shared with this doctor
          const data = allDocs.filter((doc: any) => {
            const isOwn = doc.doctor?.id === doctorRecord.id || doc.doctor?.documentId === doctorRecord.documentId;
            const isShared = doc.sharedWithDoctors?.some(
              (d: any) => d.id === doctorRecord.id || d.documentId === doctorRecord.documentId
            );
            return isOwn || isShared;
          });

          return {
            data,
            meta: { pagination: { page: 1, pageSize: data.length, pageCount: 1, total: data.length } },
          };
        } else {
          // Doctor viewing all their docs (own + shared)
          const [ownDocs, sharedDocs] = await Promise.all([
            strapi.documents('api::medical-document.medical-document').findMany({
              filters: { doctor: { id: doctorRecord.id }, ...filters },
              sort,
              populate,
            }),
            strapi.documents('api::medical-document.medical-document').findMany({
              filters: { sharedWithDoctors: { id: doctorRecord.id }, ...filters },
              sort,
              populate,
            }),
          ]);

          // Merge and deduplicate
          const seen = new Set<any>();
          const data: any[] = [];
          for (const doc of [...ownDocs, ...sharedDocs]) {
            if (!seen.has(doc.id)) {
              seen.add(doc.id);
              data.push(doc);
            }
          }

          return {
            data,
            meta: { pagination: { page: 1, pageSize: data.length, pageCount: 1, total: data.length } },
          };
        }
      } else if (['manager', 'coordinator'].includes(role)) {
        const caseFilter = await getMedicalCaseAccessFilter(strapi, user);
        if (caseFilter === null) {
          return { data: [], meta: { pagination: { page: 1, pageSize: 0, pageCount: 0, total: 0 } } };
        }
        filters.medical_case = caseFilter;
      } else {
        // Patient sees only their own documents
        filters.user = { id: user.id };
      }
    } else if (userIdFilter) {
      filters.user = { id: userIdFilter };
    }

    const data = await strapi.documents('api::medical-document.medical-document').findMany({
      filters,
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

  async create(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');

    const body = (ctx.request.body as any)?.data || ctx.request.body || {};

    const role = getUserRole(user);
    const isAdmin = isAdminUser(user);
    const isDoctor = role === 'doctor';
    const isStaff = ['manager', 'coordinator'].includes(role);
    const canSetReviewFields = isAdmin || isDoctor || isStaff;

    // Resolve user (patient) documentId
    let userDocId: string | undefined;
    if (!isAdmin && !isDoctor && !isStaff) {
      userDocId = user.documentId;
    } else if (body.user) {
      if (typeof body.user === 'number') {
        const found = await strapi.query('plugin::users-permissions.user').findOne({ where: { id: body.user } });
        userDocId = found?.documentId;
      } else {
        userDocId = body.user;
      }
    }

    // Resolve doctor documentId
    let doctorDocId: string | undefined;
    if (body.doctor) {
      if (typeof body.doctor === 'number') {
        const found = await strapi.query('api::doctor.doctor').findOne({ where: { id: body.doctor } });
        doctorDocId = found?.documentId;
      } else {
        doctorDocId = body.doctor;
      }
    }

    // Resolve appointment documentId + validate doctor is the appointment's doctor.
    // The linked medical_case is intentionally loaded here as a fallback: the
    // video room and appointment-detail UI save doctor conclusions against an
    // appointment, but managers work from the case document list.
    let appointmentDocId: string | undefined;
    let appointmentRecord: any;
    if (body.appointment) {
      if (typeof body.appointment === 'number') {
        appointmentRecord = await strapi.query('api::appointment.appointment').findOne({
          where: { id: body.appointment },
          populate: { doctor: true, patient: true, medical_case: true },
        });
      } else {
        appointmentRecord = await strapi.documents('api::appointment.appointment').findOne({
          documentId: body.appointment,
          populate: {
            doctor: { fields: ['id', 'documentId'] },
            patient: { fields: ['id', 'documentId'] },
            medical_case: { fields: ['id', 'documentId', 'status'] },
          },
        });
      }

      if (!appointmentRecord) return ctx.badRequest('Appointment not found');
      appointmentDocId = appointmentRecord.documentId;
      if (!userDocId && appointmentRecord.patient?.documentId) {
        userDocId = appointmentRecord.patient.documentId;
      }

      // If a doctor is uploading, verify they are the doctor in the linked appointment
      if (isDoctor && !isAdmin) {
        const doctorRecord = await strapi
          .query('api::doctor.doctor')
          .findOne({ where: { users_permissions_user: user.id } });

        const apptDoctorDocId = appointmentRecord.doctor?.documentId;
        if (!doctorRecord || apptDoctorDocId !== doctorRecord.documentId) {
          return ctx.forbidden('You can only upload documents for your own appointments');
        }
        if (!doctorDocId) doctorDocId = doctorRecord.documentId;
      }

      // If a patient is uploading, verify they are the patient in the linked appointment
      if (!isDoctor && !isAdmin && !isStaff) {
        const aptWithPatient = await strapi.documents('api::appointment.appointment').findOne({
          documentId: appointmentDocId,
          populate: { patient: { fields: ['id'] } },
        });
        if (!aptWithPatient || (aptWithPatient as any).patient?.id !== user.id) {
          return ctx.forbidden('You can only upload documents for your own appointments');
        }
      }
    }

    let medicalCaseDocId: string | undefined;
    let linkedCaseRecord: any;
    const requestedCaseRef = body.medical_case || appointmentRecord?.medical_case?.documentId || appointmentRecord?.medical_case?.id;
    if (requestedCaseRef) {
      let caseRecord: any;
      if (typeof requestedCaseRef === 'number') {
        caseRecord = await strapi.query('api::medical-case.medical-case' as any).findOne({
          where: { id: requestedCaseRef },
          populate: { patient: true, doctor: true },
        });
      } else {
        caseRecord = await strapi.documents('api::medical-case.medical-case' as any).findOne({
          documentId: requestedCaseRef,
          populate: { patient: { fields: ['id', 'documentId'] }, doctor: { fields: ['id', 'documentId'] } },
        });
      }

      if (!caseRecord) return ctx.badRequest('Medical case not found');
      linkedCaseRecord = caseRecord;
      medicalCaseDocId = caseRecord.documentId;
      if ((isStaff || isDoctor || isAdmin) && !userDocId && caseRecord.patient?.documentId) {
        userDocId = caseRecord.patient.documentId;
      }

      if (!isDoctor && !isAdmin && !isStaff && caseRecord.patient?.id !== user.id) {
        return ctx.forbidden('You can only upload documents for your own medical cases');
      }

      if (isStaff && !isAdmin && !(await userCanAccessMedicalCase(strapi, user, medicalCaseDocId))) {
        return ctx.forbidden('You can only upload documents for assigned medical cases');
      }

      if (isDoctor && !isAdmin) {
        const doctorRecord = await strapi
          .query('api::doctor.doctor')
          .findOne({ where: { users_permissions_user: user.id } });

        if (!doctorRecord || caseRecord.doctor?.documentId !== doctorRecord.documentId) {
          return ctx.forbidden('You can only upload documents for assigned medical cases');
        }
      }
    }

    // SECURITY (file-IDOR): a media field is a polymorphic relation, so the
    // same upload file can be linked from multiple medical-documents. Without
    // this check a patient could enumerate upload ids and attach another
    // patient's file to a document they own, then read it through the
    // file-proxy (which authorises by doc.user === caller). Staff/doctor link
    // files on behalf of patients and are already gated by case/appointment
    // access checks above, so this only constrains the patient self-upload path.
    if (body.file && !isAdmin && !isDoctor && !isStaff) {
      const fileId = typeof body.file === 'object' ? (body.file.id ?? body.file.documentId ?? body.file) : body.file;
      const existingForFile = await strapi.documents('api::medical-document.medical-document').findMany({
        filters: { file: { id: fileId } } as any,
        populate: { user: { fields: ['id'] } } as any,
        limit: 50,
      });
      if (existingForFile.some((d: any) => d.user?.id && d.user.id !== user.id)) {
        return ctx.forbidden('This file is not available');
      }
    }

    // Resolve sharedWithDoctors documentIds
    let sharedDoctorDocIds: string[] | undefined;
    if (body.sharedWithDoctors && Array.isArray(body.sharedWithDoctors)) {
      sharedDoctorDocIds = [];
      for (const ref of body.sharedWithDoctors) {
        if (typeof ref === 'number') {
          const found = await strapi.query('api::doctor.doctor').findOne({ where: { id: ref } });
          if (found?.documentId) sharedDoctorDocIds.push(found.documentId);
        } else {
          sharedDoctorDocIds.push(ref);
        }
      }
    }

    const reviewData = canSetReviewFields ? pickFields(body, STAFF_CREATE_FIELDS) : {};
    if (reviewData.reviewStatus && !DOCUMENT_REVIEW_STATUSES.includes(reviewData.reviewStatus)) {
      return ctx.badRequest('Invalid document review status');
    }
    const reviewStatus = reviewData.reviewStatus || 'UPLOADED';

    const document = await strapi.documents('api::medical-document.medical-document').create({
      data: {
        title: body.title,
        type: body.type || 'other',
        description: body.description || '',
        file: body.file,
        reviewStatus,
        reviewNotes: reviewData.reviewNotes || '',
        requestedLanguage: reviewData.requestedLanguage || '',
        dueDate: reviewData.dueDate || null,
        requestedBy: reviewStatus === 'REQUESTED' ? (user.documentId || user.id) : null,
        user: userDocId,
        doctor: doctorDocId,
        appointment: appointmentDocId,
        medical_case: medicalCaseDocId,
        sharedWithDoctors: sharedDoctorDocIds,
      } as any,
      status: 'published',
      populate: ['file', 'user', 'doctor', 'appointment', 'medical_case', 'sharedWithDoctors'] as any,
    });

    if (medicalCaseDocId) {
      const currentCaseStatus = normalizeCaseStatus(linkedCaseRecord?.status);
      if (['NEW_LEAD', 'REGISTERED', 'WAITING_FOR_DOCUMENTS'].includes(currentCaseStatus || '')) {
        await strapi.documents('api::medical-case.medical-case' as any).update({
          documentId: medicalCaseDocId,
          data: { status: 'DOCUMENTS_UPLOADED' } as any,
          status: 'published',
        });
      }

      const isDoctorFeedback = isDoctor && appointmentDocId;
      await strapi.documents('api::case-event.case-event' as any).create({
        data: {
          medical_case: medicalCaseDocId,
          actor: user.documentId || user.id,
          eventType: isDoctorFeedback ? 'DOCTOR_FEEDBACK_UPLOADED' : 'DOCUMENT_UPLOADED',
          fromStatus: currentCaseStatus,
          toStatus: ['NEW_LEAD', 'REGISTERED', 'WAITING_FOR_DOCUMENTS'].includes(currentCaseStatus || '')
            ? 'DOCUMENTS_UPLOADED'
            : currentCaseStatus,
          message: isDoctorFeedback ? 'Doctor uploaded post-consultation feedback' : 'Medical document uploaded',
          metadata: {
            documentId: (document as any).documentId || (document as any).id,
            title: body.title,
            type: body.type || 'other',
            appointmentId: appointmentDocId || null,
          },
        },
      });
    }

    return { data: document };
  },

  async update(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');

    const role = getUserRole(user);
    const body = (ctx.request.body as any)?.data || ctx.request.body || {};

    const existing = await strapi.documents('api::medical-document.medical-document').findOne({
      documentId: ctx.params.id,
      populate: {
        user: { fields: ['id', 'documentId'] },
        doctor: { populate: { users_permissions_user: { fields: ['id'] } } },
        appointment: { populate: { medical_case: { fields: ['id', 'documentId'] } } },
        medical_case: true,
      },
    });
    if (!existing) return ctx.notFound('Document not found');

    const medicalCaseRef = getRelationRef((existing as any).medical_case);
    const isOwnerPatient = (existing as any).user?.id === user.id;
    const isDoctorOwner = (existing as any).doctor?.users_permissions_user?.id === user.id;
    const canAccessCase = medicalCaseRef
      ? await userCanAccessMedicalCase(strapi, user, medicalCaseRef)
      : false;

    let data: Record<string, any> = {};
    if (isAdminUser(user) || ['manager', 'coordinator'].includes(role) || isDoctorOwner || (role === 'doctor' && canAccessCase)) {
      if (!isAdminUser(user) && !isDoctorOwner && !canAccessCase) {
        return ctx.forbidden('Forbidden');
      }
      data = pickFields(body, STAFF_UPDATE_FIELDS);
      if (data.reviewStatus && !DOCUMENT_REVIEW_STATUSES.includes(data.reviewStatus)) {
        return ctx.badRequest('Invalid document review status');
      }
      if (data.reviewStatus && ['APPROVED', 'REJECTED', 'TRANSLATION_NEEDED', 'TRANSLATED'].includes(data.reviewStatus)) {
        data.reviewedAt = new Date().toISOString();
        data.reviewedBy = user.documentId || user.id;
      }
      if (data.reviewStatus === 'REQUESTED') {
        data.requestedBy = user.documentId || user.id;
      }
    } else if (isOwnerPatient) {
      data = pickFields(body, PATIENT_UPDATE_FIELDS);
    } else {
      return ctx.forbidden('Forbidden');
    }

    if (Object.keys(data).length === 0) {
      return ctx.badRequest('No allowed fields to update');
    }

    const inferredCaseFromAppointment = (existing as any).appointment?.medical_case?.documentId;
    if (!medicalCaseRef && inferredCaseFromAppointment && (isAdminUser(user) || isDoctorOwner || role === 'doctor')) {
      data.medical_case = inferredCaseFromAppointment;
    }

    const updated = await strapi.documents('api::medical-document.medical-document').update({
      documentId: ctx.params.id,
      data,
      status: 'published',
      populate: ['file', 'user', 'doctor', 'appointment', 'medical_case', 'sharedWithDoctors'] as any,
    });

    if (medicalCaseRef && data.reviewStatus) {
      await strapi.documents('api::case-event.case-event' as any).create({
        data: {
          medical_case: medicalCaseRef,
          actor: user.documentId || user.id,
          eventType: data.reviewStatus === 'REQUESTED' ? 'DOCUMENT_REQUESTED' : 'NOTE',
          message: `Document status changed to ${data.reviewStatus}`,
          metadata: {
            documentId: (updated as any).documentId || (updated as any).id,
            reviewStatus: data.reviewStatus,
            reviewNotes: data.reviewNotes || null,
          },
        },
      });
    }

    return { data: updated };
  },

  /**
   * Share a document with specific doctors.
   * PUT /api/medical-documents/:id/share
   * Body: { doctorIds: [documentId1, documentId2, ...] }
   */
  async share(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');

    const { id } = ctx.params;
    const body = (ctx.request.body as any)?.data || ctx.request.body || {};
    const doctorIds: string[] = body.doctorIds || [];

    // Fetch document with owner check
    const doc = await strapi.documents('api::medical-document.medical-document').findOne({
      documentId: id,
      populate: ['user', 'sharedWithDoctors'],
    });

    if (!doc) return ctx.notFound('Document not found');

    // Only the document owner (patient) or admin can share
    const isAdmin = user.role?.type === 'admin' || user.userRole === 'admin';
    if (!isAdmin && (doc as any).user?.id !== user.id) {
      return ctx.forbidden('Only the document owner can manage sharing');
    }

    // Validate that all doctorIds are real doctors
    if (doctorIds.length > 0) {
      const validDoctors = await strapi.documents('api::doctor.doctor').findMany({
        filters: { documentId: { $in: doctorIds } },
        fields: ['id', 'documentId'],
      });
      const validIds = new Set(validDoctors.map((d: any) => d.documentId));
      const invalid = doctorIds.filter(id => !validIds.has(id));
      if (invalid.length > 0) {
        return ctx.badRequest('Some doctor IDs are invalid');
      }
    }

    // Update sharedWithDoctors
    const updated = await strapi.documents('api::medical-document.medical-document').update({
      documentId: id,
      data: {
        sharedWithDoctors: doctorIds,
      } as any,
      status: 'published',
      populate: ['file', 'user', 'doctor', 'appointment', 'medical_case', 'sharedWithDoctors'] as any,
    });

    return { data: updated };
  },

  /**
   * Get list of doctors the patient has had appointments with (for sharing UI).
   * GET /api/medical-documents/my-doctors
   */
  async myDoctors(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');

    // Get all appointments for this patient to find their doctors
    const appointments = await strapi.documents('api::appointment.appointment').findMany({
      filters: { patient: { id: user.id } },
      populate: {
        doctor: { populate: ['specialization', 'photo'] },
      } as any,
    });

    // Extract unique doctors
    const doctorMap = new Map<number, any>();
    for (const apt of appointments) {
      const dr = (apt as any).doctor;
      if (dr && !doctorMap.has(dr.id)) {
        doctorMap.set(dr.id, {
          id: dr.id,
          documentId: dr.documentId,
          fullName: dr.fullName,
          specialization: dr.specialization,
          photo: dr.photo,
        });
      }
    }

    return { data: Array.from(doctorMap.values()) };
  },
}));
