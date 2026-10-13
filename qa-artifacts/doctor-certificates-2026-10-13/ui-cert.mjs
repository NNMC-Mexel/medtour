// UI: admin creates a doctor with certificates, the public page shows them, the doctor edits them.
import { createRequire } from 'module'
import fs from 'fs'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.HOME + '/.npm/_npx/705bc6b22212b352/node_modules/playwright')
const API = 'http://127.0.0.1:1351', APP = 'http://localhost:1343'
const DIR = new URL('./', import.meta.url).pathname
const OUT = DIR + 'screens/'
const results = []
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail: String(detail).slice(0, 300) }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  -> ' + String(detail).slice(0, 300)}`) }
const visible = (loc, timeout = 8000) => loc.first().waitFor({ state: 'visible', timeout }).then(() => true, () => false)
let ip = 1
const api = async (method, url, { body, jwt, form } = {}) => {
  const headers = { 'X-Forwarded-For': `10.60.0.${ip++}` }
  if (!form) headers['Content-Type'] = 'application/json'
  if (jwt) headers.Authorization = `Bearer ${jwt}`
  const r = await fetch(API + url, { method, headers, body: form || (body && JSON.stringify(body)) })
  const t = await r.text(); try { return { status: r.status, json: JSON.parse(t) } } catch { return { status: r.status, json: null } }
}
const browser = await chromium.launch({ channel: 'chrome' })
const dialogs = []
const newPage = async (viewport = { width: 1366, height: 900 }, lang = 'ru') => {
  const ctx = await browser.newContext({ viewport, locale: `${lang}-KZ` })
  await ctx.addInitScript((l) => { try { localStorage.setItem('i18nextLng', l) } catch {} }, lang)
  const page = await ctx.newPage()
  page.on('dialog', (d) => { dialogs.push(d.message()); d.dismiss() })
  page.on('pageerror', (e) => dialogs.push('pageerror: ' + e.message))
  return page
}
const uiLogin = async (page, identifier, password) => {
  await page.goto(APP + '/login')
  await page.fill('input[name="identifier"]', identifier)
  await page.fill('input[name="password"]', password)
  await page.click('button[type="submit"]')
}

// 1. Admin creates a doctor with two certificates
let docId
{
  const page = await newPage()
  await uiLogin(page, 'qa-admin@qa.invalid', 'QaMedtour1!x')
  await page.waitForURL('**/admin**', { timeout: 15000 })
  await page.goto(APP + '/admin/doctors')
  await page.getByRole('button', { name: 'Добавить врача' }).click()
  const dlg = page.getByRole('dialog')
  await dlg.getByLabel('Логин').fill('qa-ui-doc')
  await dlg.locator('input[type="email"]').fill('qa-ui-doc@qa.invalid')
  const pw = dlg.locator('input[type="password"]')
  await pw.nth(0).fill('UiDoctor1!pass'); await pw.nth(1).fill('UiDoctor1!pass')
  await dlg.getByLabel('ФИО').first().fill('QA Ui Doctor')
  await dlg.getByLabel('Номер лицензии').fill('QA-LIC-UI')
  await dlg.getByTestId('certificates-input').setInputFiles([DIR + 'sample.pdf', DIR + 'sample.jpg'])
  check('admin form: two certificates appear in the list after upload', await visible(dlg.getByText('sample', { exact: true }).nth(1)) || (await dlg.locator('li', { hasText: 'sample' }).count()) === 2, await dlg.locator('li').count())
  await dlg.locator('li', { hasText: 'sample' }).first().scrollIntoViewIfNeeded()
  await page.screenshot({ path: OUT + '01-admin-create-with-certificates.png' })
  await dlg.getByTestId('certificates-input').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('x') })
  check('admin form: a .txt file is refused with a clear message', await visible(dlg.getByText('подходят только PDF, JPG, PNG или WebP')))
  await page.getByRole('button', { name: 'Создать' }).click()
  await page.waitForTimeout(2500)
  const admin = (await api('POST', '/api/auth/local', { body: { identifier: 'qa-admin@qa.invalid', password: 'QaMedtour1!x' } })).json?.jwt
  const list = await api('GET', '/api/doctors?populate=*&filters[fullName][$eq]=QA Ui Doctor', { jwt: admin })
  const created = list.json?.data?.[0]
  docId = created?.documentId
  check('admin form: doctor created with 2 certificates', created?.certificates?.length === 2, JSON.stringify(created?.certificates?.map((c) => c.name)))
  // edit: certificates are loaded into the form; remove one and save
  await page.locator('tr', { hasText: 'QA Ui Doctor' }).getByRole('button', { name: 'Редактировать' }).first().click()
  await page.getByRole('dialog').waitFor({ timeout: 8000 })
  await page.waitForTimeout(500)
  const edit = page.getByRole('dialog')
  check('admin edit: existing certificates are shown', (await edit.locator('li', { hasText: 'sample' }).count()) === 2, await edit.locator('li', { hasText: 'sample' }).count())
  await edit.locator('li', { hasText: 'sample' }).first().getByRole('button').click()
  await page.getByRole('button', { name: 'Сохранить' }).click()
  await page.waitForTimeout(2500)
  const after = await api('GET', `/api/doctors/${docId}?populate=*`)
  check('admin edit: removing one certificate is saved', after.json?.data?.certificates?.length === 1, after.json?.data?.certificates?.length)
  check('admin edit: save toast is translated (not common.saved)', !(await page.locator('body').innerText()).includes('common.saved'))
  await page.context().close()
}

// 2. Doctor manages certificates in the profile
{
  const page = await newPage()
  await uiLogin(page, 'qa-ui-doc@qa.invalid', 'UiDoctor1!pass')
  await page.waitForURL('**/doctor**', { timeout: 15000 })
  await page.goto(APP + '/doctor/profile')
  check('doctor profile: certificates card with the existing one', await visible(page.getByText('Сертификаты и дипломы', { exact: true })) && (await page.locator('li', { hasText: 'sample' }).count()) === 1)
  await page.getByTestId('certificates-input').setInputFiles([DIR + 'sample.png'])
  await page.waitForTimeout(2000)
  check('doctor profile: upload saves immediately (2 in the list)', (await page.locator('li', { hasText: 'sample' }).count()) === 2)
  await page.reload()
  await page.getByText('Сертификаты и дипломы', { exact: true }).waitFor({ timeout: 10000 })
  await page.waitForTimeout(800)
  check('doctor profile: survives reload', (await page.locator('li', { hasText: 'sample' }).count()) === 2)
  await page.locator('li', { hasText: 'sample' }).last().scrollIntoViewIfNeeded()
  await page.screenshot({ path: OUT + '02-doctor-profile-certificates.png' })
  await page.locator('li', { hasText: 'sample' }).first().getByRole('button').click()
  await page.waitForTimeout(1500)
  const pub = await api('GET', `/api/doctors/${docId}?populate=*`)
  check('doctor profile: removing updates the public data', pub.json?.data?.certificates?.length === 1, pub.json?.data?.certificates?.length)
  await page.getByTestId('certificates-input').setInputFiles([DIR + 'sample.pdf'])
  await page.waitForTimeout(2000)
  check('doctor profile: PDF added back', (await api('GET', `/api/doctors/${docId}?populate=*`)).json?.data?.certificates?.length === 2)
  await page.getByTestId('certificates-input').setInputFiles({ name: 'Сертификат кардиолога 2024.pdf', mimeType: 'application/pdf', buffer: fs.readFileSync(DIR + 'sample.pdf') })
  check('doctor profile: a Cyrillic file name becomes a readable title', await visible(page.getByText('Сертификат кардиолога 2024', { exact: true }), 10000))
  await page.context().close()
}

// 3. HTML in a certificate caption (set through the API)
{
  const doctorJwt = (await api('POST', '/api/auth/local', { body: { identifier: 'qa-ui-doc@qa.invalid', password: 'UiDoctor1!pass' } })).json?.jwt
  const form = new FormData()
  // Strapi refuses "<" and ">" in file names, so the HTML goes into the caption,
  // which the certificate title prefers.
  form.append('files', new Blob([fs.readFileSync(DIR + 'sample.pdf')], { type: 'application/pdf' }), 'caption-test.pdf')
  form.append('fileInfo', JSON.stringify({ caption: '<img src=x onerror=window.__xss=1>' }))
  const up = await api('POST', '/api/upload', { jwt: doctorJwt, form })
  const current = (await api('GET', `/api/doctors/${docId}?populate=*`)).json?.data?.certificates?.map((c) => c.id) || []
  const put = await api('PUT', `/api/doctors/${docId}`, { jwt: doctorJwt, body: { data: { certificates: [...current, up.json?.[0]?.id] } } })
  check('setup: certificate with HTML in its caption attached', put.status === 200 && up.json?.[0]?.caption?.includes('<img'), `${put.status} ${up.status} ${JSON.stringify(up.json?.[0]?.caption)}`)
}

// 4. Public page, anonymous, desktop + mobile + other languages
for (const [viewport, lang, title, shot] of [
  [{ width: 1366, height: 900 }, 'ru', 'Сертификаты и дипломы', '03-public-desktop.png'],
  [{ width: 390, height: 844 }, 'ru', 'Сертификаты и дипломы', '04-public-mobile.png'],
  [{ width: 390, height: 844 }, 'en', 'Certificates and diplomas', '05-public-mobile-en.png'],
  [{ width: 1366, height: 900 }, 'kk', 'Сертификаттар мен дипломдар', null],
]) {
  const page = await newPage(viewport, lang)
  await page.goto(`${APP}/doctors/${docId}`)
  const ok = await visible(page.getByText(title, { exact: true }), 12000)
  const tiles = page.locator('a[target="_blank"]', { has: page.locator('img, svg') })
  check(`public page (${lang}, ${viewport.width}px): section "${title}" with 3 tiles`, ok && (await tiles.count()) >= 3, await tiles.count())
  if (shot) {
    await page.getByText(title, { exact: true }).first().scrollIntoViewIfNeeded()
    await page.waitForTimeout(500)
    await page.screenshot({ path: OUT + shot })
  }
  if (viewport.width === 390) {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    check(`public page (${lang}, mobile): no horizontal scroll`, overflow <= 1, overflow)
  }
  const xss = await page.evaluate(() => window.__xss)
  check(`public page (${lang}): HTML in a certificate caption is shown as text, not executed`, !xss && (await page.locator('body').innerText()).includes('<img src=x onerror'), '')
  if (lang === 'ru' && viewport.width === 1366) {
    const href = await page.locator('a[target="_blank"]', { hasText: 'sample' }).first().getAttribute('href')
    const res = await fetch(href)
    check('public page: certificate link opens for an anonymous visitor', res.status === 200, `${res.status} ${href}`)
    const rel = await page.locator('a[target="_blank"]', { hasText: 'sample' }).first().getAttribute('rel')
    check('public page: links use rel="noopener noreferrer"', rel === 'noopener noreferrer', rel)
  }
  await page.context().close()
}

// 5. Doctor without certificates: no empty section
{
  const page = await newPage()
  const others = await api('GET', '/api/doctors?populate=*')
  const empty = others.json?.data?.find((d) => !(d.certificates || []).length)
  if (empty) {
    await page.goto(`${APP}/doctors/${empty.documentId}`)
    await page.waitForTimeout(3000)
    check('public page: no certificates section when there are none', (await page.getByText('Сертификаты и дипломы', { exact: true }).count()) === 0)
  }
  await page.context().close()
}

check('no JS dialogs or page errors during the run', dialogs.length === 0, dialogs.join(' | '))
await browser.close()
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
fs.writeFileSync(DIR + 'ui-cert-results.json', JSON.stringify(results, null, 2))
process.exitCode = failed.length ? 1 : 0
