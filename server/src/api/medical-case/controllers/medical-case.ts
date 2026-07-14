import { factories } from '@strapi/strapi';
import { getMedicalCaseAccessFilter, getUserRole, isAdminUser } from '../../../utils/medtour-access';
import {
  canTransitionCaseStatus,
  getAllowedCaseTransitions,
  isMedicalCaseStatus,
  normalizeCaseStatus,
} from '../../../utils/medical-case-workflow';
import { sendCaseStatusEmail, sendNewLeadEmailToStaff } from '../../../utils/case-email';
import { PATIENT_VISIBLE_CASE_EVENT_TYPES } from '../../../utils/case-event-policy';

const DEFAULT_POPULATE = {
  patient: { fields: ['id', 'documentId', 'fullName', 'email', 'phone', 'country', 'language', 'timezone'] },
  manager: { fields: ['id', 'documentId', 'fullName', 'email', 'phone'] },
  coordinator: { fields: ['id', 'documentId', 'fullName', 'email', 'phone'] },
  clinic: true,
  doctor: { populate: ['specialization', 'photo', 'clinic'] },
  medical_documents: {
    populate: {
      file: true,
      doctor: { fields: ['id', 'documentId', 'fullName'] },
      appointment: { fields: ['id', 'documentId', 'dateTime', 'statuse'] },
    },
  },
  appointments: {
    populate: {
      doctor: { populate: ['specialization'] },
    },
  },
  treatment_plans: { populate: ['clinic', 'doctor'] },
  trip_checklist: true,
  visa_requests: true,
  tourism_packages: true,
  conversation: true,
  case_events: { populate: { actor: { fields: ['id', 'documentId', 'fullName', 'email', 'userRole'] } } },
} as any;

const STAFF_ROLES = ['manager', 'coordinator', 'admin'];

const CASE_FIELDS_BY_ROLE: Record<string, string[]> = {
  doctor: [
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
    'doctorRecommendation',
    'doctorDecisionNotes',
    'createdAt',
    'updatedAt',
  ],
};

const DOCTOR_DOCUMENT_FIELDS = [
  'id',
  'documentId',
  'title',
  'type',
  'description',
  'reviewStatus',
  'reviewNotes',
  'dueDate',
  'createdAt',
  'updatedAt',
  'file',
  'doctor',
  'appointment',
];

const FIELD_ALLOWLIST_BY_ROLE: Record<string, string[]> = {
  patient: [
    'title',
    'country',
    'language',
    'timezone',
    'diagnosis',
    'symptoms',
    'treatmentCategory',
    'desiredDates',
    'urgency',
    'budgetRange',
    'preferredContact',
    'leadSource',
    'leadMedium',
    'leadCampaign',
    'leadReferrer',
    'visaSupportNeeded',
    'currentTreatment',
    'tourismRequested',
  ],
  doctor: ['status', 'doctorRecommendation', 'doctorDecisionNotes'],
  manager: [
    'status',
    'manager',
    'coordinator',
    'clinic',
    'doctor',
    'arrivalDate',
    'departureDate',
    'flightDetails',
    'hotelName',
    'budgetRange',
    'preferredContact',
    'leadSource',
    'leadMedium',
    'leadCampaign',
    'leadReferrer',
    'visaSupportNeeded',
    'tourismRequested',
    'tourismNotes',
    'internalNotes',
    'doctorRecommendation',
    'doctorDecisionNotes',
    'commissionDecision',
    'commissionDecisionNotes',
    'cancellationReason',
  ],
  coordinator: [
    'status',
    'doctor',
    'coordinator',
    'treatmentCategory',
    'urgency',
    'currentTreatment',
    'internalNotes',
    'doctorRecommendation',
    'doctorDecisionNotes',
    'commissionDecision',
    'commissionDecisionNotes',
    'cancellationReason',
  ],
  admin: ['*'],
};

async function resolveUserDocumentId(strapi: any, value: any) {
  if (value === null) return null;
  if (value === undefined || value === '') return undefined;
  if (typeof value === 'number') {
    const found = await strapi.query('plugin::users-permissions.user').findOne({ where: { id: value } });
    return found?.documentId;
  }
  return value;
}

function buildCaseNumber() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `MT-${date}-${suffix}`;
}

function pickAllowedFields(data: Record<string, any>, role: string) {
  const allowed = FIELD_ALLOWLIST_BY_ROLE[role] || [];
  if (allowed.includes('*')) return { ...data };
  return Object.fromEntries(Object.entries(data).filter(([key]) => allowed.includes(key)));
}

function pickObjectFields(value: any, fields: string[]) {
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(fields
    .filter((field) => Object.prototype.hasOwnProperty.call(value, field))
    .map((field) => [field, value[field]]));
}

function hasAssignmentChange(data: Record<string, any>) {
  return ['manager', 'coordinator', 'clinic', 'doctor'].some((key) => Object.prototype.hasOwnProperty.call(data, key));
}

const CASE_DECISIONS = ['treatment_in_kazakhstan', 'local_treatment', 'needs_more_documents'];
const PREFERRED_CONTACT_METHODS = ['phone', 'whatsapp', 'telegram', 'email', 'instagram'];
const MAX_CUSTOM_CONTACT_LENGTH = 80;
const COMMISSION_STATUS_DECISIONS: Record<string, string> = {
  TREATMENT_IN_KAZAKHSTAN: 'treatment_in_kazakhstan',
  LOCAL_TREATMENT: 'local_treatment',
  WAITING_FOR_DOCUMENTS: 'needs_more_documents',
};

function validateCaseDecision(value: any, field: string) {
  if (value === undefined || value === null || value === '') return null;
  if (!CASE_DECISIONS.includes(value)) return `${field} must be one of: ${CASE_DECISIONS.join(', ')}`;
  return null;
}

function validatePreferredArrivalDate(desiredDates: any) {
  if (desiredDates === undefined || desiredDates === null) return null;
  const value = typeof desiredDates === 'string'
    ? desiredDates
    : desiredDates?.preferredArrivalDate;
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return 'preferredArrivalDate must use YYYY-MM-DD with a four-digit year';
  }
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return 'preferredArrivalDate must be a valid calendar date';
  }
  return null;
}

function validatePreferredContact(value: any, required = false) {
  if (value === undefined || value === null || String(value).trim() === '') {
    return required ? 'preferredContact is required' : null;
  }
  if (typeof value !== 'string') return 'preferredContact must be a string';
  const normalized = value.trim();
  if (PREFERRED_CONTACT_METHODS.includes(normalized)) return null;
  if (normalized.startsWith('other:')) {
    const customValue = normalized.slice('other:'.length).trim();
    if (!customValue) return 'Custom preferredContact is required';
    if (customValue.length > MAX_CUSTOM_CONTACT_LENGTH) {
      return `Custom preferredContact must not exceed ${MAX_CUSTOM_CONTACT_LENGTH} characters`;
    }
    return null;
  }
  return `preferredContact must be one of: ${[...PREFERRED_CONTACT_METHODS, 'other'].join(', ')}`;
}

function redactCaseForRole(medicalCase: any, role: string) {
  if (['manager', 'admin'].includes(role)) return medicalCase;
  if (Array.isArray(medicalCase)) {
    return medicalCase.map((item) => redactCaseForRole(item, role));
  }
  if (!medicalCase || typeof medicalCase !== 'object') return medicalCase;
  if (role === 'patient') {
    return {
      ...medicalCase,
      internalNotes: undefined,
      doctorRecommendation: undefined,
      doctorDecisionNotes: undefined,
      commissionDecision: undefined,
      commissionDecisionNotes: undefined,
      appointments: Array.isArray(medicalCase.appointments)
        ? medicalCase.appointments.map((appointment: any) => {
          const { doctorDecision, doctorDecisionNotes, ...publicAppointment } = appointment;
          return publicAppointment;
        })
        : [],
      case_events: Array.isArray(medicalCase.case_events)
        ? medicalCase.case_events
          .filter((event: any) => PATIENT_VISIBLE_CASE_EVENT_TYPES.includes(event?.eventType))
          .map((event: any) => ({
            ...event,
            actor: event.actor ? pickObjectFields(event.actor, ['id', 'documentId', 'fullName', 'userRole']) : null,
          }))
        : [],
      clinic: null,
    };
  }
  if (role === 'doctor') {
    return {
      ...pickObjectFields(medicalCase, CASE_FIELDS_BY_ROLE.doctor),
      patient: medicalCase.patient
        ? pickObjectFields(medicalCase.patient, ['id', 'documentId', 'fullName'])
        : null,
      doctor: medicalCase.doctor || null,
      medical_documents: Array.isArray(medicalCase.medical_documents)
        ? medicalCase.medical_documents.map((doc: any) => pickObjectFields(doc, DOCTOR_DOCUMENT_FIELDS))
        : [],
      appointments: Array.isArray(medicalCase.appointments)
        ? medicalCase.appointments.map((appointment: any) => pickObjectFields(appointment, [
          'id',
          'documentId',
          'dateTime',
          'type',
          'statuse',
          'roomId',
          'consultationPurpose',
          'chatLog',
          'doctorDecision',
          'doctorDecisionNotes',
        ]))
        : [],
      treatment_plans: medicalCase.treatment_plans || [],
      case_events: Array.isArray(medicalCase.case_events)
        ? medicalCase.case_events.map((event: any) => ({
          ...pickObjectFields(event, [
            'id',
            'documentId',
            'eventType',
            'fromStatus',
            'toStatus',
            'message',
            'metadata',
            'createdAt',
          ]),
          actor: event.actor ? pickObjectFields(event.actor, ['id', 'documentId', 'fullName', 'userRole']) : null,
        }))
        : [],
      manager: null,
      coordinator: null,
      clinic: null,
      trip_checklist: null,
      visa_requests: [],
      tourism_packages: [],
      conversation: null,
    };
  }
  return { ...medicalCase, clinic: null };
}

async function createCaseEvent(
  strapi: any,
  payload: Record<string, any>,
  options: { required?: boolean } = {},
) {
  try {
    return await strapi.documents('api::case-event.case-event').create({ data: payload });
  } catch (error) {
    strapi.log.error('medical-case case-event create failed:', error);
    if (options.required) throw error;
    return null;
  }
}

async function connectConversationMembers(strapi: any, conversationId: number, participants: any[]) {
  const ids = participants.map((participant) => participant?.id).filter(Boolean);
  for (const participantId of ids) {
    await strapi.query('plugin::users-permissions.user').update({
      where: { id: participantId },
      data: { conversations: { connect: [conversationId] } } as any,
    });
  }
}

async function ensureCaseConversation(strapi: any, medicalCase: any) {
  if (!medicalCase?.documentId && !medicalCase?.id) return null;

  const existing = await strapi.documents('api::conversation.conversation' as any).findMany({
    filters: { medical_case: { documentId: medicalCase.documentId } },
    limit: 1,
  });
  if (existing[0]) return existing[0];

  const created = await strapi.documents('api::conversation.conversation' as any).create({
    data: {
      channel: 'case',
      lifecycleStatus: 'open',
      sharedQueue: true,
      doctorChatEnabled: false,
      medical_case: medicalCase.documentId || medicalCase.id,
      lastMessageAt: new Date().toISOString(),
    },
    status: 'published',
  });

  await connectConversationMembers(strapi, created.id, [
    medicalCase.patient,
    medicalCase.manager,
    medicalCase.coordinator,
  ]);

  return created;
}

async function includeAppointmentDocuments(strapi: any, medicalCase: any) {
  const appointments = Array.isArray(medicalCase?.appointments) ? medicalCase.appointments : [];
  const appointmentDocumentIds = appointments
    .map((appointment: any) => appointment?.documentId)
    .filter(Boolean);

  if (appointmentDocumentIds.length === 0) return medicalCase;

  try {
    const appointmentDocs = await strapi.documents('api::medical-document.medical-document' as any).findMany({
      filters: { appointment: { documentId: { $in: appointmentDocumentIds } } },
      // Conclusion documents are patient-visible, internal appointment fields
      // are not. Keep the nested appointment projection intentionally narrow.
      populate: {
        file: true,
        user: { fields: ['id', 'documentId', 'fullName'] },
        doctor: { fields: ['id', 'documentId', 'fullName'] },
        appointment: { fields: ['id', 'documentId', 'dateTime', 'statuse', 'type', 'consultationPurpose'] },
        medical_case: { fields: ['id', 'documentId', 'caseNumber', 'status'] },
        sharedWithDoctors: { fields: ['id', 'documentId', 'fullName'] },
      } as any,
    });
    const seen = new Set((medicalCase.medical_documents || []).map((doc: any) => doc.documentId || doc.id));
    const mergedDocs = [...(medicalCase.medical_documents || [])];
    for (const doc of appointmentDocs as any[]) {
      const docKey = doc.documentId || doc.id;
      if (!seen.has(docKey)) {
        seen.add(docKey);
        mergedDocs.push(doc);
      }
    }
    return { ...medicalCase, medical_documents: mergedDocs };
  } catch (error) {
    strapi.log.warn(`medical-case includeAppointmentDocuments failed for ${medicalCase.documentId}: ${(error as any)?.message}`);
    return medicalCase;
  }
}

export default factories.createCoreController('api::medical-case.medical-case' as any, () => ({
  async find(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');

    const filters = await getMedicalCaseAccessFilter(strapi, user);
    if (filters === null) {
      return { data: [], meta: { pagination: { page: 1, pageSize: 0, pageCount: 0, total: 0 } } };
    }

    const queryFilters = (ctx.query?.filters as any) || {};
    const data = await strapi.documents('api::medical-case.medical-case' as any).findMany({
      filters: isAdminUser(user) ? queryFilters : { ...queryFilters, ...filters },
      sort: (ctx.query?.sort as any) || ['createdAt:desc'],
      populate: DEFAULT_POPULATE,
    });
    const role = getUserRole(user);

    return {
      data: redactCaseForRole(data, role),
      meta: { pagination: { page: 1, pageSize: data.length, pageCount: 1, total: data.length } },
    };
  },

  async findOne(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');

    const filters = await getMedicalCaseAccessFilter(strapi, user);
    if (filters === null) return ctx.notFound('Medical case not found');

    const cases = await strapi.documents('api::medical-case.medical-case' as any).findMany({
      filters: isAdminUser(user) ? { documentId: ctx.params.id } : { documentId: ctx.params.id, ...filters },
      limit: 1,
      populate: DEFAULT_POPULATE,
    });

    const medicalCase = cases[0];
    if (!medicalCase) return ctx.notFound('Medical case not found');
    const role = getUserRole(user);
    return { data: redactCaseForRole(await includeAppointmentDocuments(strapi, medicalCase), role) };
  },

  async create(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');

    const role = getUserRole(user);
    if (!['patient', ...STAFF_ROLES].includes(role)) {
      return ctx.forbidden('Only patients and MedTour staff can create medical cases');
    }

    const body = ((ctx.request.body as any)?.data || ctx.request.body || {}) as any;
    const allowedBody = isAdminUser(user) ? { ...body } : pickAllowedFields(body, role);
    const requestedStatus = allowedBody.status || (role === 'patient' ? 'WAITING_FOR_DOCUMENTS' : 'NEW_LEAD');
    const normalizedStatus = normalizeCaseStatus(requestedStatus);
    const data = {
      ...allowedBody,
      caseNumber: isAdminUser(user) && body.caseNumber ? body.caseNumber : buildCaseNumber(),
      status: normalizedStatus,
    } as any;

    if (!normalizedStatus || !isMedicalCaseStatus(data.status)) {
      return ctx.badRequest('Invalid medical case status');
    }
    const createDoctorRecommendationError = validateCaseDecision(data.doctorRecommendation, 'doctorRecommendation');
    if (createDoctorRecommendationError) return ctx.badRequest(createDoctorRecommendationError);
    const createCommissionDecisionError = validateCaseDecision(data.commissionDecision, 'commissionDecision');
    if (createCommissionDecisionError) return ctx.badRequest(createCommissionDecisionError);
    const createArrivalDateError = validatePreferredArrivalDate(data.desiredDates);
    if (createArrivalDateError) return ctx.badRequest(createArrivalDateError);
    const createPreferredContactError = validatePreferredContact(data.preferredContact, role === 'patient');
    if (createPreferredContactError) return ctx.badRequest(createPreferredContactError);
    if (typeof data.preferredContact === 'string') data.preferredContact = data.preferredContact.trim();

    if (role === 'patient') {
      data.patient = user.documentId;
      data.status = 'WAITING_FOR_DOCUMENTS';
    } else if (body.patient) {
      data.patient = await resolveUserDocumentId(strapi, body.patient);
    }

    const created = await strapi.db.transaction(async () => {
      const saved = await strapi.documents('api::medical-case.medical-case' as any).create({
        data,
        status: 'published',
        populate: DEFAULT_POPULATE,
      });
      await createCaseEvent(strapi, {
        medical_case: saved.documentId || saved.id,
        actor: user.documentId || user.id,
        eventType: 'CREATED',
        toStatus: saved.status || 'NEW_LEAD',
        message: 'Medical case created',
        metadata: { role },
      }, { required: true });
      return saved;
    });

    try {
      await ensureCaseConversation(strapi, created);
    } catch (error) {
      strapi.log.error('medical-case conversation create failed:', error);
    }

    // Notify staff about the new lead (async — don't block response)
    sendNewLeadEmailToStaff(strapi, created as any).catch(() => {});

    return { data: redactCaseForRole(created, role) };
  },

  async update(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');

    const filters = await getMedicalCaseAccessFilter(strapi, user);
    if (filters === null) return ctx.notFound('Medical case not found');

    const existing = await strapi.documents('api::medical-case.medical-case' as any).findMany({
      filters: isAdminUser(user) ? { documentId: ctx.params.id } : { documentId: ctx.params.id, ...filters },
      limit: 1,
    });
    const existingCase = existing[0];
    if (!existingCase) return ctx.notFound('Medical case not found');

    const role = getUserRole(user);
    const body = ((ctx.request.body as any)?.data || ctx.request.body || {}) as any;
    const data = pickAllowedFields(body, role);

    if (body.status && !data.status) {
      return ctx.forbidden('This role cannot change medical case status');
    }
    const doctorRecommendationError = validateCaseDecision(data.doctorRecommendation, 'doctorRecommendation');
    if (doctorRecommendationError) return ctx.badRequest(doctorRecommendationError);
    const commissionDecisionError = validateCaseDecision(data.commissionDecision, 'commissionDecision');
    if (commissionDecisionError) return ctx.badRequest(commissionDecisionError);
    const arrivalDateError = validatePreferredArrivalDate(data.desiredDates);
    if (arrivalDateError) return ctx.badRequest(arrivalDateError);
    if (data.preferredContact !== undefined) {
      const preferredContactError = validatePreferredContact(data.preferredContact, role === 'patient');
      if (preferredContactError) return ctx.badRequest(preferredContactError);
      data.preferredContact = data.preferredContact.trim();
    }

    if (data.status !== undefined) {
      const normalizedToStatus = normalizeCaseStatus(data.status);
      if (!normalizedToStatus || !isMedicalCaseStatus(normalizedToStatus)) {
        return ctx.badRequest('Invalid medical case status');
      }

      const fromStatus = normalizeCaseStatus((existingCase as any).status) || 'NEW_LEAD';
      const toStatus = normalizedToStatus;
      data.status = normalizedToStatus;
      if (!canTransitionCaseStatus(role, fromStatus, toStatus)) {
        const allowed = getAllowedCaseTransitions(role, fromStatus).join(', ') || 'none';
        return ctx.badRequest(`Invalid status transition ${fromStatus} -> ${toStatus}. Allowed for ${role}: ${allowed}`);
      }
      if (role === 'doctor' && toStatus === 'COMMISSION_REVIEW') {
        if (!data.doctorRecommendation || !String(data.doctorDecisionNotes || '').trim()) {
          return ctx.badRequest('Doctor recommendation and notes are required before commission review');
        }
      }
      if (fromStatus === 'COMMISSION_REVIEW' && COMMISSION_STATUS_DECISIONS[toStatus]) {
        const expectedDecision = COMMISSION_STATUS_DECISIONS[toStatus];
        if (data.commissionDecision !== expectedDecision || !String(data.commissionDecisionNotes || '').trim()) {
          return ctx.badRequest('Commission decision and notes are required before finalizing the case');
        }
      }
    }

    if (Object.prototype.hasOwnProperty.call(data, 'manager')) {
      data.manager = await resolveUserDocumentId(strapi, data.manager);
    }
    if (Object.prototype.hasOwnProperty.call(data, 'coordinator')) {
      data.coordinator = await resolveUserDocumentId(strapi, data.coordinator);
    }

    const previousStatus = normalizeCaseStatus((existingCase as any).status) || (existingCase as any).status;
    const isDoctorDecision = role === 'doctor'
      && previousStatus !== 'COMMISSION_REVIEW'
      && data.status === 'COMMISSION_REVIEW';
    const isCommissionDecision = previousStatus === 'COMMISSION_REVIEW' && !!COMMISSION_STATUS_DECISIONS[data.status];
    let updated: any;

    try {
      // Status, assignment and decision events form one business operation. Strapi's
      // transaction context automatically binds both Document Service calls to the
      // same DB transaction, so a failed audit event cannot leave a half-saved case.
      updated = await strapi.db.transaction(async () => {
        const saved = await strapi.documents('api::medical-case.medical-case' as any).update({
          documentId: ctx.params.id,
          data,
          status: 'published',
          populate: DEFAULT_POPULATE,
        });

        if (data.status && data.status !== previousStatus) {
          await createCaseEvent(strapi, {
            medical_case: saved.documentId || saved.id,
            actor: user.documentId || user.id,
            eventType: 'STATUS_CHANGED',
            fromStatus: previousStatus,
            toStatus: data.status,
            message: `Status changed from ${previousStatus} to ${data.status}`,
            metadata: { role },
          }, { required: true });
        }

        if (isDoctorDecision) {
          await createCaseEvent(strapi, {
            medical_case: saved.documentId || saved.id,
            actor: user.documentId || user.id,
            eventType: 'DOCTOR_DECISION',
            fromStatus: previousStatus,
            toStatus: data.status,
            message: 'Doctor submitted a recommendation for commission review.',
            metadata: { decision: data.doctorRecommendation },
          }, { required: true });
        }

        if (isCommissionDecision) {
          await createCaseEvent(strapi, {
            medical_case: saved.documentId || saved.id,
            actor: user.documentId || user.id,
            eventType: 'COMMISSION_DECISION',
            fromStatus: previousStatus,
            toStatus: data.status,
            message: 'Commission finalized the medical case decision.',
            metadata: { decision: data.commissionDecision },
          }, { required: true });
        }

        if (hasAssignmentChange(data)) {
          await createCaseEvent(strapi, {
            medical_case: saved.documentId || saved.id,
            actor: user.documentId || user.id,
            eventType: 'ASSIGNED',
            fromStatus: previousStatus,
            toStatus: saved.status,
            message: 'Case assignment updated',
            metadata: {
              role,
              changedFields: Object.keys(data).filter((field) => ['manager', 'coordinator', 'clinic', 'doctor'].includes(field)),
            },
          }, { required: true });
        }

        return saved;
      });
    } catch (error) {
      strapi.log.error(`medical-case atomic update failed for ${ctx.params.id}:`, error);
      return ctx.internalServerError('Medical case update failed. No changes were saved.');
    }

    if (data.status && data.status !== previousStatus) {
      // Notifications are intentionally sent only after the DB transaction commits.
      sendCaseStatusEmail(strapi, updated as any, data.status).catch(() => {});
    }

    if (data.status === 'DOCTOR_ASSIGNED' && data.doctor) {
      // Also email when doctor is newly assigned even if status didn't change
      sendCaseStatusEmail(strapi, updated as any, 'DOCTOR_ASSIGNED').catch(() => {});
    }

    return { data: redactCaseForRole(updated, role) };
  },
}));
