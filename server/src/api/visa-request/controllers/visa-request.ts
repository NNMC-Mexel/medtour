import { factories } from '@strapi/strapi';
import { getMedicalCaseAccessFilter, getUserRole, isAdminUser, userCanAccessMedicalCase } from '../../../utils/medtour-access';

const UID = 'api::visa-request.visa-request' as any;
const WRITER_ROLES = ['manager', 'admin'];
const ALLOWED_FIELDS = [
  'medical_case',
  'country',
  'visaType',
  'status',
  'requiredDocs',
  'invitationLetter',
  'submittedAt',
  'approvedAt',
  'notes',
];

function pickAllowedFields(body: Record<string, any>) {
  return Object.fromEntries(Object.entries(body).filter(([key]) => ALLOWED_FIELDS.includes(key)));
}

function getRelationRef(value: any) {
  if (!value) return undefined;
  return typeof value === 'object' ? value.documentId || value.id : value;
}

async function createTravelEvent(strapi: any, user: any, medicalCase: any, status: any) {
  const medicalCaseRef = getRelationRef(medicalCase);
  if (!medicalCaseRef) return;
  await strapi.documents('api::case-event.case-event' as any).create({
    data: {
      medical_case: medicalCaseRef,
      actor: user.documentId || user.id,
      eventType: 'TRAVEL_UPDATED',
      message: 'Visa request updated',
      metadata: { source: 'visa_request_controller', status: status || null },
    },
  });
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
    if (!item) return ctx.notFound('Visa request not found');
    if (!(await userCanAccessMedicalCase(strapi, user, (item as any).medical_case))) return ctx.forbidden('Forbidden');
    return { data: item };
  },

  async create(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');
    const role = getUserRole(user);
    if (!WRITER_ROLES.includes(role)) return ctx.forbidden('Only managers and admins can create visa requests');

    const body = (ctx.request.body as any)?.data || ctx.request.body || {};
    if (!body.medical_case) return ctx.badRequest('medical_case is required');
    if (!(await userCanAccessMedicalCase(strapi, user, body.medical_case))) return ctx.forbidden('Forbidden');

    const item = await strapi.documents(UID).create({
      data: pickAllowedFields(body),
      status: 'published',
      populate: '*',
    });
    await createTravelEvent(strapi, user, body.medical_case, (item as any).status);
    return { data: item };
  },

  async update(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');
    const role = getUserRole(user);
    if (!WRITER_ROLES.includes(role)) return ctx.forbidden('Only managers and admins can update visa requests');

    const existing = await strapi.documents(UID).findOne({ documentId: ctx.params.id, populate: { medical_case: true } });
    if (!existing) return ctx.notFound('Visa request not found');
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
    await createTravelEvent(strapi, user, (existing as any).medical_case, (item as any).status);
    return { data: item };
  },

  async delete(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');
    if (!isAdminUser(user)) return ctx.forbidden('Only admins can delete visa requests');
    const item = await strapi.documents(UID).delete({ documentId: ctx.params.id });
    return { data: item };
  },
}));
