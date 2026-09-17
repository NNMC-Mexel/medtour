import { factories } from '@strapi/strapi';
import { convertKztToUsd, getUsdRate } from '../../../utils/nbk-rate';

function isEditor(ctx: any) {
  const user = ctx.state?.user;
  return Boolean(user && ['admin', 'manager', 'coordinator'].includes(user.role?.type || user.userRole));
}

async function inUsd(data: any, editor: boolean) {
  if (!data) return data;
  const items = Array.isArray(data) ? data : [data];
  const needsRate = items.some((item) => item && item.currency === 'KZT' && !Number(item.priceUSD));
  let rate;
  if (needsRate) {
    try { rate = await getUsdRate(); } catch { /* Hide legacy prices when conversion is unavailable. */ }
  }
  const converted = items.map((item) => {
    if (!item) return item;
    const usd = item.currency === 'USD' ? Number(item.price) : Number(item.priceUSD) ||
      (item.currency === 'KZT' && rate ? convertKztToUsd(Number(item.price), rate.kztPerUsd) : null);
    if (usd === null || !Number.isFinite(usd)) return null;
    const result = { ...item, price: usd, priceUSD: usd, currency: 'USD' };
    if (!editor) {
      delete result.priceKZT;
      delete result.exchangeRate;
      delete result.exchangeRateDate;
    }
    return result;
  }).filter(Boolean);
  return Array.isArray(data) ? converted : converted[0] || null;
}

async function prepareMutation(ctx: any) {
  const data = ((ctx.request.body as any)?.data || {}) as Record<string, any>;
  if (data.currency && !['USD', 'KZT'].includes(data.currency)) return ctx.badRequest('Only USD and KZT inputs are supported');
  const sourceAmount = data.priceKZT ?? (data.currency === 'KZT' ? data.price : undefined);
  if (sourceAmount !== undefined && sourceAmount !== null && sourceAmount !== '') {
    const kzt = Number(sourceAmount);
    if (!Number.isFinite(kzt) || kzt < 0) return ctx.badRequest('Invalid KZT amount');
    const rate = await getUsdRate();
    data.priceKZT = kzt;
    data.price = convertKztToUsd(kzt, rate.kztPerUsd);
    data.priceUSD = data.price;
    data.exchangeRate = rate.kztPerUsd;
    data.exchangeRateDate = rate.date;
  } else if (data.price !== undefined) {
    const usd = Number(data.price);
    if (!Number.isFinite(usd) || usd < 0) return ctx.badRequest('Invalid USD amount');
    data.price = usd;
    data.priceUSD = usd;
    data.priceKZT = null;
    data.exchangeRate = null;
    data.exchangeRateDate = null;
  }
  data.currency = 'USD';
  (ctx.request.body as any).data = data;
  return null;
}

export default factories.createCoreController('api::price-item.price-item', ({ strapi }) => ({
  async find(ctx) {
    if (!isEditor(ctx)) {
      (ctx.query as any).status = 'published';
      const existing = (ctx.query as any).filters;
      (ctx.query as any).filters = existing
        ? { $and: [existing, { isActive: { $eq: true } }] }
        : { isActive: { $eq: true } };
    }
    const response = await super.find(ctx);
    response.data = await inUsd(response.data, isEditor(ctx));
    return response;
  },
  async findOne(ctx) {
    if (!isEditor(ctx)) (ctx.query as any).status = 'published';
    const response = await super.findOne(ctx);
    if (!isEditor(ctx) && response.data?.isActive === false) return ctx.notFound();
    response.data = await inUsd(response.data, isEditor(ctx));
    return response;
  },
  async create(ctx) {
    try {
      const error = await prepareMutation(ctx);
      if (error) return error;
      return await super.create(ctx);
    } catch (error) {
      strapi.log.error('Price conversion failed', error);
      return ctx.serviceUnavailable('Official exchange rate is unavailable');
    }
  },
  async update(ctx) {
    try {
      const error = await prepareMutation(ctx);
      if (error) return error;
      return await super.update(ctx);
    } catch (error) {
      strapi.log.error('Price conversion failed', error);
      return ctx.serviceUnavailable('Official exchange rate is unavailable');
    }
  },
  async exchangeRate(ctx) {
    try { ctx.body = { data: await getUsdRate() }; }
    catch { return ctx.serviceUnavailable('Official exchange rate is unavailable'); }
  },
  async catalog(ctx) {
    const query = ctx.query as Record<string, any>;
    const page = Math.max(1, Math.min(10000, Number(query.page) || 1));
    const pageSize = Math.max(1, Math.min(100, Number(query.pageSize) || 24));
    const editor = isEditor(ctx);
    const all = await strapi.documents('api::price-item.price-item').findMany({
      status: 'published', limit: 10000, sort: ['sortOrder:asc', 'title:asc'],
    } as any);
    const categories = [...new Set(all.filter((item: any) => editor || item.isActive !== false)
      .map((item: any) => item.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ru'));
    const search = String(query.search || '').trim().toLocaleLowerCase();
    const requestedIds = String(query.ids || '').split(',').filter(Boolean);
    if (requestedIds.length > 50 || requestedIds.some((id) => !/^[a-zA-Z0-9_-]{1,80}$/.test(id))) return ctx.badRequest('Invalid service IDs');
    const idSet = new Set(requestedIds);
    const section = String(query.section || 'all');
    const category = String(query.category || 'all');
    const filtered = all.filter((item: any) =>
      ((editor && query.includeInactive === 'true') || item.isActive !== false) &&
      (query.featuredOnly !== 'true' || item.isFeatured === true) &&
      (section === 'all' || (item.section || 'service') === section) &&
      (category === 'all' || item.category === category) &&
      (idSet.size === 0 || idSet.has(item.documentId)) &&
      (!search || [item.title, item.category, item.tariffCode, ...Object.values(item.i18n || {}).flatMap((x: any) => [x?.title, x?.category])]
        .some((value) => String(value || '').toLocaleLowerCase().includes(search))));
    const data = await inUsd(filtered.slice((page - 1) * pageSize, page * pageSize), editor);
    ctx.body = { data, meta: { pagination: { page, pageSize, pageCount: Math.ceil(filtered.length / pageSize), total: filtered.length }, categories } };
  },
}));
