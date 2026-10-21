// Набор H: пункт «Наши врачи» в шапке — ширины, языки, бургер, подсветка,
// управление из Admin > Контент сайта > Шапка и меню, старый сохранённый конфиг.
import { APP, OUT, USERS, api, createReport, jwtFor, launch, sleep, visible } from './lib.mjs'

const { check, save } = createReport(process.env.QA_SUITE_NAME || 'header')
const { browser, newPage, errors } = await launch()
const LABEL = { ru: 'Наши врачи', en: 'Our doctors', kk: 'Біздің дәрігерлер' }
const adminJwt = await jwtFor(USERS.admin)
const getConfig = async () => (await api('GET', '/api/global')).json?.data?.landingConfig ?? null
const putConfig = (landingConfig) => api('PUT', '/api/global', { jwt: adminJwt, body: { data: { landingConfig } } })
const originalConfig = await getConfig()

const headerLayout = (p) => p.evaluate(() => {
  const header = document.querySelector('header')
  const nav = header.querySelector('nav')
  const navVisible = nav && getComputedStyle(nav).display !== 'none'
  const links = navVisible ? [...nav.querySelectorAll('a')] : []
  return {
    navVisible,
    wraps: links.some((a) => a.getBoundingClientRect().height > 40),
    cut: [...header.querySelectorAll('a, button')].filter((el) => el.offsetParent).some((el) => el.getBoundingClientRect().right > innerWidth + 1),
    scroll: document.documentElement.scrollWidth,
  }
})
const burger = (p) => p.locator('header button').filter({ has: p.locator('svg.lucide-menu') }).first()

try {
  // H1 — широкие экраны: пункт в строке меню, всё помещается
  for (const lang of ['ru', 'en', 'kk']) for (const width of [1920, 1440, 1280]) for (const path of ['/', '/tourism', '/doctors']) {
    const p = await newPage({ viewport: { width, height: 800 }, lang })
    await p.goto(APP + path)
    const link = p.locator('header nav a', { hasText: LABEL[lang] })
    const shown = await visible(link, 15000)
    const layout = await headerLayout(p)
    check(`H1 ${lang} ${width}px ${path}: item shown, one line, nothing cut`, shown && layout.navVisible && !layout.wraps && !layout.cut && layout.scroll <= width, JSON.stringify(layout))
    if (width === 1280) await p.screenshot({ path: `${OUT}H1-${lang}-${width}${path.replace(/\//g, '_') || '_'}.png`, clip: { x: 0, y: 0, width, height: 90 } })
    await p.context().close()
  }

  // H2 — уже 1280: меню-бургер, пункт в нём, переход и закрытие меню
  for (const width of [1279, 1024, 768, 390]) {
    const p = await newPage({ viewport: { width, height: 844 } })
    await p.goto(APP + '/tourism')
    const layout = await headerLayout(p)
    check(`H2 ${width}px: desktop menu hidden, burger shown, no page overflow`, !layout.navVisible && await visible(burger(p), 10000) && layout.scroll <= width, JSON.stringify(layout))
    await burger(p).click()
    const item = p.getByRole('link', { name: LABEL.ru })
    check(`H2b ${width}px: burger menu contains «Наши врачи»`, await visible(item))
    await item.click()
    await p.waitForURL('**/doctors', { timeout: 8000 }).catch(() => {})
    await sleep(600)
    // Закрытая панель уезжает за левый край (translate-x), а не скрывается.
    const menuClosed = await p.evaluate((label) => [...document.querySelectorAll('a')]
      .filter((a) => a.textContent.trim() === label && !a.closest('header nav'))
      .every((a) => a.getBoundingClientRect().right <= 0), LABEL.ru)
    check(`H2c ${width}px: tap → /doctors, menu closes`, p.url().endsWith('/doctors') && menuClosed, `${p.url()} closed=${menuClosed}`)
    if (width === 390) await p.screenshot({ path: `${OUT}H2-390-doctors.png` })
    await p.context().close()
  }

  // H3 — подсветка текущего пункта
  {
    const p = await newPage()
    await p.goto(APP + '/doctors')
    const current = await p.locator('header nav a[aria-current="page"]').allTextContents()
    check('H3 on /doctors only «Наши врачи» is current', current.length === 1 && current[0].trim() === LABEL.ru, JSON.stringify(current))
    const doctorId = (await api('GET', '/api/doctors?pagination[limit]=1')).json?.data?.[0]?.documentId
    if (doctorId) {
      await p.goto(APP + '/doctors/' + doctorId)
      await sleep(1500)
      const onProfile = await p.locator('header nav a[aria-current="page"]').allTextContents()
      check('H3b on a doctor profile «Наши врачи» stays current', onProfile.length === 1 && onProfile[0].trim() === LABEL.ru, JSON.stringify(onProfile))
    } else {
      console.log('SKIP  H3b no doctors in this database')
    }
    await p.goto(APP + '/tourism'); await sleep(800)
    const onTourism = await p.locator('header nav a[aria-current="page"]').allTextContents()
    check('H3c on /tourism the current item is «Туризм»', onTourism.length === 1 && onTourism[0].trim() === 'Туризм', JSON.stringify(onTourism))
    await p.context().close()
  }

  // H4 — пациент в кабинете видит ту же шапку на публичных страницах
  {
    const p = await newPage({ as: 'patient' })
    await p.goto(APP + '/')
    check('H4 signed-in patient: item shown, «Личный кабинет» fits', await visible(p.locator('header nav a', { hasText: LABEL.ru }), 15000) && !(await headerLayout(p)).cut)
    await p.context().close()
  }

  // H9 — пункты-якоря с другой страницы открывают главную на нужном блоке
  for (const [label, id] of [['Контакты', 'contact'], ['Процесс', 'process'], ['Лечение', 'specializations']]) {
    const p = await newPage()
    await p.goto(APP + '/doctors'); await visible(p.locator('header nav a', { hasText: label }), 15000)
    await p.locator('header nav a', { hasText: label }).first().click()
    await p.waitForURL((u) => u.pathname === '/', { timeout: 8000 }).catch(() => {})
    await sleep(2000)
    const inView = await p.evaluate((sectionId) => { const el = document.getElementById(sectionId); if (!el) return 'missing'; const r = el.getBoundingClientRect(); return r.top < innerHeight * 0.6 && r.bottom > 0 }, id)
    check(`H9 «${label}» from /doctors → home page scrolled to #${id}`, inView === true, `${p.url()} ${inView}`)
    await p.context().close()
  }

  // H10 — тот же код прокрутки к якорю: правовые документы (QA 2026-10-16, L1) не сломаны
  for (const [path, id] of [['/documents/consent#sample-inpatient', 'sample-inpatient'], ['/documents/offer#appendix-2', 'appendix-2'], ['/documents/consent#personal-data', 'personal-data']]) {
    const p = await newPage()
    await p.goto(APP + path); await sleep(3500)
    const pos = await p.evaluate((sectionId) => document.getElementById(sectionId)?.getBoundingClientRect().top ?? null, id)
    check(`H10 ${path}: section at the top after load`, pos !== null && pos >= 0 && pos < 200, pos)
    await p.context().close()
  }
  {
    const p = await newPage()
    await p.goto(APP + '/'); await sleep(1500)
    await p.evaluate(() => window.scrollTo(0, 0))
    await p.locator('header nav a', { hasText: 'Контакты' }).first().click(); await sleep(2500)
    const top = await p.evaluate(() => document.getElementById('contact')?.getBoundingClientRect().top ?? null)
    check('H10b on the home page «Контакты» still scrolls in place', top !== null && top >= 0 && top < 200 && new URL(p.url()).pathname === '/', top)
    await p.context().close()
  }

  // H11 — посетитель сам крутит страницу во время довода к якорю: не мешаем
  {
    const p = await newPage()
    await p.goto(APP + '/doctors'); await visible(p.locator('header nav a', { hasText: 'Контакты' }), 15000)
    await p.locator('header nav a', { hasText: 'Контакты' }).first().click()
    await p.waitForURL((u) => u.pathname === '/', { timeout: 8000 }).catch(() => {})
    await sleep(700)
    await p.mouse.move(700, 400)
    await p.mouse.wheel(0, -2500); await sleep(300)
    await p.evaluate(() => window.scrollTo({ top: 1200, behavior: 'instant' }))
    await sleep(2500)
    const { y, contactTop } = await p.evaluate(() => ({ y: scrollY, contactTop: document.getElementById('contact').getBoundingClientRect().top }))
    // Небольшой сдвиг — штатная привязка прокрутки браузера, пока выше догружаются картинки.
    check('H11 user scroll during settling is respected (not pulled back to #contact)', Math.abs(y - 1200) < 150 && contactTop > 2000, `y=${y} contactTop=${contactTop}`)
    await p.context().close()
  }

  // H5 — старый сохранённый конфиг без пункта «doctors» (так на проде): пункт виден
  const legacy = JSON.parse(JSON.stringify(originalConfig || {}))
  legacy.navigation = { items: { blog: { visible: true, label: { ru: 'Блог / Статьи' } } } }
  const putLegacy = await putConfig(legacy)
  {
    const p = await newPage(); await p.goto(APP + '/')
    check('H5 config saved before this release (no «doctors» key) → item visible', putLegacy.status === 200 && await visible(p.locator('header nav a', { hasText: LABEL.ru }), 15000), putLegacy.status)
    await p.context().close()
  }

  // H6 — админ скрывает и переименовывает пункт в «Контент сайта»
  {
    const a = await newPage({ as: 'admin', viewport: { width: 1440, height: 1000 } })
    await a.goto(APP + '/admin/settings')
    await a.getByRole('button', { name: 'Шапка и меню' }).click()
    const row = a.locator('div.grid', { has: a.getByText('Наши врачи', { exact: true }) }).first()
    check('H6 admin «Шапка и меню» lists «Наши врачи»', await visible(row, 15000))
    await row.getByRole('checkbox').uncheck()
    await a.getByRole('button', { name: 'Сохранить' }).first().click()
    await sleep(2000)
    const p = await newPage(); await p.goto(APP + '/'); await sleep(2000)
    check('H6b hidden in admin → gone from the header', !(await p.locator('header nav a', { hasText: LABEL.ru }).count()) && await visible(p.locator('header nav a', { hasText: 'Туризм' })))
    await p.context().close()
    await row.getByRole('checkbox').check()
    await row.getByRole('textbox').first().fill('Врачи центра')
    await a.getByRole('button', { name: 'Сохранить' }).first().click()
    await sleep(2000)
    const q = await newPage(); await q.goto(APP + '/'); await sleep(2000)
    check('H6c renamed in admin → new label in the header (ru)', await visible(q.locator('header nav a', { hasText: 'Врачи центра' }), 10000))
    await q.context().close()
    const e = await newPage({ lang: 'en' }); await e.goto(APP + '/'); await sleep(2000)
    check('H6d en keeps the standard label (only ru renamed)', await visible(e.locator('header nav a', { hasText: LABEL.en }), 10000))
    await e.context().close()
    await a.context().close()
  }
} finally {
  const restored = await putConfig(originalConfig)
  check('H7 original landing config restored', restored.status === 200, restored.status)
}

check('H8 no page errors / 5xx', errors.length === 0, errors.join(' | '))
await browser.close()
process.exit(save() ? 0 : 1)
