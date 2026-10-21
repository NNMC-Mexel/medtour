// Общие помощники QA-наборов 2026-10-21 (туризм, шапка, уведомления).
// Стенд: Strapi API (по умолчанию :1344), Vite (:1342). Пароль QA-учёток — QaTest123!
import { createRequire } from 'module'
import fs from 'fs'

const require = createRequire(import.meta.url)
export const { chromium } = require(process.env.PLAYWRIGHT_PATH || process.env.HOME + '/.npm/_npx/705bc6b22212b352/node_modules/playwright')

export const API = process.env.QA_API || 'http://localhost:1344'
export const APP = process.env.QA_APP || 'http://localhost:1342'
export const PW = 'QaTest123!'
export const DIR = new URL('./', import.meta.url).pathname
export const OUT = DIR + 'screens/'
export const PUB = new URL('../../frontend/public/tourism/', import.meta.url).pathname

export const USERS = {
  admin: 'testadmin@mail.ru',
  manager: 'renysnorthside2@gmail.com',
  manager2: 'qa_mgr_1781276086@test.kz',
  coordinator: 'test2@mail.ru',
  doctor: 'test91@mail.kz',
  patient: 'qa_pat_1781276086@test.kz',
}

export function createReport(name) {
  const results = []
  const check = (id, ok, detail = '') => {
    results.push({ id, ok: !!ok, detail: ok ? '' : String(detail).slice(0, 400) })
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}${ok ? '' : '  -> ' + String(detail).slice(0, 300)}`)
  }
  const save = (suffix = '') => {
    const passed = results.filter((r) => r.ok).length
    fs.writeFileSync(`${DIR}${name}-results${suffix}.json`, JSON.stringify({ passed, total: results.length, results }, null, 2))
    console.log(`\n${passed}/${results.length} passed`)
    return passed === results.length
  }
  return { results, check, save }
}

export const visible = (loc, timeout = 6000) => loc.first().waitFor({ state: 'visible', timeout }).then(() => true, () => false)
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// JWT кешируются: лимит входа — 10 попыток за 15 минут с одного IP.
const TOKENS = `${DIR}.tokens-${new URL(API).port}.json`
const tokenCache = fs.existsSync(TOKENS) ? JSON.parse(fs.readFileSync(TOKENS, 'utf8')) : {}
export async function jwtFor(email) {
  if (tokenCache[email]) {
    const probe = await fetch(`${API}/api/users/me`, { headers: { Authorization: `Bearer ${tokenCache[email]}` } })
    if (probe.ok) return tokenCache[email]
  }
  const res = await fetch(`${API}/api/auth/local`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier: email, password: PW }) })
  const body = await res.json()
  if (!body.jwt) throw new Error(`login ${email}: ${res.status} ${JSON.stringify(body).slice(0, 200)}`)
  tokenCache[email] = body.jwt
  fs.writeFileSync(TOKENS, JSON.stringify(tokenCache))
  return body.jwt
}

export async function api(method, path, { jwt, body } = {}) {
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (jwt) headers.Authorization = `Bearer ${jwt}`
  const res = await fetch(API + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch { /* not json */ }
  return { status: res.status, json, text }
}

export async function launch() {
  const browser = await chromium.launch({ channel: 'chrome' })
  const errors = []
  const newPage = async ({ viewport = { width: 1440, height: 900 }, lang = 'ru', as, hasTouch = false } = {}) => {
    const ctx = await browser.newContext({ viewport, locale: `${lang}-KZ`, hasTouch })
    let session = null
    if (as) {
      const jwt = await jwtFor(USERS[as] || as)
      const me = await api('GET', '/api/users/me?populate=role', { jwt })
      session = JSON.stringify({ state: { token: jwt, user: me.json, isAuthenticated: true }, version: 0 })
    }
    await ctx.addInitScript(([l, s]) => {
      try {
        localStorage.setItem('i18nextLng', l)
        if (s && !sessionStorage.getItem('qa-session-set')) {
          localStorage.setItem('auth-storage', s)
          sessionStorage.setItem('qa-session-set', '1')
        }
      } catch { /* storage blocked */ }
    }, [lang, session])
    const page = await ctx.newPage()
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
    page.on('response', (r) => { if (r.status() >= 500) errors.push(`HTTP ${r.status()} ${r.request().method()} ${r.url().slice(0, 160)}`) })
    page.on('console', (m) => {
      if (m.type() === 'error' && !/WebSocket|socket\.io|favicon|Failed to load resource/i.test(m.text())) errors.push(`console: ${m.text().slice(0, 200)}`)
    })
    return page
  }
  return { browser, newPage, errors }
}
