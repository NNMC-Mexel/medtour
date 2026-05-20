import { factories } from '@strapi/strapi';
import { getMedicalCaseAccessFilter, getUserRole, isAdminUser } from '../../../utils/medtour-access';
import {
  canTransitionCaseStatus,
  getAllowedCaseTransitions,
  isMedicalCaseStatus,
  normalizeCaseStatus,
} from '../../../utils/medical-case-workflow';

const DEFAULT_POPULATE = {
  patient: { fields: ['id', 'documentId', 'fullName', 'email', 'phone', 'country', 'language', 'timezone'] },
  manager: { fields: ['id', 'documentId', 'fullName', 'email', 'phone'] },
  coordinator: { fields: ['id', 'documentId', 'fullName', 'email', 'phone'] },
  clinic: true,
  doctor: { populate: ['specialization', 'photo', 'clinic'] },
  medical_documents: { populate: ['file'] },
  appointments: { populate: ['doctor'] },
  treatment_plans: { populate: ['clinic', 'doctor'] },
  trip_checklist: true,
  visa_requests: true,
  tourism_packages: true,
  conversation: true,
} as any;

const STAFF_ROLES = ['manager', 'coordinator', 'admin'];

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
    'visaSupportNeeded',
    'currentTreatment',
    'tourismRequested',
    'tourismNotes',
    'cancellationReason',
  ],
  doctor: ['status', 'internalNotes'],
  manager: [
    'status',
    'manager',
    'coordinator',
    'arrivalDate',
    'departureDate',
    'flightDetails',
    'hotelName',
    'budgetRange',
    'preferredContact',
    'visaSupportNeeded',
    'tourismRequested',
    'tourismNotes',
    'internalNotes',
    'cancellationReason',
  ],
  coordinator: [
    'status',
    'clinic',
    'doctor',
    'coordinator',
    'treatmentCategory',
    'urgency',
    'currentTreatment',
    'internalNotes',
    'cancellationReason',
  ],
  admin: ['*'],
};

async function resolveUserDocumentId(strapi: any, value: any) {
  if (!value) return undefined;
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

function hasAssignmentChange(data: Record<string, any>) {
  return ['manager', 'coordinator', 'clinic', 'doctor'].some((key) => Object.prototype.hasOwnProperty.call(data, key));
}

async function createCaseEvent(strapi: any, payload: Record<string, any>) {
  try {
    await strapi.documents('api::case-event.case-event').create({ data: payload });
  } catch (error) {
    strapi.log.error('medical-case case-event create failed:', error);
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

    return {
      data,
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
    return { data: medicalCase };
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

    if (role === 'patient') {
      data.patient = user.documentId;
      data.status = 'WAITING_FOR_DOCUMENTS';
    } else if (body.patient) {
      data.patient = await resolveUserDocumentId(strapi, body.patient);
    }

    const created = await strapi.documents('api::medical-case.medical-case' as any).create({
      data,
      status: 'published',
      populate: DEFAULT_POPULATE,
    });

    await createCaseEvent(strapi, {
      medical_case: created.documentId || created.id,
      actor: user.documentId || user.id,
      eventType: 'CREATED',
      toStatus: created.status || 'NEW_LEAD',
      message: 'Medical case created',
      metadata: { role },
    });

    return { data: created };
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
    }

    const updated = await strapi.documents('api::medical-case.medical-case' as any).update({
      documentId: ctx.params.id,
      data,
      status: 'published',
      populate: DEFAULT_POPULATE,
    });

    const previousStatus = normalizeCaseStatus((existingCase as any).status) || (existingCase as any).status;
    if (data.status && data.status !== previousStatus) {
      await createCaseEvent(strapi, {
        medical_case: updated.documentId || updated.id,
        actor: user.documentId || user.id,
        eventType: 'STATUS_CHANGED',
        fromStatus: previousStatus,
        toStatus: data.status,
        message: `Status changed from ${previousStatus} to ${data.status}`,
        metadata: { role },
      });
    }

    if (hasAssignmentChange(data)) {
      await createCaseEvent(strapi, {
        medical_case: updated.documentId || updated.id,
        actor: user.documentId || user.id,
        eventType: 'ASSIGNED',
        fromStatus: previousStatus,
        toStatus: updated.status,
        message: 'Case assignment updated',
        metadata: {
          role,
          changedFields: Object.keys(data).filter((field) => ['manager', 'coordinator', 'clinic', 'doctor'].includes(field)),
        },
      });
    }

    return { data: updated };
  },
}));
