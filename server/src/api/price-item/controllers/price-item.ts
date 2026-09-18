import { factories } from '@strapi/strapi';
import { convertKztToUsd, getUsdRate } from '../../../utils/nbk-rate';

function isEditor(ctx: any) {
  const user = ctx.state?.user;
  return Boolean(user && ['admin', 'manager', 'coordinator'].includes(user.role?.type || user.userRole));
}

const conversionFields = ['price', 'priceUSD', 'currency', 'isActive'];
const normalizeSearch = (value: unknown) => String(value || '').toLocaleLowerCase()
  .replace(/\s*[-–—]\s*/g, '-').replace(/\s+/g, ' ').trim();

function includeConversionFields(ctx: any): Set<string> | null {
  const fields = ctx.query?.fields;
  if (!fields) return null;
  const requested = new Set<string>((Array.isArray(fields) ? fields : typeof fields === 'object' ? Object.values(fields) : [fields]).map(String));
  (ctx.query as any).fields = [...new Set([...requested, ...conversionFields])];
  return requested;
}

function restoreRequestedFields(data: any, requested: Set<string> | null) {
  if (!requested) return data;
  const trim = (item: any) => {
    if (!item) return item;
    for (const field of conversionFields) if (!requested.has(field)) delete item[field];
    return item;
  };
  return Array.isArray(data) ? data.map(trim) : trim(data);
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

async function prepareMutation(ctx: any, strapi: any) {
  const data = ((ctx.request.body as any)?.data || {}) as Record<string, any>;
  const expectedRate = data.expectedRate;
  const expectedRateDate = data.expectedRateDate;
  delete data.expectedRate;
  delete data.expectedRateDate;
  delete data.priceUSD;
  delete data.exchangeRate;
  delete data.exchangeRateDate;
  if (data.priceKZT === null || data.priceKZT === '') delete data.priceKZT;
  if (data.currency && !['USD', 'KZT'].includes(data.currency)) return ctx.badRequest('Only USD and KZT inputs are supported');
  let sourceAmount = data.priceKZT ?? (data.currency === 'KZT' ? data.price : undefined);
  if (sourceAmount === undefined && data.price === undefined && ctx.params?.id) {
    const documentId = String(ctx.params.id);
    const preferredStatus = ctx.query?.status === 'draft' ? 'draft' : 'published';
    const existing: any = await strapi.documents('api::price-item.price-item').findOne({ documentId, status: preferredStatus } as any)
      || await strapi.documents('api::price-item.price-item').findOne({ documentId, status: preferredStatus === 'draft' ? 'published' : 'draft' } as any);
    if (existing?.currency === 'KZT') sourceAmount = existing.price;
    else if (existing && existing.currency !== 'USD') return ctx.badRequest('Set a USD price before editing this service');
  }
  if (sourceAmount !== undefined && sourceAmount !== null && sourceAmount !== '') {
    const kzt = Number(sourceAmount);
    if (!Number.isFinite(kzt) || kzt < 0) return ctx.badRequest('Invalid KZT amount');
    const rate = await getUsdRate();
    if ((expectedRate !== undefined && Number(expectedRate) !== rate.kztPerUsd) ||
      (expectedRateDate !== undefined && expectedRateDate !== rate.date)) {
      ctx.status = 409;
      ctx.body = { data: null, error: { status: 409, name: 'ConflictError', message: 'Exchange rate changed. Refresh the price preview.' } };
      return ctx.body;
    }
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
    const requested = includeConversionFields(ctx);
    if (!isEditor(ctx)) {
      (ctx.query as any).status = 'published';
      const existing = (ctx.query as any).filters;
      (ctx.query as any).filters = existing
        ? { $and: [existing, { isActive: { $eq: true } }] }
        : { isActive: { $eq: true } };
    }
    const response = await super.find(ctx);
    response.data = restoreRequestedFields(await inUsd(response.data, isEditor(ctx)), requested);
    return response;
  },
  async findOne(ctx) {
    const requested = includeConversionFields(ctx);
    if (!isEditor(ctx)) (ctx.query as any).status = 'published';
    const response = await super.findOne(ctx);
    if (!response?.data) return ctx.notFound();
    if (!isEditor(ctx) && response.data?.isActive === false) return ctx.notFound();
    response.data = restoreRequestedFields(await inUsd(response.data, isEditor(ctx)), requested);
    return response;
  },
  async create(ctx) {
    let error;
    try {
      error = await prepareMutation(ctx, strapi);
    } catch (conversionError) {
      strapi.log.error('Price conversion failed', conversionError);
      return ctx.serviceUnavailable('Official exchange rate is unavailable');
    }
    if (error) return error;
    return super.create(ctx);
  },
  async update(ctx) {
    let error;
    try {
      error = await prepareMutation(ctx, strapi);
    } catch (conversionError) {
      strapi.log.error('Price conversion failed', conversionError);
      return ctx.serviceUnavailable('Official exchange rate is unavailable');
    }
    if (error) return error;
    return super.update(ctx);
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
    const search = normalizeSearch(query.search);
    const requestedIds = String(query.ids || '').split(',').filter(Boolean);
    if (requestedIds.length > 50 || requestedIds.some((id) => !/^[a-zA-Z0-9_-]{1,80}$/.test(id))) return ctx.badRequest('Invalid service IDs');
    const idSet = new Set(requestedIds);
    const section = String(query.section || 'all');
    const category = String(query.category || 'all');
    const available = all.filter((item: any) =>
      ((editor && query.includeInactive === 'true') || item.isActive !== false) &&
      (query.featuredOnly !== 'true' || item.isFeatured === true) &&
      (section === 'all' || (item.section || 'service') === section) &&
      (idSet.size === 0 || idSet.has(item.documentId)) &&
      (!search || [item.title, item.category, item.tariffCode, ...Object.values(item.i18n || {}).flatMap((x: any) => [x?.title, x?.category])]
        .some((value) => normalizeSearch(value).includes(search))));
    const categories = [...new Set(available.map((item: any) => item.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ru'));
    const filtered = category === 'all' ? available : available.filter((item: any) => item.category === category);
    const data = await inUsd(filtered.slice((page - 1) * pageSize, page * pageSize), editor);
    ctx.body = { data, meta: { pagination: { page, pageSize, pageCount: Math.ceil(filtered.length / pageSize), total: filtered.length }, categories } };
  },
}));
