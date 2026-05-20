import { factories } from '@strapi/strapi';
import { getMedicalCaseAccessFilter, getUserRole, isAdminUser, userCanAccessMedicalCase } from '../../../utils/medtour-access';
import { normalizeCaseStatus } from '../../../utils/medical-case-workflow';

const UID = 'api::treatment-plan.treatment-plan' as any;

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
    if (body.status === 'SENT') {
      const missing = ['diagnosisSummary', 'doctorDecisionNotes', 'procedures', 'estimatedDurationDays', 'totalCost']
        .filter((field) => body[field] === undefined || body[field] === null || body[field] === '' || (Array.isArray(body[field]) && body[field].length === 0));
      if (missing.length > 0) return ctx.badRequest(`Cannot send treatment plan. Missing: ${missing.join(', ')}`);
    }
    const item = await strapi.documents(UID).create({ data: body, status: 'published', populate: '*' });
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
    let data = body;

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
    } else if (!['doctor', 'coordinator', 'admin'].includes(role)) {
      return ctx.forbidden('Forbidden');
    }

    if (data.status === 'SENT') {
      const merged = { ...(existing as any), ...data };
      const missing = ['diagnosisSummary', 'doctorDecisionNotes', 'procedures', 'estimatedDurationDays', 'totalCost']
        .filter((field) => merged[field] === undefined || merged[field] === null || merged[field] === '' || (Array.isArray(merged[field]) && merged[field].length === 0));
      if (missing.length > 0) return ctx.badRequest(`Cannot send treatment plan. Missing: ${missing.join(', ')}`);
      if (!(existing as any).sentAt && !data.sentAt) data.sentAt = new Date().toISOString();
    }

    const item = await strapi.documents(UID).update({ documentId: ctx.params.id, data, status: 'published', populate: '*' });

    const caseStatus = normalizeCaseStatus((existing as any).medical_case?.status);
    if (data.status === 'ACCEPTED' && (existing as any).medical_case?.documentId && caseStatus === 'TREATMENT_IN_KAZAKHSTAN') {
      await strapi.documents('api::medical-case.medical-case' as any).update({
        documentId: (existing as any).medical_case.documentId,
        data: { status: 'TRAVEL_PREPARATION' } as any,
        status: 'published',
      });
    }

    return { data: item };
  },
}));
