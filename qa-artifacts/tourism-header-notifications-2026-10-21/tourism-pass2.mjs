// Набор T2 (второй проход): пограничные случаи туризма — старые данные, сбой
// API, XSS, лимиты, файлы в хранилище, гонки, права, сенсорный свайп, длинные тексты.
import { execFileSync } from 'child_process'
import { APP, OUT, USERS, api, createReport, jwtFor, launch, sleep, visible } from './lib.mjs'

const { check, save } = createReport(process.env.QA_SUITE_NAME || 'tourism-pass2')
const { browser, newPage, errors } = await launch()
// QA_DB=sqlite:<путь> | pg:<postgres://…>
const DB = process.env.QA_DB || `sqlite:${new URL('../../server/.tmp/qa-tnh.db', import.meta.url).pathname}`
const [dialect, ...dbRest] = DB.split(':')
const dbTarget = dbRest.join(':')
const fileExists = (id) => {
  const query = `select count(*) from files where id=${Number(id)}`
  const out = dialect === 'pg'
    ? execFileSync('/opt/homebrew/opt/postgresql@16/bin/psql', [dbTarget, '-tAc', query])
    : execFileSync('sqlite3', [dbTarget, query])
  return out.toString().trim() === '1'
}
const adminJwt = await jwtFor(USERS.admin)
const getGlobal = async () => (await api('GET', '/api/global')).json?.data
const putGlobal = (data, jwt = adminJwt) => api('PUT', '/api/global', { jwt, body: { data } })
const run = async (name, fn) => { if (process.env.ONLY && !process.env.ONLY.split(',').includes(name)) return; try { await fn() } catch (e) { check(`${name} (crashed)`, false, e.message) } }
const png = (n) => {
  // 2×2 PNG разного цвета — разные файлы, а не один и тот же
  const base = 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg=='
  const buffer = Buffer.from(base, 'base64')
  return { name: `qa-photo-${n}.png`, mimeType: 'image/png', buffer: Buffer.concat([buffer, Buffer.from(`qa-${n}-${Date.now()}`)]) }
}
const placeCard = (p, name) => p.locator('#regions button', { has: p.getByRole('heading', { name, exact: true }) })
const openAdmin = async (opts = {}) => {
  const p = await newPage({ viewport: { width: 1440, height: 1000 }, as: 'admin', ...opts })
  await p.goto(APP + '/admin/tourism')
  await visible(p.getByRole('tab', { name: 'Места' }), 15000)
  return p
}
const trackUploads = (p) => {
  const ids = []
  p.on('response', async (r) => {
    if (r.request().method() === 'POST' && r.url().includes('/api/upload')) {
      try { for (const file of await r.json()) ids.push(file.id) } catch { /* ignore */ }
    }
  })
  return ids
}

const g0 = await getGlobal()
const original = { tourismRegions: g0?.tourismRegions ?? null, tourismPage: g0?.tourismPage ?? { heroImage: null } }
const baseRegions = (await (async () => {
  // Встроенный список, как его сохранила бы админка до этого релиза: без gallery и details.
  if (Array.isArray(original.tourismRegions)) return original.tourismRegions
  const p = await openAdmin()
  await p.locator('aside button', { hasText: 'Астана' }).click()
  await p.getByLabel(/Краткое описание/).fill((await p.getByLabel(/Краткое описание/).inputValue()) + ' ')
  await p.getByRole('button', { name: 'Сохранить изменения' }).click(); await sleep(2000)
  await p.context().close()
  return (await getGlobal()).tourismRegions
})())
const legacyRegions = baseRegions.map(({ gallery, ...rest }) => ({
  ...rest,
  content: Object.fromEntries(Object.entries(rest.content || {}).map(([k, { details, ...v }]) => [k, v])),
}))

try {
  // X1 — данные, сохранённые до релиза (нет gallery/details)
  await run('X1', async () => {
    const put = await putGlobal({ tourismRegions: legacyRegions, tourismPage: { heroImage: null } })
    check('X1 legacy regions (no gallery/details) accepted by the server', put.status === 200, put.text.slice(0, 200))
    const p = await newPage(); await p.goto(APP + '/tourism')
    const card = placeCard(p, 'Алматы'); await card.scrollIntoViewIfNeeded(); await card.click()
    const dlg = p.getByRole('dialog')
    check('X1b public: legacy card opens, no empty «О месте» block', await visible(dlg.getByRole('heading', { name: 'Алматы' })) && !(await dlg.getByText('О месте').count()))
    await p.context().close()
    const a = await openAdmin()
    await a.locator('aside button', { hasText: 'Алматы' }).click()
    check('X1c admin: legacy place opens with empty gallery, nothing «unsaved»', await visible(a.getByText('Пока только обложка')) && !(await a.getByText('Есть несохранённые изменения').count()))
    await a.context().close()
  })

  // X2 — Global недоступен: страница на встроенных данных
  await run('X2', async () => {
    const p = await newPage()
    await p.route('**/api/global**', (route) => route.abort())
    await p.goto(APP + '/tourism'); await sleep(2500)
    const hero = await p.locator('section').first().locator('img').first().getAttribute('src').catch(() => null)
    check('X2 API down: default hero, built-in routes and regions, no crash', hero === '/kazakhstan-tourism-hero.png'
      && await visible(p.getByRole('heading', { name: 'Бурабай: лес, озёра и легенды' })) && (await p.locator('#regions button[aria-haspopup="dialog"]').count()) >= 15, hero)
    await p.context().close()
  })

  // X3 — XSS в текстах места и маршрута
  await run('X3', async () => {
    const evil = legacyRegions.map((r) => (r.id === 'astana' ? { ...r, content: { ...r.content, ru: { ...r.content.ru, name: '<img src=x onerror="window.__xss=1">Астана', details: '<script>window.__xss=2</script>Текст' } } } : r))
    const put = await putGlobal({ tourismRegions: evil, tourismPage: { heroImage: null, tours: [{ id: 'xss', image: '/tourism/burabay.jpg', isActive: true, sortOrder: 1, content: { ru: { name: '<b onmouseover="window.__xss=3">Маршрут</b>', label: '', text: '<iframe src="javascript:alert(1)"></iframe>', highlights: ['<svg onload="window.__xss=4">'] } } }] } })
    const p = await newPage(); await p.goto(APP + '/tourism'); await sleep(1500)
    const card = p.locator('#regions button', { hasText: 'Астана' }).first(); await card.scrollIntoViewIfNeeded(); await card.click(); await sleep(500)
    const xss = await p.evaluate(() => window.__xss)
    const injected = await p.evaluate(() => document.querySelectorAll('#regions img[src="x"], [role=dialog] script, iframe[src^="javascript"]').length)
    check('X3 markup in texts is shown as text, nothing executes', put.status === 200 && xss === undefined && injected === 0 && await visible(p.getByText('<script>window.__xss=2</script>Текст')), `xss=${xss} injected=${injected}`)
    await p.context().close()
    await putGlobal({ tourismRegions: legacyRegions, tourismPage: { heroImage: null } })
  })

  // X4 — лимит галереи 20 фото; модалка с 21 фото
  await run('X4', async () => {
    const a = await openAdmin()
    let uploadRequests = 0
    a.on('request', (r) => { if (r.method() === 'POST' && r.url().includes('/api/upload')) uploadRequests += 1 })
    await a.locator('aside button', { hasText: 'Шымкент' }).click()
    await a.getByTestId('tourism-gallery-input').setInputFiles(Array.from({ length: 22 }, (_, n) => png(n + 1)))
    const toastShown = await visible(a.getByText('В галерее не больше 20 фото'))
    const thumbs = a.locator('section', { hasText: 'Галерея' }).locator('li')
    await thumbs.nth(19).waitFor({ timeout: 60000 }); await sleep(1500)
    const count = await thumbs.count()
    const disabled = await a.getByTestId('tourism-gallery-input').isDisabled()
    check('X4 22 files → warning, exactly 20 kept, upload disabled at the limit', toastShown && count === 20 && disabled, `toast=${toastShown} count=${count} disabled=${disabled}`)
    check('X4a 20 photos go in one upload request (server limit: 60 requests / 15 min)', uploadRequests === 1, uploadRequests)
    await a.getByRole('button', { name: 'Сохранить изменения' }).click(); await sleep(2500)
    check('X4b saved with 20 photos', (await getGlobal()).tourismRegions.find((r) => r.id === 'shymkent')?.gallery?.length === 20)
    await a.context().close()
    const p = await newPage(); await p.goto(APP + '/tourism')
    const card = placeCard(p, 'Шымкент'); await card.scrollIntoViewIfNeeded(); await card.click()
    const dlg = p.getByRole('dialog')
    const strip = dlg.locator('div.overflow-x-auto').first()
    const scrollable = await strip.evaluate((el) => el.scrollWidth > el.clientWidth)
    await dlg.getByRole('button', { name: 'Показать фото 21' }).click()
    check('X4c dialog: 1 / 21, thumbnail strip scrolls, last thumbnail → 21 / 21', scrollable && await visible(dlg.getByText('21 / 21')), `scrollable=${scrollable}`)
    await p.context().close()
  })

  // X5 — «Отменить изменения» удаляет только что загруженные файлы
  await run('X5', async () => {
    const a = await openAdmin(); const ids = trackUploads(a)
    await a.locator('aside button', { hasText: 'Алматы' }).click()
    await a.getByTestId('tourism-gallery-input').setInputFiles([png(101), png(102)])
    await a.locator('section', { hasText: 'Галерея' }).locator('li').nth(1).waitFor({ timeout: 20000 })
    const existedBefore = ids.length === 2 && ids.every(fileExists)
    await a.getByRole('button', { name: 'Отменить изменения' }).click(); await sleep(2500)
    check('X5 discard → uploaded files removed from storage, gallery empty again', existedBefore && ids.every((id) => !fileExists(id)) && await visible(a.getByText('Пока только обложка')), `ids=${ids} existed=${existedBefore}`)
    await a.context().close()
  })

  // X6 — после сохранения убранные из галереи фото удаляются, оставшиеся живы
  await run('X6', async () => {
    const a = await openAdmin(); const ids = trackUploads(a)
    await a.locator('aside button', { hasText: 'Алматы' }).click()
    await a.getByTestId('tourism-gallery-input').setInputFiles([png(201), png(202), png(203)])
    const thumbs = a.locator('section', { hasText: 'Галерея' }).locator('li')
    await thumbs.nth(2).waitFor({ timeout: 20000 })
    await a.getByRole('button', { name: 'Сохранить изменения' }).click(); await sleep(2500)
    await thumbs.nth(1).getByRole('button', { name: 'Убрать фото' }).click()
    await a.getByRole('button', { name: 'Сохранить изменения' }).click(); await sleep(2500)
    const saved = (await getGlobal()).tourismRegions.find((r) => r.id === 'almaty-city')?.gallery?.map((m) => m.id)
    check('X6 removed photo deleted from storage, the other two kept and saved', ids.length === 3 && !fileExists(ids[1]) && fileExists(ids[0]) && fileExists(ids[2]) && JSON.stringify(saved) === JSON.stringify([ids[0], ids[2]]), `ids=${ids} saved=${saved}`)
    await a.context().close()
  })

  // X7 — переключились на другое место, пока фото грузились
  await run('X7', async () => {
    const a = await openAdmin()
    await a.route('**/api/upload**', async (route) => { await sleep(1500); await route.continue() })
    await a.locator('aside button', { hasText: 'Атырауская область' }).click()
    await a.getByTestId('tourism-gallery-input').setInputFiles([png(301), png(302)])
    await sleep(300)
    await a.locator('aside button', { hasText: 'Жамбылская область' }).click()
    await sleep(5000)
    check('X7b the place switched to gets nothing', await visible(a.getByText('Пока только обложка')))
    await a.locator('aside button', { hasText: 'Атырауская область' }).click()
    check('X7 photos land in the place they were uploaded for', (await a.locator('section', { hasText: 'Галерея' }).locator('li').count()) === 2)
    await a.getByRole('button', { name: 'Отменить изменения' }).click(); await sleep(1500)
    await a.context().close()
  })

  // X8/X9 — несохранённое при смене вкладок и уходе со страницы
  await run('X8', async () => {
    const a = await openAdmin()
    await a.locator('aside button', { hasText: 'Алматы' }).click()
    await a.getByLabel(/Подробное описание/).fill('Черновик, не сохранён')
    await a.getByRole('tab', { name: 'Страница «Туризм»' }).click()
    await visible(a.getByText('Картинка первого экрана'))
    await a.getByRole('tab', { name: 'Места' }).click()
    check('X8 switching tabs keeps unsaved text and the «unsaved» note', (await a.getByLabel(/Подробное описание/).inputValue()) === 'Черновик, не сохранён' && await visible(a.getByText('Есть несохранённые изменения')))
    let prompted = false
    a.on('dialog', async (d) => { if (d.type() === 'beforeunload') prompted = true; await d.dismiss().catch(() => {}) })
    await a.close({ runBeforeUnload: true }); await sleep(1000)
    check('X9 leaving with unsaved changes asks for confirmation', prompted)
    await a.context().close().catch(() => {})
  })

  // X10 — вкладки сохраняют каждая своё поле и не затирают другое
  await run('X10', async () => {
    const a = await openAdmin()
    await a.getByRole('tab', { name: 'Страница «Туризм»' }).click()
    await a.getByTestId('tourism-hero-input').setInputFiles(png(401))
    await visible(a.getByRole('button', { name: 'Вернуть стандартную' }), 20000)
    await a.getByRole('button', { name: 'Сохранить изменения' }).click(); await sleep(2500)
    await a.getByRole('tab', { name: 'Места' }).click()
    await a.locator('aside button', { hasText: 'Алматы' }).click()
    await a.getByLabel(/Подробное описание/).fill('Подробно об Алматы')
    await a.getByRole('button', { name: 'Сохранить изменения' }).click(); await sleep(2500)
    const g = await getGlobal()
    check('X10 page save + places save → both kept', Boolean(g.tourismPage?.heroImage?.url) && g.tourismRegions.find((r) => r.id === 'almaty-city')?.content?.ru?.details === 'Подробно об Алматы', JSON.stringify({ hero: g.tourismPage?.heroImage?.name }))
    await a.context().close()
  })

  // X11 — права
  await run('X11', async () => {
    for (const role of ['manager', 'coordinator', 'doctor', 'patient']) {
      const res = await putGlobal({ tourismPage: { heroImage: null } }, await jwtFor(USERS[role]))
      check(`X11 ${role}: cannot change the tourism page (403)`, res.status === 403, res.status)
    }
    const m = await newPage({ as: 'manager' })
    await m.goto(APP + '/admin/tourism'); await sleep(2500)
    check('X11b manager opening /admin/tourism does not get the editor', !m.url().includes('/admin/tourism') || !(await m.getByRole('tab', { name: 'Места' }).count()), m.url())
    await m.context().close()
  })

  // X12 — скрытое место и фильтр по виду туризма
  await run('X12', async () => {
    const hidden = (await getGlobal()).tourismRegions.map((r) => (r.id === 'kostanay' ? { ...r, isActive: false } : r))
    await putGlobal({ tourismRegions: hidden })
    const p = await newPage(); await p.goto(APP + '/tourism'); await sleep(1500)
    check('X12 hidden place is not on the page', !(await placeCard(p, 'Костанайская область').count()))
    await p.locator('#regions div.overflow-x-auto button', { hasText: 'Горы' }).click()
    const shown = await p.locator('#regions button[aria-haspopup="dialog"]').count()
    await p.locator('#regions button[aria-haspopup="dialog"]').first().click()
    check('X12b type filter works and a filtered card opens', shown > 0 && shown < 15 && await visible(p.getByRole('dialog')), shown)
    await p.context().close()
    await putGlobal({ tourismRegions: hidden.map((r) => ({ ...r, isActive: true })) })
  })

  // X13/X14 — модалка: фон, закрытие, клавиши, сенсорный свайп
  await run('X13', async () => {
    const p = await newPage({ viewport: { width: 390, height: 844 }, hasTouch: true })
    await p.goto(APP + '/tourism')
    const card = placeCard(p, 'Шымкент'); await card.scrollIntoViewIfNeeded(); await card.click()
    const dlg = p.getByRole('dialog')
    check('X13 background scroll locked while open', await p.evaluate(() => document.body.style.overflow) === 'hidden')
    const swipe = (dx) => dlg.locator('.aspect-\\[16\\/10\\]').evaluate((el, delta) => {
      const make = (type, x) => new TouchEvent(type, { bubbles: true, cancelable: true, touches: type === 'touchend' ? [] : [new Touch({ identifier: 1, target: el, clientX: x, clientY: 200 })], changedTouches: [new Touch({ identifier: 1, target: el, clientX: x, clientY: 200 })] })
      el.dispatchEvent(make('touchstart', 200)); el.dispatchEvent(make('touchend', 200 + delta))
    }, dx)
    await swipe(-120)
    const afterLeft = await visible(dlg.getByText('2 / 21'), 2000)
    await swipe(120)
    const afterRight = await visible(dlg.getByText('1 / 21'), 2000)
    await swipe(-20)
    const tiny = await visible(dlg.getByText('1 / 21'), 1000)
    check('X14 touch: swipe left → next, right → previous, a small move does nothing', afterLeft && afterRight && tiny, `${afterLeft} ${afterRight} ${tiny}`)
    await p.mouse.click(5, 5)
    await sleep(400)
    check('X13b tap outside closes, page scroll unlocked', !(await dlg.count()) && await p.evaluate(() => document.body.style.overflow) === '')
    await p.keyboard.press('ArrowRight')
    check('X13c arrow keys after closing do nothing (no dialog, no errors)', !(await p.getByRole('dialog').count()))
    await p.screenshot({ path: OUT + 'X13-after-close.png' })
    await p.context().close()
  })

  // X15 — маршруты: порядок, все скрыты, все удалены
  await run('X15', async () => {
    const tours = (await getGlobal()).tourismPage?.tours
    const defaults = [
      { id: 'a-route', image: '/tourism/burabay.jpg', isActive: true, sortOrder: 2, content: { ru: { name: 'Маршрут А', label: '', text: 'Текст А', highlights: [] } } },
      { id: 'b-route', image: '/tourism/charyn.jpg', isActive: true, sortOrder: 1, content: { ru: { name: 'Маршрут Б', label: 'Подпись Б', text: '', highlights: ['Пункт'] } } },
    ]
    await putGlobal({ tourismPage: { heroImage: null, tours: defaults } })
    const p = await newPage(); await p.goto(APP + '/tourism'); await sleep(1500)
    const order = await p.locator('section h3').allTextContents()
    check('X15 routes follow sortOrder (Б before А)', order.indexOf('Маршрут Б') > -1 && order.indexOf('Маршрут Б') < order.indexOf('Маршрут А'), JSON.stringify(order.slice(0, 4)))
    const aCard = p.locator('article', { hasText: 'Маршрут А' })
    check('X18 empty label/highlights → no empty elements in the card', (await aCard.locator('.uppercase').count()) === 0 && (await aCard.locator('.rounded-full').count()) === 0)
    await putGlobal({ tourismPage: { heroImage: null, tours: defaults.map((t) => ({ ...t, isActive: false })) } })
    await p.reload(); await sleep(1500)
    check('X15b all routes hidden → the block is gone', !(await p.getByText('Маршруты из турпакета').count()))
    await putGlobal({ tourismPage: { heroImage: null, tours: [] } })
    await p.reload(); await sleep(1500)
    const goneOnSite = !(await p.getByText('Маршруты из турпакета').count())
    await p.context().close()
    const a = await openAdmin()
    await a.getByRole('tab', { name: 'Страница «Туризм»' }).click()
    check('X15c all routes deleted → block gone, admin shows the empty state (not the defaults again)', goneOnSite && await visible(a.getByText('Маршрутов нет — блок на странице скрыт.')))
    await a.context().close()
    await putGlobal({ tourismPage: { heroImage: null, tours: tours ?? undefined } })
  })

  // X16 — «Подобрать маршрут» для пациента и сотрудника
  await run('X16', async () => {
    const pt = await newPage({ as: 'patient' })
    await pt.goto(APP + '/tourism')
    await pt.locator('#regions').getByRole('button', { name: 'Подобрать маршрут' }).click(); await sleep(800)
    check('X16 patient: opens the manager chat on the page', pt.url().includes('/tourism') && await visible(pt.getByPlaceholder(/Напишите сообщение/)), pt.url())
    await pt.context().close()
    const mg = await newPage({ as: 'manager' })
    await mg.goto(APP + '/tourism')
    await mg.locator('#regions').getByRole('button', { name: 'Подобрать маршрут' }).click()
    await mg.waitForURL((u) => u.pathname === '/', { timeout: 8000 }).catch(() => {})
    await sleep(1500)
    const inView = await mg.evaluate(() => { const el = document.getElementById('contact'); if (!el) return false; const r = el.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0 })
    check('X16b manager (no chat widget): goes to the contacts on the home page', new URL(mg.url()).pathname === '/' && inView, `${mg.url()} inView=${inView}`)
    await mg.context().close()
  })

  // X17 — перевод не заполнен: показывается русский текст
  await run('X17', async () => {
    const regions = (await getGlobal()).tourismRegions
    await putGlobal({ tourismRegions: regions.map((r) => (r.id === 'almaty-city' ? { ...r, content: { ...r.content, en: { ...r.content.en, details: '' } } } : r)) })
    const p = await newPage({ lang: 'en' }); await p.goto(APP + '/tourism')
    const card = placeCard(p, 'Almaty'); await card.scrollIntoViewIfNeeded(); await card.click()
    check('X17 en without a translated full description → the Russian one is shown, labels in English', await visible(p.getByRole('dialog').getByText('Подробно об Алматы')) && await visible(p.getByRole('dialog').getByText('About the place')) && await visible(p.getByRole('dialog').getByRole('button', { name: 'Plan a route' })))
    await p.context().close()
  })

  // X19 — длинные тексты на телефоне
  await run('X19', async () => {
    const regions = (await getGlobal()).tourismRegions
    const longName = 'Очень длинное название места '.repeat(7).slice(0, 200)
    const longDetails = ('Абзац с очень длинным словом Нурсултанназарбаевскаяобластьпереименованная и обычным текстом. '.repeat(40) + '\n\n').repeat(2).slice(0, 8000)
    const put = await putGlobal({ tourismRegions: regions.map((r) => (r.id === 'zhetysu' ? { ...r, content: { ...r.content, ru: { ...r.content.ru, name: longName, details: longDetails } } } : r)) })
    const p = await newPage({ viewport: { width: 390, height: 844 } }); await p.goto(APP + '/tourism'); await sleep(1500)
    const card = p.locator('#regions button', { hasText: 'Очень длинное название' }).first(); await card.scrollIntoViewIfNeeded()
    const pageScroll = await p.evaluate(() => document.documentElement.scrollWidth)
    await card.click()
    const dlgOverflow = await p.getByRole('dialog').evaluate((el) => el.scrollWidth > el.clientWidth + 1)
    check('X19 200-char name + 8000-char details at 390 px: no horizontal overflow', put.status === 200 && pageScroll <= 390 && !dlgOverflow, `put=${put.status} page=${pageScroll} dialogOverflow=${dlgOverflow}`)
    await p.screenshot({ path: OUT + 'X19-long-texts-390.png' })
    await p.context().close()
  })

  // X20 — файл больше 10 МБ
  await run('X20', async () => {
    const a = await openAdmin(); const ids = trackUploads(a)
    await a.getByRole('tab', { name: 'Страница «Туризм»' }).click()
    const before = await a.getByTestId('tourism-hero-preview').getAttribute('src')
    await a.getByTestId('tourism-hero-input').setInputFiles({ name: 'huge.jpg', mimeType: 'image/jpeg', buffer: Buffer.alloc(11 * 1024 * 1024, 1) })
    check('X20 11 MB image refused before upload, preview unchanged', await visible(a.getByText('Не удалось загрузить изображение')) && ids.length === 0 && (await a.getByTestId('tourism-hero-preview').getAttribute('src')) === before)
    await a.context().close()
  })

  // X22 — сервер ответил 429: админ видит причину
  await run('X22', async () => {
    const a = await openAdmin()
    await a.route('**/api/upload**', (route) => route.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ error: { status: 429, message: 'Too many requests' } }) }))
    await a.locator('aside button', { hasText: 'Алматы' }).click()
    await a.getByTestId('tourism-gallery-input').setInputFiles([png(501)])
    check('X22 429 on upload → «Слишком много загрузок подряд — подождите…»', await visible(a.getByText(/Слишком много загрузок подряд/)))
    await a.getByRole('tab', { name: 'Страница «Туризм»' }).click()
    await a.getByTestId('tourism-hero-input').setInputFiles(png(502))
    check('X22b same message for the hero upload', await visible(a.getByText(/Слишком много загрузок подряд/).nth(0)))
    await a.context().close()
  })

  // X21 — интерфейс админки на английском
  await run('X21', async () => {
    const a = await openAdmin({ lang: 'en' })
    await a.getByRole('tab', { name: 'Tourism page' }).click()
    check('X21 admin in English: tabs and sections translated', await visible(a.getByText('Hero image')) && await visible(a.getByText('Tour package routes')))
    await a.getByRole('tab', { name: 'Places' }).click()
    check('X21b places tab: gallery strings translated', await visible(a.getByText('Gallery')) && await visible(a.getByText(/Full description/)))
    await a.context().close()
  })
} finally {
  const restore = await putGlobal({ tourismRegions: original.tourismRegions ?? baseRegions, tourismPage: original.tourismPage })
  check('X-END original tourism data restored', restore.status === 200, restore.text.slice(0, 200))
}

// X22 подставляет ответ 429 — его записи в консоли ожидаемы.
const unexpected = errors.filter((e) => !/status code 429/.test(e))
check('X-END no page errors / 5xx (besides the 429 that X22 fakes)', unexpected.length === 0, unexpected.join(' | '))
await browser.close()
process.exit(save() ? 0 : 1)
