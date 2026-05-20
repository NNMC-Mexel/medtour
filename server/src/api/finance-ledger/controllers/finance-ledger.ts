import { factories } from '@strapi/strapi';
import { getMedicalCaseAccessFilter, getUserRole, isAdminUser, userCanAccessMedicalCase } from '../../../utils/medtour-access';

const UID = 'api::finance-ledger.finance-ledger' as any;

function emptyResponse() {
  return { data: [], meta: { pagination: { page: 1, pageSize: 0, pageCount: 0, total: 0 } } };
}

export default factories.createCoreController(UID, () => ({
  async find(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');

    const role = getUserRole(user);
    const queryFilters = (ctx.query?.filters as any) || {};
    let filters: any = queryFilters;

    if (role === 'patient') {
      filters = { ...queryFilters, patient: { documentId: user.documentId } };
    } else if (!isAdminUser(user)) {
      const caseFilter = await getMedicalCaseAccessFilter(strapi, user);
      if (caseFilter === null) return emptyResponse();
      filters = { ...queryFilters, medical_case: caseFilter };
    }

    const data = await strapi.documents(UID).findMany({
      filters,
      sort: (ctx.query?.sort as any) || ['createdAt:desc'],
      populate: {
        appointment: true,
        medical_case: true,
        patient: { fields: ['id', 'documentId', 'fullName', 'email'] },
        createdByUser: { fields: ['id', 'documentId', 'fullName', 'email'] },
      },
    });

    return { data, meta: { pagination: { page: 1, pageSize: data.length, pageCount: 1, total: data.length } } };
  },

  async findOne(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');

    const item = await strapi.documents(UID).findOne({
      documentId: ctx.params.id,
      populate: {
        appointment: true,
        medical_case: true,
        patient: { fields: ['id', 'documentId'] },
      },
    });
    if (!item) return ctx.notFound('Finance ledger entry not found');

    const role = getUserRole(user);
    if (role === 'patient' && (item as any).patient?.documentId !== user.documentId) {
      return ctx.forbidden('Forbidden');
    }

    if (!['patient', 'admin'].includes(role)) {
      const caseFilter = await getMedicalCaseAccessFilter(strapi, user);
      if (caseFilter === null) return ctx.forbidden('Forbidden');
      const matches = await strapi.documents(UID).findMany({
        filters: { documentId: (item as any).documentId, medical_case: caseFilter },
        limit: 1,
      });
      if (matches.length === 0) return ctx.forbidden('Forbidden');
    }

    return { data: item };
  },

  async create(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');
    const role = getUserRole(user);
    if (!['manager', 'admin'].includes(role)) {
      return ctx.forbidden('Only finance-capable staff can create ledger entries');
    }

    const body = (ctx.request.body as any)?.data || ctx.request.body || {};
    if (role === 'manager') {
      if (!body.medical_case) {
        return ctx.badRequest('medical_case is required');
      }
      if (!(await userCanAccessMedicalCase(strapi, user, body.medical_case))) {
        return ctx.forbidden('Forbidden');
      }
    }

    const data = {
      ...body,
      createdByUser: user.documentId || user.id,
    };

    const item = await strapi.documents(UID).create({ data, populate: '*' });
    return { data: item };
  },

  async update(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');
    const role = getUserRole(user);
    if (!['manager', 'admin'].includes(role)) {
      return ctx.forbidden('Only finance-capable staff can update ledger entries');
    }

    const body = (ctx.request.body as any)?.data || ctx.request.body || {};
    if (role === 'manager') {
      const existing = await strapi.documents(UID).findOne({
        documentId: ctx.params.id,
        populate: { medical_case: true },
      });
      if (!existing) return ctx.notFound('Finance ledger entry not found');
      if (!(await userCanAccessMedicalCase(strapi, user, (existing as any).medical_case))) {
        return ctx.forbidden('Forbidden');
      }
    }

    const allowed = {
      reconciliationStatus: body.reconciliationStatus,
      notes: body.notes,
      metadata: body.metadata,
    };
    const data = Object.fromEntries(Object.entries(allowed).filter(([, value]) => value !== undefined));
    const item = await strapi.documents(UID).update({ documentId: ctx.params.id, data, populate: '*' });
    return { data: item };
  },
}));
