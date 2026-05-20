import { factories } from '@strapi/strapi';
import { getMedicalCaseAccessFilter, getUserRole, isAdminUser, userCanAccessMedicalCase } from '../../../utils/medtour-access';

const UID = 'api::trip-checklist.trip-checklist' as any;
const WRITER_ROLES = ['manager', 'admin'];
const ALLOWED_FIELDS = ['medical_case', 'status', 'items', 'managerNotes'];

function pickAllowedFields(body: Record<string, any>) {
  return Object.fromEntries(Object.entries(body).filter(([key]) => ALLOWED_FIELDS.includes(key)));
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
    if (!item) return ctx.notFound('Trip checklist not found');
    if (!(await userCanAccessMedicalCase(strapi, user, (item as any).medical_case))) return ctx.forbidden('Forbidden');
    return { data: item };
  },

  async create(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');
    const role = getUserRole(user);
    if (!WRITER_ROLES.includes(role)) return ctx.forbidden('Only managers and admins can create trip checklists');

    const body = (ctx.request.body as any)?.data || ctx.request.body || {};
    if (!body.medical_case) return ctx.badRequest('medical_case is required');
    if (!(await userCanAccessMedicalCase(strapi, user, body.medical_case))) return ctx.forbidden('Forbidden');

    const item = await strapi.documents(UID).create({
      data: pickAllowedFields(body),
      status: 'published',
      populate: '*',
    });
    return { data: item };
  },

  async update(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');
    const role = getUserRole(user);
    if (!WRITER_ROLES.includes(role)) return ctx.forbidden('Only managers and admins can update trip checklists');

    const existing = await strapi.documents(UID).findOne({ documentId: ctx.params.id, populate: { medical_case: true } });
    if (!existing) return ctx.notFound('Trip checklist not found');
    if (!(await userCanAccessMedicalCase(strapi, user, (existing as any).medical_case))) return ctx.forbidden('Forbidden');

    const body = (ctx.request.body as any)?.data || ctx.request.body || {};
    const data = pickAllowedFields(body);
    delete (data as any).medical_case;

    const item = await strapi.documents(UID).update({
      documentId: ctx.params.id,
      data,
      status: 'published',
      populate: '*',
    });
    return { data: item };
  },

  async delete(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');
    if (!isAdminUser(user)) return ctx.forbidden('Only admins can delete trip checklists');
    const item = await strapi.documents(UID).delete({ documentId: ctx.params.id });
    return { data: item };
  },
}));
