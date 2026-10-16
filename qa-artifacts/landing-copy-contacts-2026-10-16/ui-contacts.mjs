// QA: тексты лендинга по комментариям менеджера + контакты call-центра и координатора.
// Стенд: копия локальной базы server/.tmp/qa-contacts.db, Strapi :1344, Vite :1342.
// Пользователь синтетический (QA admin), прод не затрагивается: с прода только
// прочитан публичный landingConfig (prod-landingConfig-v2.json).
//
//   PW=<path to playwright/index.mjs> CHROME=<chrome binary> ADMIN_EMAIL=… node ui-contacts.mjs
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const QA_DIR = path.dirname(new URL(import.meta.url).pathname)
const ROOT = path.resolve(QA_DIR, '../..')
const { chromium } = await import(process.env.PW || 'playwright')
const { landingCopy } = await import(path.join(ROOT, 'frontend/src/data/landingCopy.js'))
const SITE = 'http://localhost:1342', API = 'http://localhost:1344'
const DB = path.join(ROOT, 'server/.tmp/qa-contacts.db')
const ADMIN = { email: process.env.ADMIN_EMAIL, password: 'QaTest123!' }
const SHOTS = path.join(QA_DIR, 'screens')
const LANGS = ['ru', 'en', 'kk']
const WIDTHS = [390, 768, 1366]
const tr = Object.fromEntries(LANGS.map((l) => [l, JSON.parse(fs.readFileSync(path.join(ROOT, `frontend/src/i18n/locales/${l}/translation.json`), 'utf8'))]))

const results = []
const check = (id, name, ok, detail = '') => {
  results.push({ id, name, ok: !!ok, detail: String(detail).slice(0, 400) })
  console.log(`${ok ? 'PASS' : 'FAIL'}  [${id}] ${name}${ok ? '' : '  -> ' + String(detail).slice(0, 400)}`)
}

// --- Конфиг Global.landingConfig прямо в базе стенда -------------------------
const sql = (q) => execFileSync('sqlite3', [DB, q], { encoding: 'utf8' }).trim()
// Исходный конфиг — из нетронутой локальной базы: упавший прогон не должен влиять на следующий.
const originalConfig = execFileSync('sqlite3', ['-readonly', path.join(ROOT, 'server/.tmp/data.db'), 'select landing_config from globals where id=1'], { encoding: 'utf8' }).trim()
const setConfig = (config) => {
  const json = typeof config === 'string' ? config : JSON.stringify(config)
  sql(`update globals set landing_config='${json.replace(/'/g, "''")}' where id=1`)
}
const prodV2 = JSON.parse(fs.readFileSync(path.join(QA_DIR, 'prod-landingConfig-v2.json'), 'utf8'))
const apiConfig = async () => (await (await fetch(`${API}/api/global`)).json()).data.landingConfig

// Номера по комментарию менеджера.
const NUMBERS = {
  callCenter: { text: '+7 (7172) 57-20-09', tel: 'tel:+77172572009' },
  coordMobile: { text: '+7 (700) 085-31-44', tel: 'tel:+77000853144' },
  coordPhone: { text: '+7 (7172) 57-74-40', tel: 'tel:+77172577440' },
}
const WA = 'https://wa.me/77000853144', TG = 'https://t.me/+77000853144'

// Фразы, которые менеджер пометил как «нечитаемые», — их не должно остаться.
const OLD_PHRASES = {
  ru: ['один управляемый маршрут', 'Лечение в Казахстане. Мы организуем', 'в медицинский кейс', 'рекомендуемой длительности', 'остаются в едином маршруте', 'Начните с направления', 'координатор превращает', 'направит кейс', '123-456'],
  en: ['one managed journey', 'We organize everything else', 'to your medical case', 'recommended length of stay', 'remain connected in one journey', 'Start with a specialty', 'turns them into a clear action plan', '123-456'],
  kk: ['бір басқарылатын бағыт', 'медициналық кейске', 'ұсынылатын болу мерзімі', 'бір бағытта сақталады', 'Бағыттан немесе өз жағдайыңыздан', 'кейсті қажетті командаға', '123-456'],
}

const browser = await chromium.launch({ executablePath: process.env.CHROME })
const openPage = async (lang, width, url = '/') => {
  const context = await browser.newContext({ viewport: { width, height: width < 500 ? 844 : 900 } })
  await context.addInitScript((l) => { try { localStorage.setItem('i18nextLng', l) } catch { /* empty */ } }, lang)
  const page = await context.newPage()
  page.errors = []
  page.on('pageerror', (e) => page.errors.push(e.message))
  page.on('dialog', (d) => { page.dialog = d.message(); d.dismiss() })
  await page.goto(SITE + url, { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  return page
}
const norm = (s) => String(s).replace(/\s+/g, ' ').trim()
const text = async (page, selector) => norm(await page.locator(selector).first().innerText())

// =============================================================================
// A. Публичный сайт: конфиг как на проде (v2, телефоны пустые)
// =============================================================================
setConfig(prodV2)

for (const lang of LANGS) {
  const copy = landingCopy[lang]
  for (const width of WIDTHS) {
    const tag = `${lang}-${width}`
    const page = await openPage(lang, width)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    check(`A.overflow.${tag}`, `нет горизонтального скролла (${tag})`, overflow <= 0, `+${overflow}px`)

    const h1 = await page.locator('section h1').first().textContent()
    check(`A.hero.${tag}`, `заголовок первого экрана = landingCopy (${tag})`, h1 === copy.heroTitle, JSON.stringify(h1))
    const hero = await text(page, 'section')
    check(`A.heroText.${tag}`, `надзаголовок и текст первого экрана (${tag})`, hero.includes(norm(copy.heroEyebrow)) && hero.includes(norm(copy.heroText)), hero.slice(0, 300))

    const process = await text(page, '#process')
    const missingSteps = copy.steps.filter((s) => !process.includes(norm(s.text)) || !process.includes(norm(s.title))).map((s) => s.title)
    check(`A.process.${tag}`, `«Путь пациента»: заголовок, текст и 6 шагов (${tag})`,
      process.includes(norm(copy.processTitle)) && process.includes(norm(copy.processText)) && missingSteps.length === 0, `missing: ${missingSteps.join(', ')}`)

    const med = await text(page, '#specializations')
    check(`A.med.${tag}`, `«Лечение и диагностика»: заголовок и текст (${tag})`, med.includes(norm(copy.medTitle)) && med.includes(norm(copy.medText)), med.slice(0, 200))

    const contact = await text(page, '#contact')
    const footer = await text(page, 'footer')
    const allNumbers = Object.values(NUMBERS).map((n) => n.text)
    check(`A.contact.${tag}`, `блок «Контакты»: заголовок, 3 номера, адрес (${tag})`,
      contact.includes(norm(copy.ctaContactsTitle)) && allNumbers.every((n) => contact.includes(n)) && contact.includes(tr[lang].footer.address), contact.slice(-400))
    check(`A.footer.${tag}`, `подвал: подписи и 3 номера (${tag})`,
      [tr[lang].footer.call_center, tr[lang].footer.coordinator].every((l) => footer.toLowerCase().includes(l.toLowerCase())) && allNumbers.every((n) => footer.includes(n)), footer.slice(-500))

    const body = await page.locator('body').innerText()
    const leftovers = OLD_PHRASES[lang].filter((p) => body.includes(p))
    check(`A.old.${tag}`, `старые формулировки не остались (${tag})`, leftovers.length === 0, leftovers.join(' | '))
    check(`A.errors.${tag}`, `нет ошибок JS (${tag})`, page.errors.length === 0, page.errors.join(' | '))

    if (width !== 768) {
      await page.screenshot({ path: path.join(SHOTS, `${tag}-hero.png`) })
      for (const [id, sel] of [['journey', '#process'], ['start', '#specializations'], ['contact', '#contact'], ['footer', 'footer']]) {
        await page.locator(sel).scrollIntoViewIfNeeded()
        await page.waitForTimeout(700)
        await page.locator(sel).screenshot({ path: path.join(SHOTS, `${tag}-${id}.png`) })
      }
    }
    await page.context().close()
  }
}

// --- Ссылки, мессенджеры, навигация -----------------------------------------
{
  const page = await openPage('ru', 1366)
  for (const scope of ['#contact', 'footer']) {
    const hrefs = await page.locator(`${scope} a`).evaluateAll((as) => as.map((a) => ({ href: a.getAttribute('href'), text: a.textContent.trim(), target: a.target, rel: a.rel, label: a.getAttribute('aria-label') })))
    for (const [key, n] of Object.entries(NUMBERS)) {
      check(`A.tel.${scope}.${key}`, `${scope}: ${n.text} → ${n.tel}`, hrefs.some((h) => h.text === n.text && h.href === n.tel), JSON.stringify(hrefs.filter((h) => h.href?.startsWith('tel'))))
    }
    const wa = hrefs.find((h) => h.text === 'WhatsApp'), tg = hrefs.find((h) => h.text === 'Telegram')
    check(`A.wa.${scope}`, `${scope}: подпись WhatsApp у мобильного координатора → ${WA}, новая вкладка`, wa?.href === WA && wa.target === '_blank' && wa.rel.includes('noreferrer'), JSON.stringify(wa))
    check(`A.tg.${scope}`, `${scope}: подпись Telegram → ${TG}, новая вкладка`, tg?.href === TG && tg.target === '_blank' && tg.rel.includes('noreferrer'), JSON.stringify(tg))
    if (scope === 'footer') {
      const icons = hrefs.filter((h) => h.label === 'WhatsApp' || h.label === 'Telegram')
      check('A.footer.noDuplicateIcons', 'подвал: WhatsApp/Telegram не дублируются иконками, раз подписаны у номера', icons.length === 0, JSON.stringify(icons))
    }
  }
  // Пункт меню «Контакты» ведёт к телефонам.
  await page.locator('header').getByText('Контакты', { exact: true }).first().click()
  await page.waitForTimeout(1500)
  const box = await page.locator('#contact').getByText(NUMBERS.callCenter.text).boundingBox()
  check('A.nav.desktop', 'меню «Контакты» (1366): после перехода номер call-центра на экране', box && box.y >= 0 && box.y + box.height <= 900, JSON.stringify(box))
  await page.context().close()

  const mobile = await openPage('ru', 390)
  await mobile.locator('header button').last().click()
  await mobile.waitForTimeout(400)
  await mobile.locator('div.fixed.w-72').getByText('Контакты', { exact: true }).click()
  await mobile.waitForTimeout(1500)
  const mbox = await mobile.locator('#contact').getByText(NUMBERS.callCenter.text).boundingBox()
  const inView = mbox && mbox.y >= 0 && mbox.y <= 844
  check('A.nav.mobile', 'меню «Контакты» (390): переход к блоку контактов', await mobile.evaluate(() => location.hash === '#contact' || window.scrollY > 3000), `hash=${await mobile.evaluate(() => location.hash)} y=${await mobile.evaluate(() => scrollY)} callCenterBox=${JSON.stringify(mbox)} inView=${inView}`)
  await mobile.context().close()
}

// --- Юридические тексты ------------------------------------------------------
for (const lang of LANGS) {
  for (const url of ['/privacy', '/terms']) {
    const page = await openPage(lang, 1366, url)
    const body = await page.locator('main, body').first().innerText()
    check(`A.legal.${lang}${url}`, `${url} (${lang}): номер call-центра, без заглушки 123-456`, body.includes('57-20-09') && !body.includes('123-456'), body.match(/.{0,40}(57-20-09|123-456).{0,20}/)?.[0] || 'номера нет')
    await page.context().close()
  }
}

// --- Контраст новых элементов во всех палитрах --------------------------------
{
  const page = await openPage('ru', 1366)
  await page.locator('#contact').scrollIntoViewIfNeeded()
  const paletteIds = await page.evaluate(async () => (await import('/src/config/siteThemes.js')).SITE_THEME_PALETTES.map((p) => p.id))
  const contrastRows = []
  for (const paletteId of paletteIds) {
    const rows = await page.evaluate(async (id) => {
      const themes = await import('/src/config/siteThemes.js')
      themes.applySiteTheme({ paletteId: id }, { persist: false })
      await new Promise((r) => setTimeout(r, 50))
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      const rgba = (css) => { ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = '#000'; ctx.fillStyle = css; ctx.fillRect(0, 0, 1, 1); const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data; return [r, g, b, a / 255] }
      const bgOf = (el) => { for (let n = el; n; n = n.parentElement) { const c = rgba(getComputedStyle(n).backgroundColor); if (c[3] > 0.99) return c } return [255, 255, 255, 1] }
      const blend = (fg, bg) => fg.slice(0, 3).map((v, i) => v * fg[3] + bg[i] * (1 - fg[3]))
      const lum = (c) => { const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }); return 0.2126 * r + 0.7152 * g + 0.0722 * b }
      const ratio = (el) => { const bg = bgOf(el); const fg = blend(rgba(getComputedStyle(el).color), bg); const [a, b] = [lum(fg), lum(bg.slice(0, 3))].sort((x, y) => y - x); return +((a + 0.05) / (b + 0.05)).toFixed(2) }
      const pick = (scope) => {
        const root = document.querySelector(scope)
        const ul = [...root.querySelectorAll('ul')].find((u) => u.querySelector('svg.lucide-headset'))
        return {
          label: ul.querySelector('li p'),
          number: ul.querySelector('a[href^="tel:"]'),
          tag: [...ul.querySelectorAll('a')].find((a) => a.textContent === 'WhatsApp'),
        }
      }
      const out = []
      for (const scope of ['#contact', 'footer']) {
        for (const [role, el] of Object.entries(pick(scope))) out.push({ scope, role, ratio: ratio(el), size: getComputedStyle(el).fontSize })
      }
      return out
    }, paletteId)
    for (const row of rows) contrastRows.push({ paletteId, ...row })
  }
  fs.writeFileSync(path.join(QA_DIR, 'contrast.json'), JSON.stringify(contrastRows, null, 1))
  for (const row of contrastRows) {
    check(`A.contrast.${row.paletteId}.${row.scope}.${row.role}`, `контраст ${row.scope} ${row.role} (${row.paletteId}, ${row.size}) ≥ 4.5`, row.ratio >= 4.5, `${row.ratio}:1`)
  }
  await page.context().close()
}

// =============================================================================
// B. Миграция сохранённого конфига
// =============================================================================
const footerText = async (lang = 'ru') => { const p = await openPage(lang, 1366); const t = await text(p, 'footer'); const c = await text(p, '#contact'); await p.context().close(); return { footer: t, contact: c } }

setConfig(originalConfig)
{
  const { footer } = await footerText()
  check('B.legacy', 'старый конфиг без contacts/version (локальная база): номера по умолчанию', Object.values(NUMBERS).every((n) => footer.includes(n.text)), footer.slice(-300))
}
setConfig({ ...prodV2, contacts: { ...prodV2.contacts, phone: '+7 (7172) 99-88-77' } })
{
  const { footer } = await footerText()
  check('B.v2.filled', 'v2 с заполненным телефоном: показан номер админа, а не значение по умолчанию', footer.includes('+7 (7172) 99-88-77') && !footer.includes(NUMBERS.callCenter.text), footer.slice(-300))
}
setConfig({ ...prodV2, contacts: { ...prodV2.contacts, website: '' } })
{
  const { footer } = await footerText()
  check('B.v2.hiddenWebsite', 'v2 с пустым сайтом: сайт остаётся скрытым (у сайта и раньше было значение по умолчанию)', !footer.includes('nnmc.kz/') && !footer.includes('www.nnmc.kz'), footer.slice(-300))
}
setConfig({ ...prodV2, version: 3, contacts: { ...prodV2.contacts, coordinatorMobile: '', coordinatorPhone: '' } })
{
  const { footer, contact } = await footerText()
  check('B.v3.empty', 'v3 с пустыми телефонами: номера скрыты (решение админа)', !footer.includes(NUMBERS.callCenter.text) && !footer.includes('CALL'), footer.slice(-300))
  check('B.v3.emptyContactBlock', 'v3 без телефонов: в блоке «Контакты» нет «висящего» заголовка без номеров', !contact.includes(norm(landingCopy.ru.ctaContactsTitle)), contact.slice(-300))
}

// =============================================================================
// C. Админка: Контент сайта → Контакты
// =============================================================================
setConfig(prodV2)
const adminContext = await browser.newContext({ viewport: { width: 1366, height: 900 } })
await adminContext.addInitScript(() => { try { localStorage.setItem('i18nextLng', 'ru') } catch { /* empty */ } })
const admin = await adminContext.newPage()
admin.errors = []
admin.on('pageerror', (e) => admin.errors.push(e.message))
admin.on('dialog', (d) => d.accept())
await admin.goto(SITE + '/login', { waitUntil: 'networkidle' })
await admin.fill('input[name="identifier"]', ADMIN.email)
await admin.fill('input[name="password"]', ADMIN.password)
await admin.click('button[type="submit"]')
await admin.waitForURL(/\/admin/, { timeout: 15000 })

const openContacts = async () => {
  await admin.goto(SITE + '/admin/settings', { waitUntil: 'networkidle' })
  await admin.getByRole('button', { name: 'Контакты' }).click()
  await admin.waitForTimeout(300)
}
const field = (label) => admin.getByLabel(label, { exact: true })
const save = async () => {
  await admin.getByRole('button', { name: 'Сохранить' }).click()
  await admin.getByText('Контент сохранён').first().waitFor({ timeout: 10000 })
  await admin.waitForTimeout(300)
}

await openContacts()
const LABELS_RU = ['Call-центр', 'Координатор — мобильный', 'Координатор — городской', 'Email', 'Сайт', 'WhatsApp (номер)', 'Telegram (@username или ссылка)', 'Instagram (@username или ссылка)']
const present = []
for (const l of LABELS_RU) present.push(await field(l).count())
check('C.fields', 'админка: 8 полей контактов с подписями (ru)', present.every((c) => c === 1), JSON.stringify(Object.fromEntries(LABELS_RU.map((l, i) => [l, present[i]]))))
check('C.prefill', 'админка на конфиге с прода: поля заполнены номерами ННМЦ',
  await field('Call-центр').inputValue() === NUMBERS.callCenter.text && await field('Координатор — мобильный').inputValue() === NUMBERS.coordMobile.text && await field('Координатор — городской').inputValue() === NUMBERS.coordPhone.text,
  [await field('Call-центр').inputValue(), await field('Координатор — мобильный').inputValue(), await field('Координатор — городской').inputValue()].join(' / '))
await admin.screenshot({ path: path.join(SHOTS, 'admin-contacts-ru.png'), fullPage: true })

// C2. Изменить номер, очистить городской, Telegram — на @username.
await field('Call-центр').fill('+7 (7172) 11-22-33')
await field('Координатор — городской').fill('')
await field('Telegram (@username или ссылка)').fill('@nnmc_medtour')
await save()
{
  const cfg = await apiConfig()
  check('C.save.api', 'сохранение: version 3, новые значения в Global.landingConfig',
    cfg.version === 3 && cfg.contacts.phone === '+7 (7172) 11-22-33' && cfg.contacts.coordinatorPhone === '' && cfg.contacts.coordinatorMobile === NUMBERS.coordMobile.text && cfg.contacts.telegram === '@nnmc_medtour',
    JSON.stringify({ version: cfg.version, ...cfg.contacts }))
  const p = await openPage('ru', 1366)
  const f = await text(p, 'footer')
  const links = await p.locator('footer a').evaluateAll((as) => as.map((a) => ({ href: a.getAttribute('href'), text: a.textContent.trim(), label: a.getAttribute('aria-label') })))
  check('C.save.site', 'сайт: новый номер call-центра, городской координатора скрыт', f.includes('+7 (7172) 11-22-33') && !f.includes(NUMBERS.coordPhone.text), f.slice(-300))
  check('C.save.tgIcon', 'Telegram на другом аккаунте: подпись у номера пропала, иконка в ряду соцсетей ведёт на t.me/nnmc_medtour',
    !links.some((l) => l.text === 'Telegram') && links.some((l) => l.label === 'Telegram' && l.href === 'https://t.me/nnmc_medtour') && links.some((l) => l.text === 'WhatsApp'), JSON.stringify(links.filter((l) => /t\.me|wa\.me/.test(l.href || ''))))
  await p.context().close()
}
await openContacts()
check('C.persist', 'после перезагрузки админки значения сохранены, кнопка «Сохранить» неактивна',
  await field('Call-центр').inputValue() === '+7 (7172) 11-22-33' && await field('Координатор — городской').inputValue() === '' && await admin.getByRole('button', { name: 'Сохранить' }).isDisabled(), '')

// C3. Мусор вместо телефона.
await field('Call-центр').fill('звоните нам')
await admin.waitForTimeout(200)
const invalidShown = await admin.getByText('Это не ссылка — поле не покажется на сайте').count()
check('C.invalidPhone', 'админка: «звоните нам» в поле телефона помечается как ошибка', invalidShown > 0, `ошибок на странице: ${invalidShown}`)
await save()
{
  const p = await openPage('ru', 1366)
  const telLinks = await p.locator('footer a[href^="tel:"]').evaluateAll((as) => as.map((a) => a.getAttribute('href')))
  check('C.invalidPhone.site', 'сайт: телефон без цифр не превращается в пустую ссылку «tel:»', !telLinks.includes('tel:'), JSON.stringify(telLinks))
  await p.context().close()
}

// C4. XSS в номере и javascript: в мессенджере.
await openContacts()
await field('Координатор — мобильный').fill('<img src=x onerror="window.__xss=1"> 8 700 000 00 00')
await field('Telegram (@username или ссылка)').fill('javascript:alert(1)')
await save()
{
  const p = await openPage('ru', 1366)
  const xss = await p.evaluate(() => window.__xss)
  const imgs = await p.locator('footer img[src="x"], #contact img[src="x"]').count()
  const jsLinks = await p.locator('a[href^="javascript:"]').count()
  check('C.xss', 'HTML в номере выводится текстом, javascript: не становится ссылкой', !xss && imgs === 0 && jsLinks === 0 && !p.dialog, `xss=${xss} imgs=${imgs} jsLinks=${jsLinks} dialog=${p.dialog}`)
  await p.context().close()
}

// C5. Все телефоны пустые.
await openContacts()
for (const l of ['Call-центр', 'Координатор — мобильный', 'Координатор — городской']) await field(l).fill('')
await save()
{
  const p = await openPage('ru', 1366)
  const contact = await text(p, '#contact')
  const footer = await text(p, 'footer')
  check('C.noPhones.footer', 'все телефоны очищены: в подвале нет подписей «Call-центр»/«Координатор»', !/call-центр|координатор/i.test(footer), footer.slice(-300))
  check('C.noPhones.contact', 'все телефоны очищены: в блоке «Контакты» нет заголовка над пустым списком', !contact.includes(norm(landingCopy.ru.ctaContactsTitle)), contact.slice(-300))
  await p.locator('#contact').scrollIntoViewIfNeeded()
  await p.waitForTimeout(900)
  await p.locator('#contact').screenshot({ path: path.join(SHOTS, 'no-phones-contact.png') })
  await p.context().close()
}

// C6. Заголовок над контактами правится в «Главной странице».
await admin.goto(SITE + '/admin/settings', { waitUntil: 'networkidle' })
await admin.getByRole('button', { name: 'Главная страница' }).click()
await admin.getByLabel('Заголовок над контактами', { exact: true }).fill('Позвоните координатору')
// Заголовок виден только при номерах — возвращаем call-центр, очищенный в C5.
await admin.getByRole('button', { name: 'Контакты' }).click()
await field('Call-центр').fill(NUMBERS.callCenter.text)
await save()
{
  const p = await openPage('ru', 1366)
  check('C.ctaTitle', 'заголовок над контактами меняется из админки', (await text(p, '#contact')).includes('Позвоните координатору'), '')
  await p.context().close()
}
// Тексты по умолчанию в редакторе не превращаются в «изменённые» (неразрывные пробелы в заголовке).
{
  const cfg = await apiConfig()
  check('C.noFalseOverrides', 'сохранение редактора не записывает тексты по умолчанию как правки (heroTitle с nbsp)', Object.keys(cfg.landing?.ru || {}).join(',') === 'ctaContactsTitle', JSON.stringify(Object.keys(cfg.landing?.ru || {})))
}

// C7. Подписи полей на en и kk.
for (const [lang, section, labels] of [['en', 'Contacts', ['Call center', 'Coordinator — mobile', 'Coordinator — landline']], ['kk', 'Байланыс', ['Call-орталық', 'Үйлестіруші — ұялы', 'Үйлестіруші — қалалық']]]) {
  // Та же сессия админа, другой язык интерфейса — без повторного входа.
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, storageState: await adminContext.storageState() })
  await ctx.addInitScript((l) => { try { localStorage.setItem('i18nextLng', l) } catch { /* empty */ } }, lang)
  const page = await ctx.newPage()
  await page.goto(SITE + '/admin/settings', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: section, exact: true }).click({ timeout: 10000 })
  await page.waitForTimeout(300)
  const counts = []
  for (const l of labels) counts.push(await page.getByLabel(l, { exact: true }).count())
  check(`C.labels.${lang}`, `подписи полей телефонов (${lang})`, counts.every((c) => c === 1), JSON.stringify(Object.fromEntries(labels.map((l, i) => [l, counts[i]]))))
  await page.screenshot({ path: path.join(SHOTS, `admin-contacts-${lang}.png`) })
  await ctx.close()
}
check('C.errors', 'админка: нет ошибок JS', admin.errors.length === 0, admin.errors.join(' | '))

await adminContext.close()
await browser.close()
setConfig(originalConfig)

const failed = results.filter((r) => !r.ok)
fs.writeFileSync(path.join(QA_DIR, process.env.OUT || 'ui-contacts-results.json'), JSON.stringify(results, null, 1))
console.log(`\n${results.length - failed.length}/${results.length} passed`)
