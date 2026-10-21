// Набор T (первый проход): страница «Туризм» и Admin > Туризм — значения по
// умолчанию, галерея и подробное описание, первый экран, маршруты, валидация.
import { APP, API, OUT, PUB, USERS, api, createReport, jwtFor, launch, visible } from './lib.mjs'

const { check, save } = createReport(process.env.QA_SUITE_NAME || 'tourism')
const { browser, newPage, errors } = await launch()
const adminJwt = await jwtFor(USERS.admin)
const getGlobal = async () => (await (await fetch(API + '/api/global')).json()).data
const putGlobal = async (data) => fetch(API + '/api/global', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminJwt}` }, body: JSON.stringify({ data }) })
const run = async (name, fn) => { if (process.env.ONLY && !process.env.ONLY.includes(name)) return; try { await fn() } catch (e) { check(name + ' (crashed)', false, e.message) } }
const placeCard = (p, name) => p.locator('#regions button', { has: p.getByRole('heading', { name, exact: true }) })

// Clean slate: nothing saved in CMS for the tourism page
const g0 = await getGlobal()
const originalRegions = g0?.tourismRegions ?? null
await putGlobal({ tourismPage: { heroImage: null } })
if (Array.isArray(originalRegions)) {
  await putGlobal({ tourismRegions: originalRegions.map((r) => (r.id === 'pavlodar'
    ? { ...r, gallery: [], content: Object.fromEntries(Object.entries(r.content || {}).map(([k, v]) => [k, { ...v, details: '' }])) }
    : r)) })
}

// ── P. Public tourism page with defaults ───────────────────────────────
await run('P', async () => {
  const p = await newPage()
  await p.goto(APP + '/tourism')
  const hero = p.locator('section').first().locator('img').first()
  check('P1 default hero image', await visible(hero, 15000) && (await hero.getAttribute('src')) === '/kazakhstan-tourism-hero.png', await hero.getAttribute('src').catch(() => ''))
  check('P2 default tour routes shown', await visible(p.getByRole('heading', { name: 'Бурабай: лес, озёра и легенды' })) && await visible(p.getByRole('heading', { name: 'Баянаул: природная перезагрузка' })))
  const plan = p.locator('#regions').getByRole('button', { name: 'Подобрать маршрут' })
  check('P3 regions button is now «Подобрать маршрут»', await visible(plan) && !(await p.locator('#regions a[href="/register"]').count()))
  await plan.click(); await p.waitForTimeout(800)
  check('P4 guest: opens the manager chat, stays on /tourism', p.url().includes('/tourism') && await visible(p.getByPlaceholder(/Напишите сообщение/)), p.url())
  await p.reload()
  const astana = placeCard(p, 'Астана')
  await astana.scrollIntoViewIfNeeded()
  check('P5 card shows «Подробнее»', await visible(astana.getByText('Подробнее')))
  await astana.click()
  const dlg = p.getByRole('dialog')
  check('P6 card opens a dialog with the place', await visible(dlg) && await visible(dlg.getByRole('heading', { name: 'Астана' })) && await visible(dlg.getByText('Центр: Астана')))
  check('P6b one photo → no arrows/counter', !(await dlg.getByRole('button', { name: 'Следующее фото' }).count()))
  await p.screenshot({ path: OUT + 'P-modal-default.png' })
  await p.keyboard.press('Escape')
  check('P7 Escape closes it', !(await dlg.count()))
  await astana.focus(); await p.keyboard.press('Enter')
  check('P8 keyboard: Enter on a card opens it', await visible(p.getByRole('dialog')))
  await p.getByRole('dialog').getByRole('button', { name: 'Подобрать маршрут' }).click(); await p.waitForTimeout(600)
  check('P9 «Подобрать маршрут» in the dialog closes it and opens the chat', !(await p.getByRole('dialog').count()) && await visible(p.getByPlaceholder(/Напишите сообщение/)))
  await p.context().close()
  const e = await newPage({ lang: 'en' }); await e.goto(APP + '/tourism')
  check('P10 en: «Learn more» and «Plan a route»', await visible(e.getByText('Learn more'), 15000) && await visible(e.locator('#regions').getByRole('button', { name: 'Plan a route' })))
  await e.context().close()
})

// ── A. Admin: gallery + details for a place ────────────────────────────
await run('A', async () => {
  const p = await newPage({ viewport: { width: 1440, height: 1000 }, as: 'admin' })
  await p.goto(APP + '/admin/tourism')
  check('A1 two tabs: Места / Страница «Туризм»', await visible(p.getByRole('tab', { name: 'Места' }), 15000) && await visible(p.getByRole('tab', { name: 'Страница «Туризм»' })))
  await p.locator('aside button', { hasText: 'Павлодарская область' }).click()
  check('A2 gallery section with empty state', await visible(p.getByText('Пока только обложка')))
  await p.getByTestId('tourism-gallery-input').setInputFiles([PUB + 'astana.jpg', PUB + 'almaty.jpg', PUB + 'altai.jpg'])
  const thumbs = p.locator('section', { hasText: 'Галерея' }).locator('li')
  await thumbs.nth(2).waitFor({ timeout: 20000 })
  check('A3 three photos uploaded into the gallery', (await thumbs.count()) === 3, await thumbs.count())
  await p.getByTestId('tourism-gallery-input').setInputFiles({ name: 'note.txt', mimeType: 'text/plain', buffer: Buffer.from('x') })
  check('A4 non-image refused', await visible(p.getByText('Не удалось загрузить изображение')) && (await thumbs.count()) === 3)
  // move 3rd photo earlier, then remove the first
  await thumbs.nth(2).getByRole('button', { name: 'Раньше' }).click()
  await thumbs.nth(0).getByRole('button', { name: 'Убрать фото' }).click()
  check('A5 reorder + remove in the editor', (await thumbs.count()) === 2)
  const details = 'Баянаул — первый национальный парк Казахстана.\n\nОзеро Жасыбай окружено гранитными скалами.'
  await p.getByLabel(/Подробное описание/).fill(details)
  await p.getByRole('button', { name: 'Сохранить изменения' }).click()
  await p.waitForTimeout(2500)
  const pav = (await getGlobal()).tourismRegions?.find((r) => r.id === 'pavlodar')
  check('A6 saved: gallery (2, new order) and details', pav?.gallery?.length === 2 && /altai/.test(pav.gallery[0].name) && /almaty/.test(pav.gallery[1].name) && pav.content?.ru?.details === details, JSON.stringify(pav?.gallery?.map((m) => m.name)))
  await p.screenshot({ path: OUT + 'A-admin-gallery.png', fullPage: false })
  await p.context().close()

  const q = await newPage()
  await q.goto(APP + '/tourism')
  const card = placeCard(q, 'Павлодарская область')
  await card.scrollIntoViewIfNeeded()
  check('A7 card shows photo count 3', (await card.locator('span', { has: q.locator('svg.lucide-camera') }).textContent()).trim() === '3')
  await card.click()
  const dlg = q.getByRole('dialog')
  check('A8 dialog: counter 1 / 3 and 3 thumbnails', await visible(dlg.getByText('1 / 3')) && (await dlg.getByRole('button', { name: /Показать фото/ }).count()) === 3)
  await dlg.getByRole('button', { name: 'Следующее фото' }).click()
  check('A9 next arrow → 2 / 3', await visible(dlg.getByText('2 / 3')))
  await q.keyboard.press('ArrowRight')
  check('A10 → key → 3 / 3', await visible(dlg.getByText('3 / 3')))
  await q.keyboard.press('ArrowRight')
  check('A11 wraps around to 1 / 3', await visible(dlg.getByText('1 / 3')))
  await dlg.getByRole('button', { name: 'Показать фото 3' }).click()
  check('A12 thumbnail jumps to 3 / 3', await visible(dlg.getByText('3 / 3')))
  check('A13 details shown as two paragraphs', await visible(dlg.getByText('Баянаул — первый национальный парк Казахстана.')) && await visible(dlg.getByText('Озеро Жасыбай окружено гранитными скалами.')))
  const src = await dlg.locator('img').first().getAttribute('src')
  const status = (await q.request.get(src.startsWith('http') ? src : APP + src)).status()
  check('A14 uploaded photo is publicly reachable', status === 200, `${status} ${src}`)
  await q.screenshot({ path: OUT + 'A-modal-gallery.png' })
  await q.context().close()

  const m = await newPage({ viewport: { width: 390, height: 844 } })
  await m.goto(APP + '/tourism')
  const mc = placeCard(m, 'Павлодарская область'); await mc.scrollIntoViewIfNeeded(); await mc.click()
  const md = m.getByRole('dialog')
  const box = await md.boundingBox()
  check('A15 mobile: dialog fits the screen', box && box.x >= 0 && box.x + box.width <= 390, JSON.stringify(box))
  await m.screenshot({ path: OUT + 'A-modal-mobile.png' })
  await m.context().close()
})

// ── S. Admin: tourism page (hero + routes) ─────────────────────────────
await run('S', async () => {
  const p = await newPage({ viewport: { width: 1440, height: 1000 }, as: 'admin' })
  await p.goto(APP + '/admin/tourism')
  await p.getByRole('tab', { name: 'Страница «Туризм»' }).click()
  check('S1 page tab: default hero noted', await visible(p.getByText('Сейчас стандартная картинка сайта'), 10000))
  check('S1b default routes listed', await visible(p.locator('aside button', { hasText: 'Баянаул: природная перезагрузка' })))
  await p.getByTestId('tourism-hero-input').setInputFiles(PUB + 'charyn.jpg')
  await visible(p.getByRole('button', { name: 'Вернуть стандартную' }), 20000)
  check('S2 hero uploaded, preview switched', (await p.getByTestId('tourism-hero-preview').getAttribute('src')) !== '/kazakhstan-tourism-hero.png')
  await p.locator('aside button', { hasText: 'Баянаул: природная перезагрузка' }).click()
  await p.getByTestId('tourism-route-input').setInputFiles(PUB + 'altai.jpg')
  await p.waitForTimeout(2500)
  await p.getByLabel('Название').first().fill('Баянаул: озёра и скалы')
  await p.getByRole('button', { name: 'Сохранить изменения' }).click()
  await p.waitForTimeout(2500)
  const tp = (await getGlobal()).tourismPage
  const bay = tp?.tours?.find((t) => t.id === 'bayanaul-day')
  check('S3 saved: hero + route image + name', tp?.heroImage?.url && /altai/.test(bay?.image?.name || '') && bay?.content?.ru?.name === 'Баянаул: озёра и скалы', JSON.stringify({ hero: tp?.heroImage?.name, bay: bay?.image?.name, name: bay?.content?.ru?.name }))
  // add a third route and hide burabay
  p.once('dialog', (d) => d.accept('Каркаралы: горы и сосны'))
  await p.getByRole('button', { name: 'Добавить маршрут' }).click()
  await p.locator('aside button', { hasText: 'Бурабай' }).click()
  await p.getByRole('button', { name: 'Показывать на сайте' }).click()
  await p.getByRole('button', { name: 'Сохранить изменения' }).click()
  await p.waitForTimeout(2500)
  await p.context().close()

  const q = await newPage()
  await q.goto(APP + '/tourism')
  await q.waitForTimeout(1500)
  const heroSrc = await q.locator('section').first().locator('img').first().getAttribute('src')
  check('S4 public hero is the uploaded image', heroSrc && heroSrc !== '/kazakhstan-tourism-hero.png' && /charyn|uploads|file-proxy/.test(heroSrc), heroSrc)
  check('S5 routes: renamed one shown, hidden one gone, new one shown', await visible(q.getByRole('heading', { name: 'Баянаул: озёра и скалы' })) && !(await q.getByRole('heading', { name: 'Бурабай: лес, озёра и легенды' }).count()) && await visible(q.getByRole('heading', { name: 'Каркаралы: горы и сосны' })))
  await q.screenshot({ path: OUT + 'S-tourism-hero.png' })
  await q.context().close()

  // reset hero to default
  const r = await newPage({ viewport: { width: 1440, height: 1000 }, as: 'admin' })
  await r.goto(APP + '/admin/tourism')
  await r.getByRole('tab', { name: 'Страница «Туризм»' }).click()
  await r.getByRole('button', { name: 'Вернуть стандартную' }).click()
  await r.getByRole('button', { name: 'Сохранить изменения' }).click()
  await r.waitForTimeout(2000)
  check('S6 «Вернуть стандартную» saves heroImage = null', (await getGlobal()).tourismPage?.heroImage === null)
  await r.context().close()
})

// ── V. Server validation ───────────────────────────────────────────────
await run('V', async () => {
  const bad = async (data) => (await putGlobal(data)).status
  check('V1 hero from a foreign URL → 400', await bad({ tourismPage: { heroImage: { url: 'https://evil.example/x.jpg' } } }) === 400)
  check('V2 route without Russian name → 400', await bad({ tourismPage: { tours: [{ id: 'x', image: '/tourism/astana.jpg', isActive: true, sortOrder: 1, content: { ru: { name: '' } } }] } }) === 400)
  const regions = (await getGlobal()).tourismRegions
  const tooMany = regions.map((r) => (r.id === 'astana' ? { ...r, gallery: Array.from({ length: 21 }, () => '/tourism/astana.jpg') } : r))
  check('V3 gallery of 21 photos → 400', await bad({ tourismRegions: tooMany }) === 400)
  const foreign = regions.map((r) => (r.id === 'astana' ? { ...r, gallery: ['https://evil.example/x.jpg'] } : r))
  check('V4 gallery photo from a foreign URL → 400', await bad({ tourismRegions: foreign }) === 400)
  const longDetails = regions.map((r) => (r.id === 'astana' ? { ...r, content: { ...r.content, ru: { ...r.content.ru, details: 'x'.repeat(8001) } } } : r))
  check('V5 details over 8000 chars → 400', await bad({ tourismRegions: longDetails }) === 400)
  const pub = await fetch(API + '/api/global', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: { tourismPage: { heroImage: null } } }) })
  check('V6 anonymous PUT is refused', pub.status === 401 || pub.status === 403, pub.status)
})

check('T-END no page errors / 5xx', errors.length === 0, errors.join(' | '))
await browser.close()
process.exit(save() ? 0 : 1)
