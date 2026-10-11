// UI checks: locked-login message, expired reset link, admin password modal, XSS in the users list.
import { createRequire } from 'module'
import fs from 'fs'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.HOME + '/.npm/_npx/705bc6b22212b352/node_modules/playwright')
const API = 'http://127.0.0.1:1351', APP = 'http://localhost:1343'
const OUT = new URL('./screens/', import.meta.url).pathname
const results = []
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail: String(detail) }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail && !ok ? '  -> ' + detail : ''}`) }
let seq = 1
const post = (url, body) => fetch(API + url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `198.51.100.9, 10.77.0.${seq++}` }, body: JSON.stringify(body) })
// Lock qa-manager with 10 failures from different addresses.
for (let i = 0; i < 10; i++) await post('/api/auth/local', { identifier: 'qa-manager@qa.invalid', password: `Nope${i}!pass` })

const browser = await chromium.launch({ channel: 'chrome' })
const dialogs = []
const newPage = async (viewport = { width: 1366, height: 900 }, lang = 'ru') => {
  const ctx = await browser.newContext({ viewport, locale: `${lang}-KZ` })
  await ctx.addInitScript((l) => { try { localStorage.setItem('i18nextLng', l) } catch {} }, lang)
  const page = await ctx.newPage()
  page.on('dialog', (d) => { dialogs.push(d.message()); d.dismiss() })
  return page
}
const uiLogin = async (page, identifier, password) => {
  await page.goto(APP + '/login')
  await page.fill('input[name="identifier"]', identifier)
  await page.fill('input[name="password"]', password)
  await page.click('button[type="submit"]')
}
{
  const page = await newPage()
  await uiLogin(page, 'qa-manager@qa.invalid', 'QaMedtour1!x')
  const msg = page.getByText('Вход в аккаунт закрыт на 15 минут').first()
  check('login page explains the lock', await msg.waitFor({ state: 'visible', timeout: 8000 }).then(() => true, () => false), await page.locator('body').innerText().then((t) => t.slice(0, 300)))
  await page.screenshot({ path: OUT + '01-login-locked.png' })
  await page.context().close()
}
{
  const page = await newPage()
  await page.goto(APP + '/reset-password?code=deadbeef')
  const pw = page.locator('input[type="password"]')
  await pw.nth(0).fill('Fresh1!passX'); await pw.nth(1).fill('Fresh1!passX')
  await page.click('button[type="submit"]')
  const link = page.getByRole('link', { name: 'Запросить новую ссылку' })
  check('invalid reset link: explanation + "request new link"', await link.waitFor({ state: 'visible', timeout: 8000 }).then(() => true, () => false))
  await page.screenshot({ path: OUT + '02-reset-invalid.png' })
  await page.context().close()
}
{
  const page = await newPage()
  await uiLogin(page, 'qa-admin@qa.invalid', 'QaMedtour1!x')
  await page.waitForURL('**/admin**', { timeout: 15000 })
  await page.goto(APP + '/admin/users')
  const row = page.locator('tr', { hasText: 'qa-pat-ru' }).first()
  await row.waitFor({ timeout: 15000 })
  check('HTML in a user name is shown as text, not executed', (await page.locator('body').innerText()).includes('<img src=x onerror=alert(1)>') && dialogs.length === 0, dialogs.join('|'))
  await row.getByRole('button', { name: 'Пароль' }).click()
  const modal = page.getByRole('dialog')
  check('password modal opens with the user name', await page.getByText('Пароль: QA Пациент').waitFor({ state: 'visible', timeout: 5000 }).then(() => true, () => false))
  await page.waitForTimeout(400)
  await page.screenshot({ path: OUT + '03-password-modal.png' })
  await page.getByRole('button', { name: 'Отправить ссылку' }).click()
  check('send link -> confirmation with email', await page.getByText('Письмо отправлено на qa-pat-ru@qa.invalid').first().waitFor({ state: 'visible', timeout: 8000 }).then(() => true, () => false))
  const pw = page.locator('[role="dialog"] input[type="password"], form input[autocomplete="new-password"]')
  await pw.nth(0).fill('Weakpass'); await pw.nth(1).fill('Weakpass')
  await page.getByRole('button', { name: 'Сменить пароль' }).click()
  check('weak password blocked in the modal', await page.getByRole('alert').waitFor({ state: 'visible', timeout: 3000 }).then(() => true, () => false))
  await pw.nth(0).fill('UiSet1!passw'); await pw.nth(1).fill('UiSet1!passw0')
  await page.getByRole('button', { name: 'Сменить пароль' }).click()
  check('mismatch blocked in the modal', (await page.getByRole('alert').innerText().catch(() => '')).length > 0)
  await pw.nth(1).fill('UiSet1!passw')
  await page.getByRole('button', { name: 'Сменить пароль' }).click()
  check('password set -> toast, modal closes', await page.getByText('Пароль изменён').first().waitFor({ state: 'visible', timeout: 8000 }).then(() => true, () => false))
  const r = await post('/api/auth/local', { identifier: 'qa-pat-ru@qa.invalid', password: 'UiSet1!passw' })
  check('new password works via API', r.status === 200, r.status)
  // own row: the modal asks for the current password instead of setting one
  await page.locator('tr', { hasText: 'qa-admin@qa.invalid' }).first().getByRole('button', { name: 'Пароль' }).click()
  check('own account: form with the current password', await page.getByText('Сменить свой пароль').first().waitFor({ state: 'visible', timeout: 5000 }).then(() => true, () => false)
    && await page.locator('input[autocomplete="current-password"]').count() === 1)
  await page.keyboard.press('Escape')
  // edit modal: password fields replaced by a button that opens the modal
  await page.locator('tr', { hasText: 'qa-pat-ru' }).first().getByRole('button', { name: /Редакт|Изменить|edit/i }).first().click().catch(async () => {
    await page.locator('tr', { hasText: 'qa-pat-ru' }).first().locator('button').first().click()
  })
  await page.waitForTimeout(500)
  check('edit modal has no password inputs', (await page.locator('[role="dialog"] input[type="password"]').count()) === 0)
  await page.screenshot({ path: OUT + '04-edit-modal.png' })
  const btn = page.locator('[role="dialog"]').getByRole('button', { name: 'Пароль' })
  await btn.click()
  check('edit modal "Password" opens the password modal', await page.getByText('Пароль: QA Пациент').waitFor({ state: 'visible', timeout: 5000 }).then(() => true, () => false))
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  // save in the edit modal: translated toast, not the raw key
  await page.locator('tr', { hasText: 'qa-pat-ru' }).first().locator('button').first().click()
  await page.locator('[role="dialog"]').getByRole('button', { name: 'Сохранить' }).click()
  check('edit save toast is translated ("Сохранено", not common.saved)', await page.getByText('Сохранено').first().waitFor({ state: 'visible', timeout: 6000 }).then(() => true, () => false)
    && !(await page.locator('body').innerText()).includes('common.saved'))
  await page.context().close()
}
{
  // admin changes their own password from the modal and stays signed in
  const page = await newPage()
  await uiLogin(page, 'qa-admin2@qa.invalid', 'QaMedtour1!x')
  await page.waitForURL('**/admin**', { timeout: 15000 })
  await page.goto(APP + '/admin/users')
  await page.locator('tr', { hasText: 'qa-admin2@qa.invalid' }).first().getByRole('button', { name: 'Пароль' }).click()
  await page.locator('input[autocomplete="current-password"]').fill('WrongCurrent1!')
  const pw = page.locator('[role="dialog"] input[autocomplete="new-password"]')
  await pw.nth(0).fill('SelfNew1!pass'); await pw.nth(1).fill('SelfNew1!pass')
  await page.getByRole('button', { name: 'Сменить пароль' }).click()
  check('own password: wrong current password -> clear message', await page.getByText('Текущий пароль введён неверно').first().waitFor({ state: 'visible', timeout: 6000 }).then(() => true, () => false))
  await page.locator('input[autocomplete="current-password"]').fill('QaMedtour1!x')
  await page.getByRole('button', { name: 'Сменить пароль' }).click()
  check('own password: changed, toast shown', await page.getByText('Пароль изменён').first().waitFor({ state: 'visible', timeout: 6000 }).then(() => true, () => false))
  await page.screenshot({ path: OUT + '06-own-password-done.png' })
  await page.goto(APP + '/admin/doctors')
  await page.waitForTimeout(1500)
  check('own password: still signed in after the change (new token kept)', page.url().includes('/admin/doctors'), page.url())
  const oldPw = await post('/api/auth/local', { identifier: 'qa-admin2@qa.invalid', password: 'QaMedtour1!x' })
  const newPw = await post('/api/auth/local', { identifier: 'qa-admin2@qa.invalid', password: 'SelfNew1!pass' })
  check('own password: old fails, new works', oldPw.status === 400 && newPw.status === 200, `${oldPw.status}/${newPw.status}`)
  await page.context().close()
}
for (const [lang, text] of [['en', 'The account is locked for 15 minutes'], ['kk', '15 минутқа жабылды']]) {
  const page = await newPage({ width: 390, height: 844 }, lang)
  await uiLogin(page, 'qa-manager@qa.invalid', 'QaMedtour1!x')
  check(`login lock message in ${lang} (mobile)`, await page.getByText(text).first().waitFor({ state: 'visible', timeout: 8000 }).then(() => true, () => false))
  await page.screenshot({ path: OUT + `07-login-locked-${lang}.png` })
  await page.context().close()
}
{
  const page = await newPage({ width: 390, height: 844 })
  await uiLogin(page, 'qa-admin@qa.invalid', 'QaMedtour1!x')
  await page.waitForURL('**/admin**', { timeout: 15000 })
  await page.goto(APP + '/admin/users')
  const row = page.locator('tr', { hasText: 'qa-pat-ru' }).first()
  await row.waitFor({ timeout: 15000 })
  await row.getByRole('button', { name: 'Пароль' }).scrollIntoViewIfNeeded()
  await row.getByRole('button', { name: 'Пароль' }).click()
  await page.getByText('Пароль: QA Пациент').waitFor({ timeout: 5000 })
  await page.waitForTimeout(400)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  check('mobile: modal fits without horizontal scroll', overflow <= 1, overflow)
  await page.screenshot({ path: OUT + '05-password-modal-mobile.png' })
  await page.context().close()
}
await browser.close()
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
fs.writeFileSync(new URL('./ui-results.json', import.meta.url), JSON.stringify(results, null, 2))
process.exit(failed.length ? 1 : 0)
