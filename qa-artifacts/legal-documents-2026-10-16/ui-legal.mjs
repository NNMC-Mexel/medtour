// QA: правовые документы (оферта, согласие) — API, публичные страницы, редактор в админке.
// Стенд: копия локальной базы server/.tmp/qa-legal.db, Strapi :1344, Vite :1342.
// Пользователи синтетические; прод не затрагивается.
//
//   PW=<playwright/index.mjs> CHROME=<chrome> ADMIN_EMAIL=… PATIENT_EMAIL=… node ui-legal.mjs
import fs from 'node:fs'
import path from 'node:path'

const QA_DIR = path.dirname(new URL(import.meta.url).pathname)
const ROOT = path.resolve(QA_DIR, '../..')
const { chromium } = await import(process.env.PW || 'playwright')
const { parseLegalMarkup } = await import(path.join(ROOT, 'frontend/src/config/legalMarkup.js'))
const SITE = 'http://localhost:1342', API = 'http://localhost:1344'
const PASSWORD = 'QaTest123!'
const SHOTS = path.join(QA_DIR, 'screens')
fs.mkdirSync(SHOTS, { recursive: true })
const LANGS = ['ru', 'kk', 'en', 'zh']
const SEEDS = Object.fromEntries(['offer', 'consent'].map((slug) => [slug, JSON.parse(fs.readFileSync(path.join(ROOT, `server/src/api/legal-document/seed/${slug}.json`), 'utf8'))]))
const tr = Object.fromEntries(['ru', 'en', 'kk'].map((l) => [l, JSON.parse(fs.readFileSync(path.join(ROOT, `frontend/src/i18n/locales/${l}/translation.json`), 'utf8'))]))

const results = []
const check = (id, name, ok, detail = '') => {
  results.push({ id, name, ok: !!ok, detail: String(detail).slice(0, 400) })
  console.log(`${ok ? 'PASS' : 'FAIL'}  [${id}] ${name}${ok ? '' : '  -> ' + String(detail).slice(0, 400)}`)
}
const req = async (method, url, { body, jwt } = {}) => {
  const headers = { 'Content-Type': 'application/json' }
  if (jwt) headers.Authorization = `Bearer ${jwt}`
  const res = await fetch(API + url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  const text = await res.text(); let json = null; try { json = JSON.parse(text) } catch { /* not json */ }
  return { status: res.status, json, text }
}
const login = async (email) => (await req('POST', '/api/auth/local', { body: { identifier: email, password: PASSWORD } })).json?.jwt
const adminJwt = await login(process.env.ADMIN_EMAIL)
const patientJwt = await login(process.env.PATIENT_EMAIL)
check('setup.login', 'вход QA-админа и QA-пациента', adminJwt && patientJwt, '')

// =============================================================================
// A. API: чтение, доступ, валидация
// =============================================================================
{
  const list = await req('GET', '/api/legal-documents')
  const docs = list.json?.data || []
  check('A.list', 'список: оферта и согласие, 4 языка, без текстов документов',
    list.status === 200 && docs.map((d) => d.slug).join() === 'offer,consent' && docs.every((d) => d.languages.join() === 'ru,kk,en,zh') && !list.text.includes('"body"'),
    list.text.slice(0, 300))
  for (const slug of ['offer', 'consent']) {
    for (const lang of LANGS) {
      const r = await req('GET', `/api/legal-documents/${slug}?lang=${lang}`)
      const d = r.json?.data
      check(`A.get.${slug}.${lang}`, `${slug} (${lang}): текст = исходный, заголовок на языке`,
        r.status === 200 && d.lang === lang && d.body === SEEDS[slug].body[lang] && d.title === SEEDS[slug].title[lang] && d.revisionDate === '2026-09-24' && !('id' in d) && !('documentId' in d),
        JSON.stringify({ status: r.status, lang: d?.lang, len: d?.body?.length }))
    }
  }
  const fr = await req('GET', '/api/legal-documents/offer?lang=fr')
  check('A.fallback', 'неизвестный язык → русская версия', fr.json?.data?.lang === 'ru', fr.json?.data?.lang)
  for (const [slug, expected] of [['nope', 404], ['..%2Fglobal', 404], ['offer%27--', 404]]) {
    const r = await req('GET', `/api/legal-documents/${slug}`)
    check(`A.404.${slug}`, `несуществующий документ ${decodeURIComponent(slug)} → 404`, r.status === expected, r.status)
  }
  for (const [who, jwt] of [['anon', null], ['patient', patientJwt]]) {
    const edit = await req('GET', '/api/legal-documents/offer/edit', { jwt })
    const put = await req('PUT', '/api/legal-documents/offer', { jwt, body: { data: { body: { ru: 'взлом' } } } })
    check(`A.acl.${who}`, `${who}: редактор и сохранение закрыты (401/403)`, [401, 403].includes(edit.status) && [401, 403].includes(put.status), `${edit.status}/${put.status}`)
  }
  const post = await req('POST', '/api/legal-documents', { jwt: adminJwt, body: { data: { slug: 'fake', body: { ru: 'x' } } } })
  const del = await req('DELETE', '/api/legal-documents/offer', { jwt: adminJwt })
  check('A.noCrud', 'даже админ не может создать или удалить документ через API', [404, 405].includes(post.status) && [404, 405].includes(del.status), `${post.status}/${del.status}`)
  const edit = await req('GET', '/api/legal-documents/offer/edit', { jwt: adminJwt })
  check('A.edit.admin', 'админ получает все 4 языка для редактора', edit.status === 200 && Object.keys(edit.json?.data?.body || {}).sort().join() === 'en,kk,ru,zh', edit.status)

  const bad = [
    ['lang', { body: { fr: 'x' } }, 400],
    ['type', { body: { ru: 5 } }, 400],
    ['size', { body: { ru: 'x'.repeat(400_001) } }, 400],
    ['date', { revisionDate: '24.09.2026' }, 400],
    ['empty', {}, 400],
    ['allEmpty', { body: { ru: '', kk: '', en: '', zh: '' } }, 400],
  ]
  for (const [id, data, expected] of bad) {
    const r = await req('PUT', '/api/legal-documents/offer', { jwt: adminJwt, body: { data } })
    check(`A.validate.${id}`, `некорректная правка (${id}) → ${expected}`, r.status === expected, `${r.status} ${r.text.slice(0, 120)}`)
  }
  const afterBad = await req('GET', '/api/legal-documents/offer?lang=ru')
  check('A.validate.untouched', 'после отклонённых правок текст не изменился', afterBad.json?.data?.body === SEEDS.offer.body.ru, '')

  const stale = await req('PUT', '/api/legal-documents/offer', { jwt: adminJwt, body: { data: { expectedUpdatedAt: '2020-01-01T00:00:00.000Z', revisionDate: '2026-10-01' } } })
  check('A.conflict', 'правка поверх чужой (устаревший updatedAt) → 409', stale.status === 409, stale.status)

  const slugHack = await req('PUT', '/api/legal-documents/consent', { jwt: adminJwt, body: { data: { slug: 'hacked', id: 999, revisionDate: '2026-09-24' } } })
  const stillThere = await req('GET', '/api/legal-documents/consent')
  check('A.ignoreFields', 'slug/id в теле игнорируются — документ остаётся по своему адресу', slugHack.status === 200 && stillThere.status === 200 && stillThere.json.data.slug === 'consent', `${slugHack.status}/${stillThere.status}`)

  const partial = await req('PUT', '/api/legal-documents/consent', { jwt: adminJwt, body: { data: { title: { zh: '测试标题' } } } })
  const zh = await req('GET', '/api/legal-documents/consent?lang=zh')
  const ru = await req('GET', '/api/legal-documents/consent?lang=ru')
  check('A.partial', 'правка одного языка не трогает остальные', partial.status === 200 && zh.json.data.title === '测试标题' && ru.json.data.title === SEEDS.consent.title.ru && ru.json.data.body === SEEDS.consent.body.ru, '')
  await req('PUT', '/api/legal-documents/consent', { jwt: adminJwt, body: { data: { title: { zh: SEEDS.consent.title.zh } } } })
}

// =============================================================================
// B. Публичные страницы
// =============================================================================
const browser = await chromium.launch({ executablePath: process.env.CHROME })
const openPage = async (url, { lang = 'ru', width = 1366, storageState } = {}) => {
  const context = await browser.newContext({ viewport: { width, height: width < 500 ? 844 : 900 }, storageState })
  await context.addInitScript((l) => { try { localStorage.setItem('i18nextLng', l) } catch { /* empty */ } }, lang)
  const page = await context.newPage()
  page.errors = []
  page.on('pageerror', (e) => page.errors.push(e.message))
  page.on('dialog', (d) => { page.dialogText = d.message(); d.accept() })
  await page.goto(SITE + url, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  return page
}
// Клик по оглавлению прокручивает плавно — ждём, пока позиция перестанет меняться.
const settle = async (page) => {
  let last = -1
  for (let i = 0; i < 30; i += 1) {
    const y = await page.evaluate(() => window.scrollY)
    if (y === last) return
    last = y
    await page.waitForTimeout(150)
  }
}
const overflowOf = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)

// B1. Страница «Документы»
for (const lang of ['ru', 'en', 'kk']) {
  const page = await openPage('/documents', { lang })
  const hrefs = await page.locator('main a[href^="/documents/"], main a[href="/privacy"], main a[href="/terms"]').evaluateAll((as) => as.map((a) => a.getAttribute('href')))
  check(`B.hub.${lang}`, `/documents (${lang}): 4 карточки — оферта, согласие, политика, условия`,
    ['/documents/offer', '/documents/consent', '/privacy', '/terms'].every((h) => hrefs.includes(h)) && (await page.locator('main h1').innerText()) === tr[lang].legal_docs.hub_title, JSON.stringify(hrefs))
  await page.screenshot({ path: path.join(SHOTS, `hub-${lang}.png`), fullPage: true })
  await page.context().close()
}

// B2. Документ × язык интерфейса × ширина
for (const slug of ['offer', 'consent']) {
  for (const siteLang of ['ru', 'en', 'kk']) {
    for (const width of [390, 1366]) {
      const tag = `${slug}.${siteLang}.${width}`
      const page = await openPage(`/documents/${slug}`, { lang: siteLang, width })
      const seedToc = parseLegalMarkup(SEEDS[slug].body[siteLang]).toc
      const h1 = await page.locator('main h1').innerText()
      const articleLang = await page.locator('article [lang]').first().getAttribute('lang')
      const parts = await page.locator('article .legal-document > div[id]').count()
      const langButtons = await page.locator('main [role="group"] button').allInnerTexts()
      const revision = (await page.locator('main h1 + p').innerText()).includes('2026')
      check(`B.doc.${tag}`, `${tag}: заголовок, язык документа = языку сайта, все части, 4 языка, дата редакции`,
        h1 === SEEDS[slug].title[siteLang] && articleLang === siteLang && parts === seedToc.filter((t) => t.level === 1).length && langButtons.join() === 'Русский,Қазақша,English,中文' && revision,
        JSON.stringify({ h1, articleLang, parts, expected: seedToc.filter((t) => t.level === 1).length, langButtons, revision }))
      const overflow = await overflowOf(page)
      check(`B.overflow.${tag}`, `${tag}: нет горизонтального скролла (длинные «____» переносятся)`, overflow <= 0, `+${overflow}`)
      check(`B.errors.${tag}`, `${tag}: нет ошибок JS`, page.errors.length === 0, page.errors.join(' | '))
      if (siteLang === 'ru') await page.screenshot({ path: path.join(SHOTS, `${slug}-ru-${width}.png`) })
      await page.context().close()
    }
  }
}

// B3. Китайский — только переключателем на странице
{
  const page = await openPage('/documents/offer', { lang: 'en' })
  await page.locator('main [role="group"] button', { hasText: '中文' }).click()
  await page.waitForTimeout(800)
  const url = page.url()
  const articleLang = await page.locator('article [lang]').first().getAttribute('lang')
  const text = await page.locator('article').innerText()
  check('B.zh.switch', '中文: ?docLang=zh в адресе, текст на китайском, <… lang="zh">',
    url.includes('docLang=zh') && articleLang === 'zh' && text.includes('公开要约合同') && (await page.locator('main h1').innerText()) === SEEDS.offer.title.zh, `${url} ${articleLang}`)
  await page.screenshot({ path: path.join(SHOTS, 'offer-zh-1366.png') })
  await page.reload({ waitUntil: 'networkidle' })
  check('B.zh.reload', 'после перезагрузки выбранный язык документа сохраняется (из адреса)', (await page.locator('article [lang]').first().getAttribute('lang')) === 'zh', '')
  await page.context().close()
}

// B4. Якоря, оглавление, перекрёстные ссылки
{
  for (const [url, id] of [['/documents/consent#sample-inpatient', 'sample-inpatient'], ['/documents/offer#appendix-2', 'appendix-2'], ['/documents/consent?docLang=zh#personal-data', 'personal-data']]) {
    const page = await openPage(url, { width: 390 })
    await page.waitForTimeout(600)
    const top = await page.evaluate((i) => document.getElementById(i)?.getBoundingClientRect().top, id)
    check(`B.anchor.${id}`, `${url}: страница открывается на нужной части`, top !== undefined && top >= 60 && top <= 200, `top=${top}`)
    await page.context().close()
  }
  const page = await openPage('/documents/offer')
  const links = await page.locator('article a').evaluateAll((as) => as.map((a) => ({ href: a.getAttribute('href'), text: a.textContent, target: a.target })))
  check('B.links.offer', 'в оферте рабочие ссылки: прейскурант и согласие (ПД, ИС), без target=_blank для своих страниц',
    links.some((l) => l.href === '/prices') && links.some((l) => l.href === '/documents/consent#personal-data') && links.some((l) => l.href === '/documents/consent#informed-consent') && links.every((l) => !l.href.startsWith('/') || l.target === ''),
    JSON.stringify(links))
  await page.locator('article a[href="/documents/consent#informed-consent"]').first().click()
  await page.waitForURL(/\/documents\/consent/)
  await page.waitForTimeout(1000)
  const top = await page.evaluate(() => document.getElementById('informed-consent')?.getBoundingClientRect().top)
  check('B.links.crossDoc', 'клик «ссылка для ознакомления» в оферте → согласие, сразу на нужной части', top >= 60 && top <= 200, `top=${top}`)
  await page.locator('nav[aria-label] a[href="#sample-day-hospital"]').click()
  await settle(page)
  const top2 = await page.evaluate(() => document.getElementById('sample-day-hospital')?.getBoundingClientRect().top)
  const current = await page.locator('nav[aria-label] a[aria-current="location"]').getAttribute('href')
  check('B.toc', 'оглавление: переход к части и подсветка текущего пункта', top2 >= 60 && top2 <= 200 && current === '#sample-day-hospital', `top=${top2} current=${current}`)
  await page.context().close()

  const mobile = await openPage('/documents/offer', { width: 390 })
  const tocBtn = mobile.locator('nav[aria-label] button[aria-expanded]')
  await tocBtn.click()
  const opened = await mobile.locator('nav[aria-label] a[href="#appendix-1"]').isVisible()
  await mobile.locator('nav[aria-label] a[href="#appendix-1"]').click()
  await settle(mobile)
  const closed = !(await mobile.locator('nav[aria-label] a[href="#appendix-1"]').isVisible())
  const mtop = await mobile.evaluate(() => document.getElementById('appendix-1')?.getBoundingClientRect().top)
  check('B.toc.mobile', '390: «Содержание» раскрывается, после выбора пункта сворачивается и ведёт к части', opened && closed && mtop >= 60 && mtop <= 200, `opened=${opened} closed=${closed} top=${mtop}`)
  await mobile.screenshot({ path: path.join(SHOTS, 'offer-appendix1-390.png') })
  await mobile.context().close()
}

// B5. Не найден, печать, подвал, регистрация
{
  const page = await openPage('/documents/nope')
  check('B.notFound', '/documents/nope: «Документ не найден» и ссылка на все документы',
    (await page.getByText(tr.ru.legal_docs.not_found).count()) > 0 && (await page.locator('a[href="/documents"]').count()) > 0, '')
  await page.context().close()

  const print = await openPage('/documents/offer')
  await print.emulateMedia({ media: 'print' })
  const hidden = await print.evaluate(() => ({
    header: getComputedStyle(document.querySelector('header')).display,
    footer: getComputedStyle(document.querySelector('footer')).display,
    toc: getComputedStyle(document.querySelector('nav[aria-label]')).display,
    partVisible: getComputedStyle(document.getElementById('appendix-1')).display,
  }))
  check('B.print', 'печать: без шапки, подвала и оглавления; части документа на месте', hidden.header === 'none' && hidden.footer === 'none' && hidden.toc === 'none' && hidden.partVisible !== 'none', JSON.stringify(hidden))
  await print.pdf?.({ path: path.join(QA_DIR, 'offer-ru-print.pdf'), format: 'A4' }).catch(() => {})
  await print.context().close()

  const landing = await openPage('/')
  const footerLinks = await landing.locator('footer a').evaluateAll((as) => as.map((a) => a.getAttribute('href')))
  check('B.footer', 'подвал: ссылки «Правовые документы» и «Публичная оферта»', footerLinks.includes('/documents') && footerLinks.includes('/documents/offer'), JSON.stringify(footerLinks))
  await landing.context().close()

  for (const lang of ['ru', 'en', 'kk']) {
    // Галочка — на втором шаге: заполняем первый (данные никуда не отправляются).
    const reg = await openPage('/register', { lang })
    await reg.fill('input[name="fullName"]', 'QA Тест Пациент')
    await reg.fill('input[name="email"]', 'qa_reg@test.kz')
    await reg.locator('button', { hasText: tr[lang].common.country_select_placeholder }).click()
    await reg.locator('input[type="search"]').fill('KZ')
    await reg.locator('button:has(span:text-is("KZ"))').first().click()
    await reg.fill('input[name="phone"]', '7001234567')
    await reg.getByRole('button', { name: tr[lang].common.continue }).click()
    await reg.waitForTimeout(600)
    const label = reg.locator('label:has(input[type="checkbox"])')
    const hrefs = await label.locator('a').evaluateAll((as) => as.map((a) => ({ href: a.getAttribute('href'), target: a.target })))
    const text = (await label.innerText()).replace(/\s+/g, ' ')
    check(`B.register.${lang}`, `регистрация (${lang}): галочка ссылается на оферту, согласие и политику, открываются в новой вкладке`,
      hrefs.map((h) => h.href).join() === '/documents/offer,/documents/consent,/privacy' && hrefs.every((h) => h.target === '_blank') && !/[<>]/.test(text),
      JSON.stringify({ hrefs, text }))
    await label.screenshot({ path: path.join(SHOTS, `register-checkbox-${lang}.png`) })
    await reg.context().close()
  }
}

// =============================================================================
// C. Админка: Правовые документы
// =============================================================================
const adminContext = await browser.newContext({ viewport: { width: 1440, height: 900 } })
await adminContext.addInitScript(() => { try { localStorage.setItem('i18nextLng', 'ru') } catch { /* empty */ } })
const admin = await adminContext.newPage()
admin.errors = []
admin.on('pageerror', (e) => admin.errors.push(e.message))
admin.on('dialog', (d) => { admin.dialogText = d.message(); d.accept() })
await admin.goto(SITE + '/login', { waitUntil: 'networkidle' })
await admin.fill('input[name="identifier"]', process.env.ADMIN_EMAIL)
await admin.fill('input[name="password"]', PASSWORD)
await admin.click('button[type="submit"]')
await admin.waitForURL(/\/admin/, { timeout: 15000 })

await admin.getByRole('link', { name: 'Правовые документы' }).first().click()
await admin.waitForURL(/\/admin\/legal-documents/)
await admin.waitForTimeout(800)
const docTabs = await admin.getByRole('tab').allInnerTexts()
check('C.open', 'сайдбар → «Правовые документы»: вкладки двух документов и 4 языков',
  docTabs.some((t) => t.includes('Публичный договор-оферта')) && docTabs.some((t) => t.includes('Согласие на обработку')) && ['Русский', 'Қазақша', 'English', '中文'].every((l) => docTabs.some((t) => t.startsWith(l))), JSON.stringify(docTabs))
await admin.screenshot({ path: path.join(SHOTS, 'admin-editor-ru.png') })

const textarea = admin.locator('textarea')
const saveBtn = admin.getByRole('button', { name: 'Сохранить' })
const MARK = 'QA-правка: этот абзац добавлен из админки.'
check('C.saveDisabled', 'без изменений «Сохранить» неактивна', await saveBtn.isDisabled(), '')
await textarea.fill(SEEDS.offer.body.ru.replace('## 1. ТЕРМИНЫ И ОПРЕДЕЛЕНИЯ', `${MARK}\n## 1. ТЕРМИНЫ И ОПРЕДЕЛЕНИЯ`))
const previewHasMark = await admin.locator('.legal-document').getByText(MARK).count()
check('C.preview', 'предпросмотр рядом с редактором обновляется сразу', previewHasMark > 0, '')
check('C.dirty', 'появилась пометка «Есть несохранённые изменения»', await admin.getByText('Есть несохранённые изменения').count() > 0, '')
await admin.locator('input[type="date"]').fill('2026-10-20')
await saveBtn.click()
await admin.getByText('Документ сохранён').first().waitFor({ timeout: 10000 })
{
  const r = await req('GET', '/api/legal-documents/offer?lang=ru')
  check('C.save.api', 'сохранение: новый текст и дата редакции на сервере, остальные языки не тронуты',
    r.json.data.body.includes(MARK) && r.json.data.revisionDate === '2026-10-20' && (await req('GET', '/api/legal-documents/offer?lang=kk')).json.data.body === SEEDS.offer.body.kk, r.json.data.revisionDate)
  const page = await openPage('/documents/offer')
  check('C.save.site', 'сайт: правка и новая дата редакции видны сразу', (await page.locator('article').innerText()).includes(MARK) && (await page.getByText('20 октября 2026').count()) > 0, '')
  await page.context().close()
}

// C2. Отмена несохранённых правок
await textarea.fill('временный мусор')
await admin.getByRole('button', { name: 'Отменить изменения' }).click()
check('C.reset', '«Отменить изменения» возвращает сохранённый текст', (await textarea.inputValue()).includes(MARK) && await saveBtn.isDisabled(), '')

// C3. Казахский: удалён якорь — предупреждение
await admin.getByRole('tab', { name: /^Қазақша/ }).click()
await textarea.fill(SEEDS.offer.body.kk.replace(' {#appendix-1}', ''))
check('C.anchorWarning', 'kk без якоря {#appendix-1}: предупреждение о сломанных ссылках', await admin.getByText(/appendix-1/).count() > 0, '')
await admin.getByRole('button', { name: 'Отменить изменения' }).click()

// C4. Пустой китайский текст → пометка «нет текста», сайт отдаёт русский
await admin.getByRole('tab', { name: /^中文/ }).click()
await textarea.fill('')
check('C.emptyLang.marker', 'пустой язык помечен «(нет текста)» и есть пояснение', await admin.getByText('(нет текста)').count() > 0 && await admin.getByText(/русскую версию/).count() > 0, '')
await saveBtn.click()
await admin.getByText('Документ сохранён').first().waitFor({ timeout: 10000 })
{
  const r = await req('GET', '/api/legal-documents/offer?lang=zh')
  const list = await req('GET', '/api/legal-documents')
  check('C.emptyLang.site', 'без китайского текста: ?lang=zh → русский, в списке языков нет zh', r.json.data.lang === 'ru' && !list.json.data[0].languages.includes('zh'), JSON.stringify(list.json.data[0].languages))
}
await textarea.fill(SEEDS.offer.body.zh)
await saveBtn.click()
await admin.getByText('Документ сохранён').first().waitFor({ timeout: 10000 })

// C5. Две вкладки: правка поверх чужой
{
  const second = await adminContext.newPage()
  second.on('dialog', (d) => d.accept())
  await second.goto(SITE + '/admin/legal-documents', { waitUntil: 'networkidle' })
  await second.waitForTimeout(800)
  await second.locator('input[type="date"]').fill('2026-11-01')
  await second.getByRole('button', { name: 'Сохранить' }).click()
  await second.getByText('Документ сохранён').first().waitFor({ timeout: 10000 })
  await admin.getByRole('tab', { name: /^Русский/ }).click()
  await textarea.fill(`${await textarea.inputValue()}\nправка из первой вкладки`)
  await saveBtn.click()
  await admin.waitForTimeout(1500)
  const conflict = await admin.getByText('Документ успел изменить другой администратор').count()
  const r = await req('GET', '/api/legal-documents/offer?lang=ru')
  check('C.conflict', 'вторая вкладка сохранила раньше → первая получает понятное сообщение и не затирает чужую правку',
    conflict > 0 && r.json.data.revisionDate === '2026-11-01' && !r.json.data.body.includes('правка из первой вкладки'), `toast=${conflict} date=${r.json.data.revisionDate}`)
  await second.close()
  await admin.reload({ waitUntil: 'networkidle' })
  await admin.waitForTimeout(600)
}

// C6. XSS в тексте
{
  const r = await req('PUT', '/api/legal-documents/consent', { jwt: adminJwt, body: { data: { body: { en: `${SEEDS.consent.body.en}\n<img src=x onerror="window.__xss=1"><script>window.__xss=2</script>\n[click](javascript:window.__xss=3)\n[data](data:text/html,<b>x</b>)` } } } })
  const page = await openPage('/documents/consent?lang=en')
  const xss = await page.evaluate(() => window.__xss)
  const bad = await page.locator('article img[src="x"], article script, article a[href^="javascript:"], article a[href^="data:"]').count()
  const literal = (await page.locator('article').innerText()).includes('<img src=x')
  check('C.xss', 'HTML и javascript:/data:-ссылки в тексте выводятся как текст и не исполняются', r.status === 200 && !xss && bad === 0 && literal, `xss=${xss} bad=${bad} literal=${literal}`)
  await page.context().close()
  await req('PUT', '/api/legal-documents/consent', { jwt: adminJwt, body: { data: { body: { en: SEEDS.consent.body.en } } } })
}

// C7. Подсказка в «Контент сайта → Правовые документы»
await admin.goto(SITE + '/admin/settings', { waitUntil: 'networkidle' })
await admin.getByRole('button', { name: 'Правовые документы' }).click()
check('C.contentPointer', '«Контент сайта → Правовые документы»: ссылка на редактор оферты и согласий', await admin.locator('a[href="/admin/legal-documents"]').count() > 0, '')

// C8. Английский и казахский интерфейс редактора
for (const [lang, save, tab] of [['en', 'Save', 'English'], ['kk', 'Сақтау', 'Қазақша']]) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState: await adminContext.storageState() })
  await ctx.addInitScript((l) => { try { localStorage.setItem('i18nextLng', l) } catch { /* empty */ } }, lang)
  const p = await ctx.newPage()
  await p.goto(SITE + '/admin/legal-documents', { waitUntil: 'networkidle' })
  await p.waitForTimeout(600)
  check(`C.ui.${lang}`, `редактор на ${lang}: кнопки и вкладки переведены`, await p.getByRole('button', { name: save }).count() > 0 && await p.getByRole('tab', { name: new RegExp(`^${tab}`) }).count() > 0, '')
  await p.screenshot({ path: path.join(SHOTS, `admin-editor-${lang}.png`) })
  await ctx.close()
}
check('C.errors', 'админка: нет ошибок JS', admin.errors.length === 0, admin.errors.join(' | '))

await adminContext.close()
await browser.close()

const failed = results.filter((r) => !r.ok)
fs.writeFileSync(path.join(QA_DIR, process.env.OUT || 'ui-legal-results.json'), JSON.stringify(results, null, 1))
console.log(`\n${results.length - failed.length}/${results.length} passed`)
