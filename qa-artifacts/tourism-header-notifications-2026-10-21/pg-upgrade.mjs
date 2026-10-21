// Набор M: обновление существующей PostgreSQL-базы. База создана и наполнена
// кодом до релиза (2e3a819: места в старом формате, конфиг меню без «doctors»,
// 1200 непрочитанных); затем на ней запущен текущий код.
// QA_API=http://localhost:1353 QA_APP=http://localhost:1343 QA_DB=postgres://…/medtour_mig
import { execFileSync } from 'child_process'
import { APP, PUB, USERS, api, createReport, jwtFor, launch, sleep, visible } from './lib.mjs'

const { check, save } = createReport('pg-upgrade')
const q = (query) => execFileSync('/opt/homebrew/opt/postgresql@16/bin/psql', [process.env.QA_DB, '-tAc', query]).toString().trim()
const BEFORE = { regions: '5a32f047a89aaf8d2efac63d112f1371', landing: 'a58dcdf8ad165e0654324729d8d073fb' } // md5, сняты на старой версии

check('M1 new column tourism_page added (jsonb), old ones kept', q("select string_agg(column_name||':'||data_type, ',' order by column_name) from information_schema.columns where table_name='globals' and column_name like 'tourism%'") === 'tourism_page:jsonb,tourism_regions:jsonb')
const [regionsMd5, landingMd5, pageNull] = q('select md5(tourism_regions::text), md5(landing_config::text), tourism_page is null from globals').split('|')
check('M2 saved places and landing config unchanged byte for byte', regionsMd5 === BEFORE.regions && landingMd5 === BEFORE.landing && pageNull === 't', `${regionsMd5} ${landingMd5} ${pageNull}`)

const g = (await api('GET', '/api/global')).json?.data
check('M3 public API: places as saved, tourismPage empty', g?.tourismRegions?.length === 2 && g.tourismRegions[0].content.ru.summary === 'Столица (сохранено до релиза)' && (g.tourismPage ?? null) === null)

const { browser, newPage, errors } = await launch()
{
  const p = await newPage(); await p.goto(APP + '/tourism'); await sleep(2000)
  const hero = await p.locator('section').first().locator('img').first().getAttribute('src')
  check('M4 tourism page: default hero and routes, the 2 saved places', hero === '/kazakhstan-tourism-hero.png' && await visible(p.getByRole('heading', { name: 'Бурабай: лес, озёра и легенды' })) && (await p.locator('#regions button[aria-haspopup="dialog"]').count()) === 2, hero)
  await p.locator('#regions button', { hasText: 'Астана' }).click()
  check('M4b legacy place card opens', await visible(p.getByRole('dialog').getByText('Столица (сохранено до релиза)')))
  await p.context().close()
  const h = await newPage(); await h.goto(APP + '/'); await sleep(1500)
  check('M5 header with the pre-release config: «Наши врачи» shown, the admin’s «Статьи» rename kept', await visible(h.locator('header nav a', { hasText: 'Наши врачи' }), 15000) && await visible(h.locator('header nav a', { hasText: 'Статьи' })))
  await h.context().close()
}

const adminJwt = await jwtFor(USERS.admin)
const unreadBefore = (await api('GET', '/api/notifications/unread-count', { jwt: adminJwt })).json?.data?.count
const mark = await api('PUT', '/api/notifications/mark-all-read', { jwt: adminJwt })
const unreadAfter = (await api('GET', '/api/notifications/unread-count', { jwt: adminJwt })).json?.data?.count
check('M6 1200 notifications created before the release → all marked read', unreadBefore === 1200 && mark.json?.data?.count === 1200 && unreadAfter === 0, `${unreadBefore} → ${mark.text.slice(0, 60)} → ${unreadAfter}`)

{
  const a = await newPage({ as: 'admin', viewport: { width: 1440, height: 1000 } })
  await a.goto(APP + '/admin/tourism')
  await a.locator('aside button', { hasText: 'Павлодарская область' }).click()
  check('M7 admin opens a pre-release place: empty gallery, nothing unsaved', await visible(a.getByText('Пока только обложка'), 15000) && !(await a.getByText('Есть несохранённые изменения').count()))
  await a.getByTestId('tourism-gallery-input').setInputFiles([PUB + 'altai.jpg', PUB + 'charyn.jpg'])
  await a.locator('section', { hasText: 'Галерея' }).locator('li').nth(1).waitFor({ timeout: 20000 })
  await a.getByLabel(/Подробное описание/).fill('Баянаульский национальный парк')
  await a.getByRole('button', { name: 'Сохранить изменения' }).click(); await sleep(2500)
  await a.getByRole('tab', { name: 'Страница «Туризм»' }).click()
  await a.getByTestId('tourism-hero-input').setInputFiles(PUB + 'mangystau.jpg')
  await visible(a.getByRole('button', { name: 'Вернуть стандартную' }), 20000)
  await a.getByRole('button', { name: 'Сохранить изменения' }).click(); await sleep(2500)
  await a.context().close()
  const saved = (await api('GET', '/api/global')).json?.data
  const pav = saved?.tourismRegions?.find((r) => r.id === 'pavlodar')
  check('M7b on the upgraded base: gallery, full description and hero saved; Astana untouched', pav?.gallery?.length === 2 && pav.content.ru.details === 'Баянаульский национальный парк' && Boolean(saved.tourismPage?.heroImage?.url) && saved.tourismPage.tours?.length === 2 && saved.tourismRegions.find((r) => r.id === 'astana').content.ru.summary === 'Столица (сохранено до релиза)')
  const p = await newPage(); await p.goto(APP + '/tourism'); await sleep(2000)
  await p.locator('#regions button', { hasText: 'Павлодарская область' }).click()
  check('M7c public dialog shows 1 / 3 and the description', await visible(p.getByRole('dialog').getByText('1 / 3')) && await visible(p.getByRole('dialog').getByText('Баянаульский национальный парк')))
  await p.context().close()
}
check('M8 no page errors / 5xx', errors.length === 0, errors.join(' | '))
await browser.close()
console.log('md5 after edits:', q('select md5(tourism_regions::text) || \'|\' || md5(tourism_page::text) from globals'))
process.exit(save() ? 0 : 1)
