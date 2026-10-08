/**
 * Собственная аналитика посещений MedTour (перенесено из MedConnect).
 *
 * POST /api/analytics/collect — анонимный приём просмотров страниц и событий
 * воронки. IP и сырой user-agent не сохраняются: из UA берутся только тип
 * устройства, браузер и ОС. Пользователь не идентифицируется — только
 * случайные visitorId/sessionId из браузера и роль (guest/patient/…).
 *
 * GET /api/analytics/summary — сводка для админки: визиты, источники,
 * UTM-кампании, страницы, устройства и воронка: визит → интерес (направления,
 * врачи, цены) → регистрация → заявка (кейс) → запись на консультацию.
 */
import { factories } from '@strapi/strapi';
import { isAdminUser } from '../../../utils/medtour-access';

const UID = 'api::analytics-event.analytics-event';
const TABLE = 'analytics_events';
const KZ_OFFSET_MS = 5 * 60 * 60 * 1000;
const MAX_EVENTS_PER_REQUEST = 20;
const MAX_RANGE_DAYS = 366;

// Имена событий воронки, которые отправляет фронтенд (services/analytics.js).
const EVENT_NAMES = new Set(['sign_up', 'case_created', 'price_request', 'booking_complete']);
const ROLES = new Set(['guest', 'patient', 'doctor', 'admin', 'manager', 'coordinator']);
const CLICK_SOURCES = new Set(['meta', 'yandex', 'google']);
const ID_RE = /^[A-Za-z0-9-]{8,64}$/;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const BOT_RE = /bot|crawl|spider|slurp|headless|lighthouse|preview|facebookexternalhit|curl|wget|python|axios|node-fetch|go-http|java\//i;

// Внутри кабинетов в путях документы, записи и комнаты — их идентификаторы
// заменяются на :id, чтобы в аналитике оставался только раздел.
const PRIVATE_PREFIXES = ['/patient', '/doctor', '/admin', '/manager', '/coordinator', '/consultation'];
const ID_SEGMENT_RE = /^(\d+|[a-z0-9]{20,}|[0-9a-f-]{32,36}|room-.+)$/i;

const kzDay = (date = new Date()) => new Date(date.getTime() + KZ_OFFSET_MS).toISOString().slice(0, 10);

const clip = (value: unknown, max: number) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
};

export const normalizePath = (raw: unknown) => {
  if (typeof raw !== 'string' || !raw.startsWith('/')) return null;
  let path = raw.split(/[?#]/)[0].replace(/\/{2,}/g, '/');
  if (path.length > 1) path = path.replace(/\/+$/, '');
  if (PRIVATE_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
    path = path.split('/').map((segment) => (ID_SEGMENT_RE.test(segment) ? ':id' : segment)).join('/');
  }
  return path.slice(0, 200);
};

export const parseUserAgent = (ua: string) => {
  const device = /iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(ua)
    ? 'tablet'
    : /Mobi|iPhone|iPod|Android/i.test(ua) ? 'mobile' : 'desktop';
  const browser =
    /YaBrowser/i.test(ua) ? 'Yandex' :
    /Edg\//i.test(ua) ? 'Edge' :
    /OPR\/|Opera/i.test(ua) ? 'Opera' :
    /SamsungBrowser/i.test(ua) ? 'Samsung' :
    /Instagram/i.test(ua) ? 'Instagram' :
    /FBAN|FBAV/i.test(ua) ? 'Facebook' :
    /Firefox|FxiOS/i.test(ua) ? 'Firefox' :
    /Chrome|CriOS/i.test(ua) ? 'Chrome' :
    /Safari/i.test(ua) ? 'Safari' : 'Other';
  const os =
    /Windows/i.test(ua) ? 'Windows' :
    /iPhone|iPad|iPod/i.test(ua) ? 'iOS' :
    /Android/i.test(ua) ? 'Android' :
    /Mac OS X|Macintosh/i.test(ua) ? 'macOS' :
    /Linux/i.test(ua) ? 'Linux' : 'Other';
  return { device, browser, os };
};

const frontendHosts = () => {
  const hosts = new Set<string>();
  for (const url of [process.env.FRONTEND_URL, 'https://medtour.nnmc.kz']) {
    try { if (url) hosts.add(new URL(url).host.toLowerCase()); } catch { /* ignore */ }
  }
  return hosts;
};

const referrerHostOf = (raw: unknown) => {
  if (typeof raw !== 'string' || !raw) return null;
  try {
    const host = new URL(raw).host.toLowerCase().replace(/^www\./, '');
    if (!host || frontendHosts().has(host)) return null;
    return host.slice(0, 120);
  } catch {
    return null;
  }
};

const toEventData = (input: any, ua: ReturnType<typeof parseUserAgent>) => {
  if (!input || typeof input !== 'object') return null;
  const kind = input.kind === 'event' ? 'event' : input.kind === 'pageview' ? 'pageview' : null;
  if (!kind) return null;
  if (!ID_RE.test(String(input.visitorId || '')) || !ID_RE.test(String(input.sessionId || ''))) return null;

  const name = kind === 'event' ? String(input.name || '') : null;
  if (kind === 'event' && !EVENT_NAMES.has(name as string)) return null;
  const path = normalizePath(input.path);
  if (kind === 'pageview' && !path) return null;

  const utm = input.utm && typeof input.utm === 'object' ? input.utm : {};
  const value = Number(input.value);
  // iPad в режиме «как на компьютере» присылает UA от Mac; фронтенд
  // помечает такие браузеры по сенсорному экрану.
  const device = input.touchMac === true && ua.os === 'macOS' ? 'tablet' : ua.device;
  const os = input.touchMac === true && ua.os === 'macOS' ? 'iOS' : ua.os;
  return {
    kind,
    name,
    path,
    day: kzDay(),
    visitorId: input.visitorId,
    sessionId: input.sessionId,
    referrerHost: referrerHostOf(input.referrer),
    utmSource: clip(utm.source, 100)?.toLowerCase() || null,
    utmMedium: clip(utm.medium, 100)?.toLowerCase() || null,
    utmCampaign: clip(utm.campaign, 150),
    utmContent: clip(utm.content, 150),
    utmTerm: clip(utm.term, 150),
    clickSource: CLICK_SOURCES.has(input.click) ? input.click : null,
    device,
    browser: ua.browser,
    os,
    platform: input.platform === 'app' ? 'app' : 'web',
    role: ROLES.has(input.role) ? input.role : 'guest',
    value: Number.isInteger(value) && value >= 0 && value < 100_000_000 ? value : null,
  };
};

// Канал визита: сначала явные метки рекламы, затем реферер.
const META_SOURCE_RE = /(^|[^a-z])(instagram|facebook|fb|ig|meta)([^a-z]|$)/i;
const SOCIAL_HOST_RE = /(instagram|facebook|fb\.com|t\.me|telegram|whatsapp|vk\.com|tiktok|twitter|x\.com|youtube|linkedin|threads)/i;
const SEARCH_HOST_RE = /(google\.|yandex\.|ya\.ru|bing\.|mail\.ru|duckduckgo|yahoo\.)/i;

export const channelOf = (row: any) => {
  if (row.click_source === 'meta' || META_SOURCE_RE.test(row.utm_source || '')) return 'meta_ads';
  if (row.utm_source) return 'campaign';
  if (row.click_source === 'yandex' || row.click_source === 'google') return 'search_ads';
  const host = row.referrer_host || '';
  if (!host) return 'direct';
  if (SOCIAL_HOST_RE.test(host)) return 'social';
  if (SEARCH_HOST_RE.test(host)) return 'search';
  return 'referral';
};

const num = (value: any) => Number(value) || 0;

const addDays = (day: string, delta: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + delta * 86_400_000).toISOString().slice(0, 10);

export default factories.createCoreController(UID as any, ({ strapi }) => ({
  async collect(ctx) {
    const ua = String(ctx.request.headers['user-agent'] || '');
    if (!ua || BOT_RE.test(ua)) {
      ctx.status = 204;
      return;
    }

    let body: any = ctx.request.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { return ctx.badRequest('Invalid JSON'); }
    }
    const raw = Array.isArray(body?.events) ? body.events : body ? [body] : [];
    if (!raw.length || raw.length > MAX_EVENTS_PER_REQUEST) return ctx.badRequest('Invalid events');

    const parsedUa = parseUserAgent(ua);
    const events = raw.map((item: any) => toEventData(item, parsedUa)).filter(Boolean);
    for (const data of events) {
      await strapi.documents(UID as any).create({ data } as any);
    }

    ctx.status = 204;
  },

  async summary(ctx) {
    const user = ctx.state.user;
    const isAdmin = isAdminUser(user);
    if (!isAdmin) return ctx.forbidden('Only admins can view analytics');

    const today = kzDay();
    const to = DAY_RE.test(String(ctx.query.to || '')) ? String(ctx.query.to) : today;
    const from = DAY_RE.test(String(ctx.query.from || '')) ? String(ctx.query.from) : addDays(to, -29);
    const rangeDays = Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;
    if (rangeDays < 1 || rangeDays > MAX_RANGE_DAYS) return ctx.badRequest('Invalid date range');

    const knex = strapi.db.connection;
    const base = () => knex(TABLE).whereBetween('day', [from, to]);
    const visitorsWith = (condition: string, alias: string) =>
      knex.raw(`count(distinct case when ${condition} then visitor_id end) as ${alias}`);
    const conversions = [
      visitorsWith("name = 'sign_up'", 'sign_ups'),
      visitorsWith("name = 'case_created'", 'leads'),
      visitorsWith("name = 'booking_complete'", 'bookings'),
    ];

    const [totalsRow, dailyRows, pageRows, sourceRows, campaignRows, deviceRows, osRows, funnelRow, valueRow] =
      await Promise.all([
        base()
          .select(
            knex.raw("count(case when kind = 'pageview' then 1 end) as pageviews"),
            knex.raw('count(distinct session_id) as sessions'),
            knex.raw('count(distinct visitor_id) as visitors'),
            ...conversions,
          )
          .first(),
        base()
          .select('day')
          .select(
            knex.raw("count(case when kind = 'pageview' then 1 end) as pageviews"),
            knex.raw('count(distinct session_id) as sessions'),
            knex.raw('count(distinct visitor_id) as visitors'),
          )
          .groupBy('day')
          .orderBy('day'),
        base()
          .where('kind', 'pageview')
          .select('path')
          .count({ views: '*' })
          .countDistinct({ visitors: 'visitor_id' })
          .groupBy('path')
          .orderBy('views', 'desc')
          .limit(25),
        base()
          .select('utm_source', 'referrer_host', 'click_source')
          .countDistinct({ sessions: 'session_id' })
          .select(...conversions)
          .groupBy('utm_source', 'referrer_host', 'click_source')
          .limit(5000),
        base()
          .whereNotNull('utm_campaign')
          .select('utm_source', 'utm_medium', 'utm_campaign')
          .countDistinct({ sessions: 'session_id' })
          .countDistinct({ visitors: 'visitor_id' })
          .select(...conversions)
          .groupBy('utm_source', 'utm_medium', 'utm_campaign')
          .orderBy('sessions', 'desc')
          .limit(30),
        base().select('device').countDistinct({ sessions: 'session_id' }).countDistinct({ visitors: 'visitor_id' }).groupBy('device'),
        base().select('os').countDistinct({ sessions: 'session_id' }).countDistinct({ visitors: 'visitor_id' }).groupBy('os'),
        base()
          .select(
            knex.raw('count(distinct visitor_id) as visited'),
            visitorsWith("kind = 'pageview' and (path like '/treatments/%' or path = '/doctors' or path like '/doctors/%' or path = '/prices')", 'interested'),
            visitorsWith("name = 'sign_up'", 'sign_up'),
            visitorsWith("name = 'case_created'", 'case_created'),
            visitorsWith("name = 'booking_complete'", 'booking_complete'),
          )
          .first(),
        base().where({ kind: 'event', name: 'booking_complete' }).sum({ total: 'value' }).first(),
      ]);

    // Дни без визитов тоже показываем — иначе график «склеивает» провалы.
    const dailyByDay = new Map((dailyRows as any[]).map((row) => [row.day, row]));
    const daily = Array.from({ length: rangeDays }, (_, index) => {
      const day = addDays(from, index);
      const row: any = dailyByDay.get(day) || {};
      return { day, visitors: num(row.visitors), sessions: num(row.sessions), pageviews: num(row.pageviews) };
    });

    const channelTotals = new Map<string, { sessions: number; signUps: number; leads: number; bookings: number }>();
    // Источник считается отдельно по каналу: l.instagram.com с меткой клика —
    // реклама, без неё — переход из профиля или сторис.
    const sourceTotals = new Map<string, { sessions: number; signUps: number; leads: number; bookings: number; source: string; channel: string }>();
    for (const row of sourceRows as any[]) {
      const channel = channelOf(row);
      const add = (map: Map<string, any>, key: string, extra: Record<string, any> = {}) => {
        const current = map.get(key) || { sessions: 0, signUps: 0, leads: 0, bookings: 0, ...extra };
        current.sessions += num(row.sessions);
        current.signUps += num(row.sign_ups);
        current.leads += num(row.leads);
        current.bookings += num(row.bookings);
        map.set(key, current);
      };
      add(channelTotals, channel);
      const source = row.utm_source || row.referrer_host || (row.click_source ? `${row.click_source} (click id)` : '(direct)');
      add(sourceTotals, `${source}\u0000${channel}`, { source, channel });
    }

    // Страницы врачей показываем с именем врача, а не с documentId.
    const doctorIds = (pageRows as any[])
      .map((row) => /^\/doctors\/([A-Za-z0-9]+)$/.exec(row.path || '')?.[1])
      .filter(Boolean) as string[];
    const doctorNames = new Map<string, string>();
    if (doctorIds.length) {
      const doctors = await strapi.db.query('api::doctor.doctor').findMany({
        where: { documentId: { $in: doctorIds } },
        select: ['documentId', 'fullName'],
      });
      for (const doctor of doctors as any[]) doctorNames.set(doctor.documentId, doctor.fullName);
    }

    const sortBySessions = (a: any, b: any) => b.sessions - a.sessions;
    ctx.body = {
      data: {
        range: { from, to, days: rangeDays },
        totals: {
          visitors: num((totalsRow as any)?.visitors),
          sessions: num((totalsRow as any)?.sessions),
          pageviews: num((totalsRow as any)?.pageviews),
          signUps: num((totalsRow as any)?.sign_ups),
          leads: num((totalsRow as any)?.leads),
          bookings: num((totalsRow as any)?.bookings),
          bookingValue: num((valueRow as any)?.total),
        },
        daily,
        channels: Array.from(channelTotals, ([channel, totals]) => ({ channel, ...totals })).sort(sortBySessions),
        sources: Array.from(sourceTotals.values()).sort(sortBySessions).slice(0, 20),
        campaigns: (campaignRows as any[]).map((row) => ({
          source: row.utm_source,
          medium: row.utm_medium,
          campaign: row.utm_campaign,
          sessions: num(row.sessions),
          visitors: num(row.visitors),
          signUps: num(row.sign_ups),
          leads: num(row.leads),
          bookings: num(row.bookings),
        })),
        pages: (pageRows as any[]).map((row) => {
          const doctorId = /^\/doctors\/([A-Za-z0-9]+)$/.exec(row.path || '')?.[1];
          return {
            path: row.path,
            label: doctorId ? doctorNames.get(doctorId) || null : null,
            views: num(row.views),
            visitors: num(row.visitors),
          };
        }),
        devices: (deviceRows as any[]).map((row) => ({ device: row.device || 'desktop', sessions: num(row.sessions), visitors: num(row.visitors) })).sort(sortBySessions),
        os: (osRows as any[]).map((row) => ({ os: row.os || 'Other', sessions: num(row.sessions), visitors: num(row.visitors) })).sort(sortBySessions),
        funnel: [
          { step: 'visited', visitors: num((funnelRow as any)?.visited) },
          { step: 'interested', visitors: num((funnelRow as any)?.interested) },
          { step: 'sign_up', visitors: num((funnelRow as any)?.sign_up) },
          { step: 'case_created', visitors: num((funnelRow as any)?.case_created) },
          { step: 'booking_complete', visitors: num((funnelRow as any)?.booking_complete) },
        ],
      },
    };
  },
}));
