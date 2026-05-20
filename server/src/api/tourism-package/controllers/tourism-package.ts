import { factories } from '@strapi/strapi';
import { getMedicalCaseAccessFilter, getUserRole, isAdminUser, userCanAccessMedicalCase } from '../../../utils/medtour-access';

const UID = 'api::tourism-package.tourism-package' as any;
const STAFF_WRITER_ROLES = ['manager', 'admin'];
const STAFF_ALLOWED_FIELDS = [
  'medical_case',
  'title',
  'description',
  'city',
  'itinerary',
  'status',
  'totalCost',
  'currency',
  'notes',
];

function pickAllowedFields(body: Record<string, any>, allowed: string[]) {
  return Object.fromEntries(Object.entries(body).filter(([key]) => allowed.includes(key)));
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
    if (!item) return ctx.notFound('Tourism package not found');
    if (!(await userCanAccessMedicalCase(strapi, user, (item as any).medical_case))) return ctx.forbidden('Forbidden');
    return { data: item };
  },

  async create(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');
    const role = getUserRole(user);
    if (!STAFF_WRITER_ROLES.includes(role)) return ctx.forbidden('Only managers and admins can create tourism packages');

    const body = (ctx.request.body as any)?.data || ctx.request.body || {};
    if (!body.medical_case) return ctx.badRequest('medical_case is required');
    if (!(await userCanAccessMedicalCase(strapi, user, body.medical_case))) return ctx.forbidden('Forbidden');

    const item = await strapi.documents(UID).create({
      data: pickAllowedFields(body, STAFF_ALLOWED_FIELDS),
      status: 'published',
      populate: '*',
    });
    return { data: item };
  },

  async update(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');
    const role = getUserRole(user);
    const existing = await strapi.documents(UID).findOne({ documentId: ctx.params.id, populate: { medical_case: true } });
    if (!existing) return ctx.notFound('Tourism package not found');
    if (!(await userCanAccessMedicalCase(strapi, user, (existing as any).medical_case))) return ctx.forbidden('Forbidden');

    const body = (ctx.request.body as any)?.data || ctx.request.body || {};
    let data: Record<string, any>;
    if (role === 'patient') {
      if (!['ACCEPTED', 'DECLINED'].includes(body.status)) {
        return ctx.badRequest('Patients can only accept or decline tourism packages');
      }
      if ((existing as any).status !== 'OFFERED') {
        return ctx.badRequest('Only offered tourism packages can be accepted or declined');
      }
      data = { status: body.status };
    } else if (STAFF_WRITER_ROLES.includes(role)) {
      data = pickAllowedFields(body, STAFF_ALLOWED_FIELDS);
      delete (data as any).medical_case;
    } else {
      return ctx.forbidden('Forbidden');
    }

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
    if (!isAdminUser(user)) return ctx.forbidden('Only admins can delete tourism packages');
    const item = await strapi.documents(UID).delete({ documentId: ctx.params.id });
    return { data: item };
  },
}));
