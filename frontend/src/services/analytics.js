// Аналитика посещений: собственный учёт MedTour (POST /api/analytics/collect)
// плюс Яндекс Метрика и Meta Pixel для рекламы.
//
// Приватность:
// - Метрика и Pixel подключаются только на публичных страницах сайта и не в
//   мобильном приложении. В кабинетах медицинские данные, туда сторонние
//   счётчики не заходят: просмотры кабинета им не отправляются, вебвизор и
//   карта кликов Метрики выключены, автосбор событий Meta — тоже.
// - Собственный учёт анонимный: случайные visitorId/sessionId, без имени,
//   email и id пользователя; идентификаторы в путях кабинета сервер заменяет на :id.
// - Браузеры сотрудников (admin/manager/coordinator/doctor) помечаются внутренними и не
//   учитываются вовсе, чтобы не искажать статистику рекламы.
import { Capacitor } from '@capacitor/core'
import { getApiBaseUrl } from './api'
import useAuthStore from '../stores/authStore'

const isNativeMobileApp = () => {
  try { return Capacitor.isNativePlatform() } catch { return false }
}

const METRIKA_ID = Number(import.meta.env.VITE_YANDEX_METRIKA_ID) || null
const META_PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID || null

const VISITOR_KEY = 'mt_vid'
const SESSION_KEY = 'mt_session'
const INTERNAL_KEY = 'mt_internal'
const SESSION_TIMEOUT_MS = 30 * 60 * 1000
const STAFF_ROLES = new Set(['admin', 'manager', 'coordinator', 'doctor'])
const UTM_KEYS = ['source', 'medium', 'campaign', 'content', 'term']

// Страницы, которые видит любой посетитель. Токены сброса пароля и
// подтверждения email сюда намеренно не входят.
const PUBLIC_PATHS = [
  /^\/$/,
  /^\/doctors(\/[^/]+)?$/,
  /^\/specializations$/,
  /^\/(about|tourism|blog|prices)$/,
  /^\/treatments\/[^/]+$/,
  /^\/(privacy|terms)$/,
  /^\/(login|register|forgot-password)$/,
]

export const isPublicPath = (pathname) => PUBLIC_PATHS.some((re) => re.test(pathname))

const storage = {
  get(key, area = 'local') {
    try { return (area === 'local' ? localStorage : sessionStorage).getItem(key) } catch { return null }
  },
  set(key, value, area = 'local') {
    try { (area === 'local' ? localStorage : sessionStorage).setItem(key, value) } catch { /* private mode */ }
  },
}

const randomId = () => {
  try { return crypto.randomUUID() } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
  }
}

const currentRole = () => {
  const { isAuthenticated, user } = useAuthStore.getState()
  return isAuthenticated ? (user?.userRole || user?.role?.type || 'patient') : 'guest'
}

const isInternal = () => {
  if (STAFF_ROLES.has(currentRole())) storage.set(INTERNAL_KEY, '1')
  return storage.get(INTERNAL_KEY) === '1'
}

const getVisitorId = () => {
  let id = storage.get(VISITOR_KEY)
  if (!id) {
    id = randomId()
    storage.set(VISITOR_KEY, id)
  }
  return id
}

const readCampaign = () => {
  const params = new URLSearchParams(window.location.search)
  const utm = {}
  for (const key of UTM_KEYS) {
    const value = params.get(`utm_${key}`)
    if (value) utm[key] = value.slice(0, 150)
  }
  const click = params.get('fbclid') ? 'meta' : params.get('yclid') ? 'yandex' : params.get('gclid') ? 'google' : null
  return { utm, click }
}

const externalReferrer = () => {
  try {
    const ref = document.referrer
    if (!ref) return null
    return new URL(ref).host === window.location.host ? null : ref
  } catch {
    return null
  }
}

// Сессия — 30 минут без активности или новый переход по рекламной ссылке.
const getSession = () => {
  const now = Date.now()
  const campaign = readCampaign()
  const hasNewCampaign = Object.keys(campaign.utm).length > 0 || campaign.click
  let session = null
  try { session = JSON.parse(storage.get(SESSION_KEY) || 'null') } catch { session = null }

  if (!session || now - session.lastSeen > SESSION_TIMEOUT_MS || hasNewCampaign) {
    session = {
      id: randomId(),
      utm: campaign.utm,
      click: campaign.click,
      referrer: externalReferrer(),
    }
  }
  session.lastSeen = now
  storage.set(SESSION_KEY, JSON.stringify(session))
  return session
}

const send = (payload) => {
  const url = `${getApiBaseUrl()}/api/analytics/collect`
  // text/plain — «простой» запрос без CORS-preflight, его принимает sendBeacon.
  const body = JSON.stringify(payload)
  try {
    if (navigator.sendBeacon && navigator.sendBeacon(url, new Blob([body], { type: 'text/plain' }))) return
  } catch { /* fall back to fetch */ }
  fetch(url, { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'text/plain' } }).catch(() => {})
}

// Safari на iPadOS по умолчанию представляется Mac («Macintosh» в user-agent),
// и сервер записал бы iPad как компьютер. Отличает его только сенсорный экран.
const isTouchMac = () => {
  try {
    return /Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1
  } catch {
    return false
  }
}

const baseEvent = () => {
  const session = getSession()
  return {
    visitorId: getVisitorId(),
    sessionId: session.id,
    referrer: session.referrer,
    utm: session.utm,
    click: session.click,
    platform: isNativeMobileApp() ? 'app' : 'web',
    role: currentRole(),
    ...(isTouchMac() ? { touchMac: true } : {}),
  }
}

// ---- Яндекс Метрика и Meta Pixel ----

let tagsLoaded = false

const loadMarketingTags = () => {
  if (tagsLoaded || isNativeMobileApp() || typeof window === 'undefined') return
  tagsLoaded = true

  if (METRIKA_ID) {
    ;(function (m, e, t, r, i, k, a) {
      m[i] = m[i] || function () { (m[i].a = m[i].a || []).push(arguments) }
      m[i].l = 1 * new Date()
      k = e.createElement(t); a = e.getElementsByTagName(t)[0]; k.async = 1; k.src = r; a.parentNode.insertBefore(k, a)
    })(window, document, 'script', 'https://mc.yandex.ru/metrika/tag.js', 'ym')
    window.ym(METRIKA_ID, 'init', {
      defer: true, // просмотры отправляем сами и только для публичных страниц
      clickmap: false,
      webvisor: false,
      trackLinks: true,
      accurateTrackBounce: true,
    })
  }

  if (META_PIXEL_ID) {
    ;(function (f, b, e, v, n, t, s) {
      if (f.fbq) return
      n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments) }
      if (!f._fbq) f._fbq = n
      n.push = n; n.loaded = true; n.version = '2.0'; n.queue = []
      t = b.createElement(e); t.async = true; t.src = v
      s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s)
    })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js')
    // Pixel сам шлёт PageView на каждый переход SPA и собирает клики и
    // метаданные страницы — в том числе в кабинетах. Отключаем и то, и другое.
    window.fbq.disablePushState = true
    window.fbq('set', 'autoConfig', false, META_PIXEL_ID)
    window.fbq('init', META_PIXEL_ID)
  }
}

// Ни врача, ни направления, ни диагноза рекламным системам не передаём —
// только факт шага воронки.
const META_EVENTS = {
  sign_up: () => ['CompleteRegistration', {}],
  case_created: () => ['Lead', {}],
  booking_complete: () => ['Schedule', {}],
}

// ---- Публичный API ----

// Повторный вызов для того же пути сразу после первого — не новый просмотр:
// так срабатывают эффекты в StrictMode и повторные рендеры маршрута.
let lastPageview = { path: null, at: 0 }

export const trackPageview = (pathname) => {
  if (isInternal()) return
  const now = Date.now()
  if (lastPageview.path === pathname && now - lastPageview.at < 1500) return
  lastPageview = { path: pathname, at: now }
  send({ ...baseEvent(), kind: 'pageview', path: pathname })

  if (!isPublicPath(pathname)) return
  loadMarketingTags()
  if (METRIKA_ID && window.ym) {
    window.ym(METRIKA_ID, 'hit', window.location.origin + pathname + window.location.search, {
      referer: document.referrer || undefined,
    })
  }
  if (META_PIXEL_ID && window.fbq) window.fbq('track', 'PageView')
}

/**
 * События воронки: sign_up, case_created, price_request, booking_complete.
 */
export const trackEvent = (name, { value, paid = false } = {}) => {
  if (isInternal()) return
  const amount = Number.isFinite(Number(value)) ? Math.round(Number(value)) : undefined
  send({ ...baseEvent(), kind: 'event', name, value: amount })

  if (METRIKA_ID && window.ym) {
    window.ym(METRIKA_ID, 'reachGoal', name, amount ? { order_price: amount, currency: 'KZT' } : undefined)
  }
  if (META_PIXEL_ID && window.fbq && META_EVENTS[name]) {
    const [event, params] = META_EVENTS[name](amount, paid)
    window.fbq('track', event, params)
  }
}
