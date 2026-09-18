import { factories } from '@strapi/strapi';
import { convertKztToUsd, getUsdRate } from '../../../utils/nbk-rate';

const UID = 'api::price-request.price-request';
const PRICE_UID = 'api::price-item.price-item';
const staffRoles = ['admin', 'manager', 'coordinator'];
const roleOf = (ctx: any) => ctx.state?.user?.role?.type || ctx.state?.user?.userRole;
const patientView = (item: any) => {
  const { managerNote, ...visible } = item;
  return visible;
};

export default factories.createCoreController(UID as any, ({ strapi }) => ({
  async find(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized();
    const role = roleOf(ctx);
    if (role !== 'patient' && !staffRoles.includes(role)) return ctx.forbidden();
    const filters = role === 'patient' ? { patient: { documentId: { $eq: user.documentId } } } : {};
    const page = Math.max(1, Number((ctx.query as any).page) || 1);
    const pageSize = Math.max(1, Math.min(100, Number((ctx.query as any).pageSize) || 25));
    const [data, total] = await Promise.all([
      strapi.documents(UID as any).findMany({ filters, populate: { patient: { fields: ['id', 'documentId', 'fullName', 'email', 'phone'] } }, sort: 'createdAt:desc', start: (page - 1) * pageSize, limit: pageSize } as any),
      strapi.documents(UID as any).count({ filters } as any),
    ]);
    ctx.body = { data: role === 'patient' ? data.map(patientView) : data, meta: { pagination: { page, pageSize, pageCount: Math.ceil(total / pageSize), total } } };
  },
  async findOne(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized();
    const item: any = await strapi.documents(UID as any).findOne({ documentId: String(ctx.params.id), populate: { patient: { fields: ['id', 'documentId', 'fullName', 'email', 'phone'] } } } as any);
    if (!item) return ctx.notFound();
    if (!staffRoles.includes(roleOf(ctx)) && item.patient?.documentId !== user.documentId) return ctx.forbidden();
    ctx.body = { data: roleOf(ctx) === 'patient' ? patientView(item) : item };
  },
  async create(ctx) {
    const user = ctx.state.user;
    if (!user || roleOf(ctx) !== 'patient') return ctx.forbidden('Only patients can submit a price request');
    const input = (ctx.request.body as any)?.data || {};
    const ids = input.itemIds;
    if (!Array.isArray(ids) || ids.length < 1 || ids.length > 50 || new Set(ids).size !== ids.length ||
      ids.some((id) => typeof id !== 'string' || id.length > 80)) return ctx.badRequest('Choose 1 to 50 distinct services');
    if (input.note && (typeof input.note !== 'string' || input.note.length > 2000)) return ctx.badRequest('Invalid note');
    const snapshots = [];
    let rate;
    for (const id of ids) {
      const item: any = await strapi.documents(PRICE_UID).findOne({ documentId: id, status: 'published' } as any);
      if (!item || item.isActive === false) return ctx.badRequest('A selected service is unavailable');
      let priceUSD = item.currency === 'USD' ? Number(item.price) : Number(item.priceUSD);
      if (!priceUSD && item.currency === 'KZT') {
        rate ||= await getUsdRate();
        priceUSD = convertKztToUsd(Number(item.price), rate.kztPerUsd);
      }
      if (!Number.isFinite(priceUSD) || priceUSD < 0 || (item.currency !== 'USD' && item.currency !== 'KZT' && !item.priceUSD)) {
        return ctx.badRequest('A selected service has no USD price');
      }
      snapshots.push({ priceItemId: item.documentId, title: item.title, category: item.category, tariffCode: item.tariffCode, priceUSD });
    }
    const totalUSD = Math.round(snapshots.reduce((sum, item) => sum + item.priceUSD, 0) * 100) / 100;
    const saved: any = await strapi.documents(UID as any).create({ data: {
      patient: user.documentId, items: snapshots, totalUSD,
      note: String(input.note || '').trim(), status: 'new',
    } as any, populate: { patient: { fields: ['id', 'documentId', 'fullName', 'email', 'phone'] } } } as any);
    const managers = await strapi.query('plugin::users-permissions.user').findMany({ where: { userRole: 'manager' }, select: ['id', 'documentId'] });
    for (const manager of managers) {
      try {
        await strapi.documents('api::notification.notification').create({ data: {
          user: manager.documentId || manager.id,
          title: 'New service request',
          message: `${saved.patient?.fullName || user.fullName || 'Patient'} selected ${snapshots.length} services`,
          type: 'system', link: '/manager/price-requests',
          metadata: { priceRequestId: saved.documentId },
        } as any });
      } catch (error) { strapi.log.error('Price request notification failed', error); }
    }
    ctx.body = { data: patientView(saved) };
    ctx.status = 201;
  },
  async update(ctx) {
    if (!staffRoles.includes(roleOf(ctx))) return ctx.forbidden();
    const input = (ctx.request.body as any)?.data || {};
    if (input.status && !['new', 'reviewing', 'contacted', 'closed'].includes(input.status)) return ctx.badRequest('Invalid status');
    if (input.managerNote && (typeof input.managerNote !== 'string' || input.managerNote.length > 2000)) return ctx.badRequest('Invalid note');
    const data = Object.fromEntries(['status', 'managerNote'].filter((key) => input[key] !== undefined).map((key) => [key, input[key]]));
    const saved = await strapi.documents(UID as any).update({ documentId: String(ctx.params.id), data });
    ctx.body = { data: saved };
  },
  async delete(ctx) { return ctx.forbidden(); },
}));
