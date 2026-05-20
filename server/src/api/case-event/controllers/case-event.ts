import { factories } from '@strapi/strapi';
import { getMedicalCaseAccessFilter, isAdminUser, userCanAccessMedicalCase } from '../../../utils/medtour-access';

const UID = 'api::case-event.case-event' as any;

export default factories.createCoreController(UID, () => ({
  async find(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');
    const caseFilter = await getMedicalCaseAccessFilter(strapi, user);
    if (caseFilter === null) return { data: [], meta: { pagination: { page: 1, pageSize: 0, pageCount: 0, total: 0 } } };
    const queryFilters = (ctx.query?.filters as any) || {};
    const data = await strapi.documents(UID).findMany({
      filters: isAdminUser(user) ? queryFilters : { ...queryFilters, medical_case: caseFilter },
      sort: (ctx.query?.sort as any) || ['createdAt:asc'],
      populate: '*',
    });
    return { data, meta: { pagination: { page: 1, pageSize: data.length, pageCount: 1, total: data.length } } };
  },

  async create(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');
    const body = (ctx.request.body as any)?.data || ctx.request.body || {};
    if (!(await userCanAccessMedicalCase(strapi, user, body.medical_case))) return ctx.forbidden('Forbidden');
    const item = await strapi.documents(UID).create({
      data: {
        ...body,
        actor: body.actor || user.documentId,
      },
      populate: '*',
    });
    return { data: item };
  },
}));
