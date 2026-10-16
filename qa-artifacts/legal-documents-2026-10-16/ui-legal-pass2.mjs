// QA, второй проход: то, что первый не покрывал.
//   1. Текст на сайте = текст исходных .docx (сверка по словам, 8 файлов)
//   2. Язык документа и язык интерфейса не мешают друг другу
//   3. Печать, защита несохранённых правок, сбои сети, истёкшая сессия
//   4. Клавиатура, редактор на телефоне, скорость на самом длинном документе
// Стенд: продакшен-сборка (vite preview) :1342, Strapi :1344 на свежей копии базы.
//   PW=… CHROME=… ADMIN_EMAIL=… node ui-legal-pass2.mjs
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const QA_DIR = path.dirname(new URL(import.meta.url).pathname)
const { chromium } = await import(process.env.PW || 'playwright')
const SITE = 'http://localhost:1342'
const SHOTS = path.join(QA_DIR, 'screens')
const SOURCES = {
  offer: { ru: 'Оферта - для иностр.txt', kk: 'Оферта по иностр казакша.txt', en: 'англ_Оферта - для иностр.txt', zh: 'кит_Оферта - для иностр.txt' },
  consent: { ru: 'Согласие на сбор и обработку и ИС для иностранцев 24.09.26.txt', kk: 'Согласие на сбор и обработку и ИС по иностр казакша.txt', en: 'англ_Consent.txt', zh: 'кит_Согласие на сбор и обработку и ИС для иностранцев 24.09.26.txt' },
}

const results = []
const check = (id, name, ok, detail = '') => {
  results.push({ id, name, ok: !!ok, detail: String(detail).slice(0, 500) })
  console.log(`${ok ? 'PASS' : 'FAIL'}  [${id}] ${name}${ok ? '' : '  -> ' + String(detail).slice(0, 500)}`)
}
const browser = await chromium.launch({ executablePath: process.env.CHROME })
const openPage = async (url, { lang = 'ru', width = 1366, storageState } = {}) => {
  const context = await browser.newContext({ viewport: { width, height: width < 500 ? 844 : 900 }, storageState })
  // Язык интерфейса задаём только при первом заходе — дальше его меняет сам сайт.
  await context.addInitScript((l) => { try { if (!sessionStorage.getItem('qa-init')) { localStorage.setItem('i18nextLng', l); sessionStorage.setItem('qa-init', '1') } } catch { /* empty */ } }, lang)
  const page = await context.newPage()
  page.errors = []
  page.on('pageerror', (e) => page.errors.push(e.message))
  await page.goto(SITE + url, { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  return page
}

// =============================================================================
// 1. Сверка текста с исходниками
// =============================================================================
// Браузер снимает текст статьи, сверку по словам делает fidelity.py (difflib).
fs.mkdirSync(path.join(QA_DIR, 'rendered'), { recursive: true })
for (const [slug, files] of Object.entries(SOURCES)) {
  for (const lang of Object.keys(files)) {
    const page = await openPage(`/documents/${slug}?docLang=${lang}`)
    fs.writeFileSync(path.join(QA_DIR, 'rendered', `${slug}.${lang}.txt`), await page.locator('article').innerText())
    await page.context().close()
  }
}
execFileSync('python3', ['-I', path.join(QA_DIR, 'fidelity.py'), QA_DIR], { stdio: 'inherit' })
const fidelity = JSON.parse(fs.readFileSync(path.join(QA_DIR, 'fidelity.json'), 'utf8'))
// Единственное допустимое отличие: пометка «ОБРАЗЕЦ» стоит под заголовком формы, а не над ним.
const SAMPLE = new Set(['образец', 'үлгі', 'sample', '样 本'])
for (const [key, f] of Object.entries(fidelity)) {
  const missing = f.missing.filter((w) => !SAMPLE.has(w))
  const extra = f.extra.filter((w) => !SAMPLE.has(w))
  const moved = f.missing.length - missing.length
  check(`F.${key}`, `${key}: все ${f.sourceWords} слов исходного .docx на странице в том же порядке (перенесено пометок «образец»: ${moved})`,
    missing.length === 0 && extra.length === 0 && f.sourceWords === f.pageWords && moved === f.extra.length - extra.length,
    `исходник ${f.sourceWords} слов, на странице ${f.pageWords}; пропало: ${JSON.stringify(f.missing.slice(0, 6))}; лишнее: ${JSON.stringify(f.extra.slice(0, 6))}`)
}

// =============================================================================
// 2. Язык документа ≠ язык интерфейса
// =============================================================================
{
  const page = await openPage('/documents/offer', { lang: 'ru' })
  await page.locator('main [role="group"] button', { hasText: '中文' }).click()
  await page.waitForTimeout(700)
  const url = new URL(page.url())
  check('L.param', 'выбор 中文 пишет ?docLang=zh и не трогает ?lang', url.searchParams.get('docLang') === 'zh' && !url.searchParams.has('lang'), url.search)
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  const ui = await page.evaluate(() => ({ html: document.documentElement.lang, stored: localStorage.getItem('i18nextLng') }))
  const nav = await page.locator('header').innerText()
  const doc = await page.locator('article [lang]').first().getAttribute('lang')
  check('L.reload', 'после перезагрузки: интерфейс остался русским (и в памяти браузера), документ — китайский',
    ui.html === 'ru' && ui.stored === 'ru' && nav.includes('Главная') && doc === 'zh', JSON.stringify({ ...ui, doc }))

  // Ссылка из китайской оферты на согласие — согласие тоже на китайском.
  await page.locator('article a[href*="/documents/consent"]').first().click()
  await page.waitForURL(/\/documents\/consent/)
  await page.waitForTimeout(800)
  const consentLang = await page.locator('article [lang]').first().getAttribute('lang')
  check('L.crossLink', 'из китайской оферты по ссылке → согласие на китайском, сразу на нужной части',
    consentLang === 'zh' && page.url().includes('docLang=zh') && (await page.evaluate(() => document.getElementById(location.hash.slice(1))?.getBoundingClientRect().top)) < 200, page.url())

  // Выбор языка интерфейса в документе — параметр убирается.
  await page.locator('main [role="group"] button', { hasText: 'Русский' }).click()
  await page.waitForTimeout(500)
  check('L.cleanUrl', 'выбор языка, совпадающего с интерфейсом, убирает docLang из адреса', !page.url().includes('docLang'), page.url())
  await page.context().close()

  const kk = await openPage('/documents/consent?lang=kk', { lang: 'en' })
  const kkState = await kk.evaluate(() => document.documentElement.lang)
  check('L.hreflang', 'ссылка из поиска ?lang=kk: интерфейс и документ — на казахском', kkState === 'kk' && (await kk.locator('article [lang]').first().getAttribute('lang')) === 'kk', kkState)
  await kk.context().close()

  const hist = await openPage('/documents', { lang: 'ru' })
  await hist.locator('main a[href="/documents/offer"]').click()
  await hist.waitForURL(/\/documents\/offer/)
  await hist.waitForTimeout(500)
  await hist.locator('main [role="group"] button', { hasText: 'English' }).click()
  await hist.locator('main [role="group"] button', { hasText: '中文' }).click()
  await hist.waitForTimeout(400)
  await hist.goBack({ waitUntil: 'networkidle' })
  check('L.back', '«Назад» после смены языка документа возвращает на список, а не перебирает языки', new URL(hist.url()).pathname === '/documents', hist.url())
  await hist.context().close()
}

// =============================================================================
// 3. Печать, сбои, несохранённые правки, сессия
// =============================================================================
{
  const page = await openPage('/documents/consent')
  await page.emulateMedia({ media: 'print' })
  const breaks = await page.evaluate(() => [...document.querySelectorAll('.legal-document > div[id]')].map((el) => getComputedStyle(el).breakBefore))
  check('P.pageBreaks', 'печать: каждая часть, кроме первой, с новой страницы', breaks[0] !== 'page' && breaks.slice(1).every((b) => b === 'page'), JSON.stringify(breaks))
  await page.pdf({ path: path.join(QA_DIR, 'consent-ru-print.pdf'), format: 'A4' })
  check('P.pdf', 'печать в PDF на A4 проходит', fs.statSync(path.join(QA_DIR, 'consent-ru-print.pdf')).size > 50_000, '')
  await page.context().close()
}
{
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } })
  await context.addInitScript(() => localStorage.setItem('i18nextLng', 'ru'))
  const page = await context.newPage()
  let fail = true
  await page.route('**/api/legal-documents/offer**', (route) => (fail ? route.abort('connectionrefused') : route.continue()))
  await page.goto(SITE + '/documents/offer', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  const errorShown = await page.getByText('Не удалось загрузить документ').count()
  fail = false
  await page.getByRole('button', { name: 'Повторить' }).click()
  await page.waitForTimeout(1200)
  const recovered = (await page.locator('.legal-document > div[id]').count()) > 0
  check('P.networkError', 'API недоступен: понятная ошибка, «Повторить» загружает документ', errorShown > 0 && recovered, `error=${errorShown} recovered=${recovered}`)
  await context.close()
}

const adminCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
await adminCtx.addInitScript(() => { try { localStorage.setItem('i18nextLng', 'ru') } catch { /* empty */ } })
const admin = await adminCtx.newPage()
await admin.goto(SITE + '/login', { waitUntil: 'networkidle' })
await admin.fill('input[name="identifier"]', process.env.ADMIN_EMAIL)
await admin.fill('input[name="password"]', 'QaTest123!')
await admin.click('button[type="submit"]')
await admin.waitForURL(/\/admin/, { timeout: 15000 })
await admin.goto(SITE + '/admin/legal-documents', { waitUntil: 'networkidle' })
await admin.waitForTimeout(800)
const textarea = admin.locator('textarea')
{
  await textarea.click()
  await admin.keyboard.press('End')
  await admin.keyboard.type(' правка')
  let confirmText = null
  admin.once('dialog', (d) => { confirmText = d.message(); d.dismiss() })
  await admin.getByRole('tab', { name: /Согласие на обработку/ }).click()
  await admin.waitForTimeout(500)
  const stillOffer = (await textarea.inputValue()).includes(' правка')
  check('U.switchGuard', 'смена документа с несохранённой правкой спрашивает подтверждение; «Отмена» оставляет правку', confirmText?.includes('не сохранены') && stillOffer, `dialog=${confirmText} kept=${stillOffer}`)

  let unloadDialog = null
  admin.once('dialog', (d) => { unloadDialog = d.type(); d.dismiss() })
  await admin.close({ runBeforeUnload: true })
  await new Promise((r) => setTimeout(r, 800))
  check('U.beforeUnload', 'закрытие вкладки с несохранённой правкой — браузер спрашивает подтверждение', unloadDialog === 'beforeunload', `dialog=${unloadDialog}`)
}
{
  // Истёкшая сессия: сервер отвечает 401 на сохранение.
  const page = await adminCtx.newPage()
  await page.goto(SITE + '/admin/legal-documents', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  await page.route('**/api/legal-documents/offer', (route) => (route.request().method() === 'PUT' ? route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":{"status":401,"message":"Missing or invalid credentials"}}' }) : route.continue()))
  const ta = page.locator('textarea')
  await ta.click(); await page.keyboard.press('End'); await page.keyboard.type(' правка-401')
  await page.getByRole('button', { name: 'Сохранить' }).click()
  await page.waitForTimeout(1500)
  const after = { url: page.url(), toast: await page.getByText(/Не удалось сохранить|войдите|сессия/i).count() }
  fs.writeFileSync(path.join(QA_DIR, 'session-401.json'), JSON.stringify(after, null, 1))
  check('U.session401', 'сессия истекла при сохранении: админа переводит на вход с сообщением', after.url.includes('/login') && after.toast > 0, JSON.stringify(after))

  // Вход заново → в редакторе предложение восстановить правку.
  await page.unroute('**/api/legal-documents/offer')
  await page.fill('input[name="identifier"]', process.env.ADMIN_EMAIL)
  await page.fill('input[name="password"]', 'QaTest123!')
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/admin/, { timeout: 15000 })
  await page.goto(SITE + '/admin/legal-documents', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  const banner = await page.getByText('Найдена несохранённая правка').count()
  await page.getByRole('button', { name: 'Восстановить' }).click()
  const restored = (await page.locator('textarea').inputValue()).includes(' правка-401')
  check('U.backupRestore', 'после повторного входа редактор предлагает восстановить потерянную правку, и она возвращается', banner > 0 && restored, `banner=${banner} restored=${restored}`)
  await page.getByRole('button', { name: 'Отменить изменения' }).click()
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  check('U.backupDiscard', '«Отменить изменения» удаляет сохранённую копию — предложение больше не появляется', await page.getByText('Найдена несохранённая правка').count() === 0, '')
  await page.close()
}

// =============================================================================
// 4. Клавиатура, телефон, скорость
// =============================================================================
{
  const page = await openPage('/documents/offer')
  const zh = page.locator('main [role="group"] button', { hasText: '中文' })
  await zh.focus()
  const ring = await zh.evaluate((el) => { const s = getComputedStyle(el); return `${s.outlineStyle} ${s.outlineWidth} ${s.boxShadow}` })
  await page.keyboard.press('Enter')
  await page.waitForTimeout(700)
  check('K.langSwitch', 'переключатель языка работает с клавиатуры (Enter)', (await page.locator('article [lang]').first().getAttribute('lang')) === 'zh', '')
  await page.keyboard.press('Shift+Tab')
  await page.keyboard.press('Tab')
  const focusedVisible = await page.evaluate(() => { const el = document.activeElement; const s = getComputedStyle(el); return el.tagName + ' ' + s.outlineStyle + ' ' + s.outlineWidth })
  check('K.focusVisible', 'у кнопки в фокусе с клавиатуры виден контур', !/none|0px/.test(focusedVisible.split(' ').slice(1).join(' ')), `${focusedVisible} (до: ${ring})`)
  const tocLink = page.locator('nav[aria-label] a').first()
  await tocLink.focus()
  check('K.toc', 'пункты оглавления доступны с клавиатуры', await tocLink.evaluate((el) => el === document.activeElement), '')
  await page.context().close()
}
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, storageState: await adminCtx.storageState() })
  const page = await ctx.newPage()
  await page.goto(SITE + '/admin/legal-documents', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  await page.screenshot({ path: path.join(SHOTS, 'admin-editor-390.png'), fullPage: false })
  console.log('mobile admin url:', page.url())
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
  const tabs = await page.getByRole('tab').count()
  const editable = await page.locator('textarea').isEditable({ timeout: 5000 }).catch(() => false)
  check('M.adminMobile', 'редактор на 390 px: без горизонтального скролла, вкладки и поле ввода доступны', overflow <= 0 && tabs >= 6 && editable, `overflow=${overflow} tabs=${tabs}`)
  await page.screenshot({ path: path.join(SHOTS, 'admin-editor-390.png'), fullPage: false })
  await ctx.close()
}
{
  // Самый длинный текст (оферта, ru ~40 тыс. символов) на слабом устройстве: ЦП замедлен в 4 раза.
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  await ctx.addInitScript(() => localStorage.setItem('i18nextLng', 'ru'))
  const page = await ctx.newPage()
  const cdp = await ctx.newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  const t0 = Date.now()
  await page.goto(SITE + '/documents/offer', { waitUntil: 'domcontentloaded' })
  await page.locator('.legal-document > div[id]').first().waitFor()
  const loadMs = Date.now() - t0
  check('S.load', `оферта на «слабом телефоне» (ЦП ×4): текст на экране за ${loadMs} мс (< 3000)`, loadMs < 3000, `${loadMs} мс`)
  await ctx.close()

  const actx = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState: await adminCtx.storageState() })
  const ap = await actx.newPage()
  const acdp = await actx.newCDPSession(ap)
  await ap.goto(SITE + '/admin/legal-documents', { waitUntil: 'networkidle' })
  await ap.waitForTimeout(800)
  await acdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  const ta = ap.locator('textarea')
  await ta.click()
  await ta.evaluate((el) => el.setSelectionRange(el.value.length, el.value.length))
  const t1 = Date.now()
  await ap.keyboard.type('абвгдеёжзийклмнопрст', { delay: 0 })
  await ap.waitForFunction(() => document.querySelector('textarea').value.endsWith('абвгдеёжзийклмнопрст'), null, { timeout: 60000 })
  const perKey = Math.round((Date.now() - t1) / 20)
  check('S.typing', `набор в редакторе с предпросмотром (ЦП ×4): ${perKey} мс на символ (< 100)`, perKey < 100, `${perKey} мс`)
  await actx.close()
}

await adminCtx.close()
await browser.close()
const failed = results.filter((r) => !r.ok)
fs.writeFileSync(path.join(QA_DIR, process.env.OUT || 'ui-legal-pass2-results.json'), JSON.stringify(results, null, 1))
console.log(`\n${results.length - failed.length}/${results.length} passed`)
