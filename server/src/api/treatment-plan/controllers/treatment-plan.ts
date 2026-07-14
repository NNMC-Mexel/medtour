import { factories } from '@strapi/strapi';
import { getMedicalCaseAccessFilter, getUserRole, isAdminUser, userCanAccessMedicalCase } from '../../../utils/medtour-access';
import { normalizeCaseStatus } from '../../../utils/medical-case-workflow';

const UID = 'api::treatment-plan.treatment-plan' as any;

// Fields a clinician (doctor / coordinator / admin) may set on CREATE.
// Excludes status, sentAt, acceptedAt, declinedAt — those are set by the
// state machine (create => DRAFT, then update transitions). Preventing the
// caller from forcing status:'ACCEPTED' bypasses the patient-consent step.
const CREATE_ALLOWED_FIELDS = [
  'medical_case',
  'diagnosisSummary',
  'doctorDecisionNotes',
  'procedures',
  'estimatedDurationDays',
  'totalCost',
  'currency',
  'attachments',
  'translationStatus',
  'internalNotes',
];

// Fields a clinician (doctor / coordinator / admin) may set on UPDATE.
// Note: medical_case is intentionally excluded — you cannot move a plan to a
// different case. status is whitelisted but constrained below to DRAFT/SENT.
const STAFF_UPDATE_ALLOWED_FIELDS = [
  'status',
  'diagnosisSummary',
  'doctorDecisionNotes',
  'procedures',
  'estimatedDurationDays',
  'totalCost',
  'currency',
  'attachments',
  'translationStatus',
  'internalNotes',
  'sentAt',
];

// ACCEPTED / DECLINED are the patient's decision and must come through the
// patient branch (which verifies the plan is in SENT state). Letting staff set
// them directly would bypass the patient-consent step required for informed
// consent under the RK health code.
const STAFF_ALLOWED_STATUSES = ['DRAFT', 'SENT'];

function pickAllowedFields(body: Record<string, any>, allowed: string[]): Record<string, any> {
  const out: Record<string, any> = {};
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(body, key) && body[key] !== undefined) {
      out[key] = body[key];
    }
  }
  return out;
}

export default factories.createCoreController(UID, () => ({
  async find(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');
    const caseFilter = await getMedicalCaseAccessFilter(strapi, user);
    if (caseFilter === null) return { data: [], meta: { pagination: { page: 1, pageSize: 0, pageCount: 0, total: 0 } } };
    const queryFilters = (ctx.query?.filters as any) || {};
    const data = await strapi.documents(UID).findMany({
      filters: isAdminUser(user) ? queryFilters : { ...queryFilters, medical_case: caseFilter },
      sort: (ctx.query?.sort as any) || ['createdAt:desc'],
      populate: '*',
    });
    return { data, meta: { pagination: { page: 1, pageSize: data.length, pageCount: 1, total: data.length } } };
  },

  async findOne(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');
    const item = await strapi.documents(UID).findOne({ documentId: ctx.params.id, populate: { medical_case: true } });
    if (!item) return ctx.notFound('Treatment plan not found');
    if (!(await userCanAccessMedicalCase(strapi, user, (item as any).medical_case))) return ctx.forbidden('Forbidden');
    return { data: item };
  },

  async create(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');
    const role = getUserRole(user);
    if (!['doctor', 'coordinator', 'admin'].includes(role)) {
      return ctx.forbidden('Only doctors, coordinators and admins can create treatment plans');
    }
    const body = (ctx.request.body as any)?.data || ctx.request.body || {};
    if (!(await userCanAccessMedicalCase(strapi, user, body.medical_case))) return ctx.forbidden('Forbidden');

    // Whitelist input. Status is ALWAYS forced to DRAFT on create — moving
    // to SENT or ACCEPTED happens through the update endpoint which enforces
    // the patient-consent FSM. Without this, a doctor could publish a plan
    // already in ACCEPTED state and skip the patient's explicit confirmation.
    const data = {
      ...pickAllowedFields(body, CREATE_ALLOWED_FIELDS),
      status: 'DRAFT',
    };

    const item = await strapi.documents(UID).create({ data, status: 'published', populate: '*' });
    return { data: item };
  },

  async update(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');
    const existing = await strapi.documents(UID).findOne({ documentId: ctx.params.id, populate: { medical_case: true } });
    if (!existing) return ctx.notFound('Treatment plan not found');
    if (!(await userCanAccessMedicalCase(strapi, user, (existing as any).medical_case))) return ctx.forbidden('Forbidden');
    const body = (ctx.request.body as any)?.data || ctx.request.body || {};
    const role = getUserRole(user);
    let data: Record<string, any>;

    if (role === 'patient') {
      if (!['ACCEPTED', 'DECLINED'].includes(body.status)) {
        return ctx.badRequest('Patients can only accept or decline a sent treatment plan');
      }
      if ((existing as any).status !== 'SENT') {
        return ctx.badRequest('Only sent treatment plans can be accepted or declined');
      }
      data = {
        status: body.status,
        ...(body.status === 'ACCEPTED' ? { acceptedAt: new Date().toISOString() } : {}),
      };
    } else if (['doctor', 'coordinator', 'admin'].includes(role)) {
      // Whitelist input — without this a doctor could PUT status:'ACCEPTED'
      // and acceptedAt directly, faking the patient's consent.
      data = pickAllowedFields(body, STAFF_UPDATE_ALLOWED_FIELDS);
      if (data.status !== undefined && !STAFF_ALLOWED_STATUSES.includes(data.status)) {
        return ctx.badRequest(
          'Staff can only set treatment plan status to DRAFT or SENT. ACCEPTED/DECLINED is the patient decision.'
        );
      }
    } else {
      return ctx.forbidden('Forbidden');
    }

    if (data.status === 'SENT') {
      const merged = { ...(existing as any), ...data };
      const missing = ['diagnosisSummary', 'doctorDecisionNotes', 'procedures', 'estimatedDurationDays', 'totalCost']
        .filter((field) => merged[field] === undefined || merged[field] === null || merged[field] === '' || (Array.isArray(merged[field]) && merged[field].length === 0));
      if (missing.length > 0) return ctx.badRequest(`Cannot send treatment plan. Missing: ${missing.join(', ')}`);
      if (!(existing as any).sentAt && !data.sentAt) data.sentAt = new Date().toISOString();
    }

    const caseStatus = normalizeCaseStatus((existing as any).medical_case?.status);
    const caseDocumentId = (existing as any).medical_case?.documentId;
    const isPatientDecision = role === 'patient' && ['ACCEPTED', 'DECLINED'].includes(data.status);
    let nextCaseStatus: string | undefined;
    if (isPatientDecision && caseStatus === 'WAITING_PATIENT_CONFIRMATION') {
      nextCaseStatus = data.status === 'ACCEPTED' ? 'WAITING_PAYMENT' : 'DOCTOR_ASSIGNED';
    } else if (isPatientDecision && data.status === 'ACCEPTED' && caseStatus === 'TREATMENT_IN_KAZAKHSTAN') {
      nextCaseStatus = 'TRAVEL_PREPARATION';
    }

    const item = await strapi.db.transaction(async () => {
      const saved = await strapi.documents(UID).update({
        documentId: ctx.params.id,
        data,
        status: 'published',
        populate: '*',
      });

      if (nextCaseStatus && caseDocumentId) {
        await strapi.documents('api::medical-case.medical-case' as any).update({
          documentId: caseDocumentId,
          data: { status: nextCaseStatus } as any,
          status: 'published',
        });
      }

      if (isPatientDecision && caseDocumentId) {
        await strapi.documents('api::case-event.case-event' as any).create({
          data: {
            medical_case: caseDocumentId,
            actor: user.documentId || user.id,
            eventType: data.status === 'ACCEPTED' ? 'PLAN_ACCEPTED' : 'PLAN_DECLINED',
            fromStatus: caseStatus,
            toStatus: nextCaseStatus || caseStatus,
            message: data.status === 'ACCEPTED'
              ? 'Patient accepted the treatment plan.'
              : 'Patient declined the treatment plan.',
            metadata: { planId: (existing as any).documentId || (existing as any).id },
          },
        });
      }

      return saved;
    });

    return { data: item };
  },
}));
