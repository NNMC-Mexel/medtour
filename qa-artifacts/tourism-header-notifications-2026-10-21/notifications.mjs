// Набор N: «Прочитать все» в уведомлениях — все роли, объём, изоляция, UI.
// QA_DB=sqlite:<путь к .db> | pg:<postgres://…>  (по умолчанию SQLite-копия стенда)
import { execFileSync } from 'child_process'
import { API, USERS, api, createReport, jwtFor, launch, sleep, visible } from './lib.mjs'

const { check, save } = createReport(process.env.QA_SUITE_NAME || 'notifications')
const DB = process.env.QA_DB || `sqlite:${new URL('../../server/.tmp/qa-tnh.db', import.meta.url).pathname}`
const [dialect, ...rest] = DB.split(':')
const target = rest.join(':')
const PSQL = '/opt/homebrew/opt/postgresql@16/bin/psql'

const sql = (query) => (dialect === 'pg'
  ? execFileSync(PSQL, [target, '-tAc', query]).toString().trim()
  : execFileSync('sqlite3', [target, query]).toString().trim())

const userId = (email) => Number(sql(`select id from up_users where email='${email}'`))

// N непрочитанных уведомлений пользователю; tag — чтобы потом найти и связать.
function seed(email, count, tag) {
  const uid = userId(email)
  if (dialect === 'pg') {
    sql(`insert into notifications(document_id,title,message,type,is_read,link,created_at,updated_at,published_at)
      select substr(md5(random()::text),1,24), '${tag} '||x, 'QA', 'message', false, '/', now() - x * interval '1 second', now(), now()
      from generate_series(1,${count}) x`)
  } else {
    sql(`with recursive c(x) as (select 1 union all select x+1 from c where x<${count})
      insert into notifications(document_id,title,message,type,is_read,link,created_at,updated_at,published_at)
      select lower(hex(randomblob(12))), '${tag} '||x, 'QA', 'message', 0, '/', (strftime('%s','now')-x)*1000, strftime('%s','now')*1000, strftime('%s','now')*1000 from c`)
  }
  sql(`insert into notifications_user_lnk(notification_id,user_id) select id, ${uid} from notifications where title like '${tag} %'`)
}
const unread = async (jwt) => (await api('GET', '/api/notifications/unread-count', { jwt })).json?.data?.count
const markAll = (jwt) => api('PUT', '/api/notifications/mark-all-read', { jwt })
const markAllAs = async (jwt) => { await markAll(jwt) }

const jwt = {}
for (const [role, email] of Object.entries(USERS)) jwt[role] = await jwtFor(email)

// Чистое начало: у всех QA-учёток всё прочитано.
for (const role of Object.keys(USERS)) await markAllAs(jwt[role])

// N1 — каждая роль
for (const role of ['patient', 'doctor', 'manager', 'coordinator', 'admin']) {
  seed(USERS[role], 3, `QA-N1-${role}-${Date.now()}`)
  const before = await unread(jwt[role])
  const res = await markAll(jwt[role])
  const after = await unread(jwt[role])
  check(`N1 ${role}: 3 unread → «Прочитать все» → 0`, before === 3 && res.status === 200 && res.json?.data?.count === 3 && after === 0, `${before} → ${res.status} ${res.text.slice(0, 80)} → ${after}`)
}

// N2 — чужие уведомления не трогаются
seed(USERS.manager2, 5, `QA-N2-${Date.now()}`)
seed(USERS.manager, 4, `QA-N2m-${Date.now()}`)
await markAll(jwt.manager)
check('N2 another manager’s unread stay unread (5)', await unread(jwt.manager2) === 5, await unread(jwt.manager2))
await markAll(jwt.manager2)

// N3 — нечего читать
const empty = await markAll(jwt.manager)
check('N3 nothing unread → 200 {count: 0}', empty.status === 200 && empty.json?.data?.count === 0, empty.text)

// N4 — без входа
const anonMark = await api('PUT', '/api/notifications/mark-all-read')
const anonCount = await api('GET', '/api/notifications/unread-count')
check('N4 anonymous: mark-all and unread-count refused', [401, 403].includes(anonMark.status) && [401, 403].includes(anonCount.status), `${anonMark.status} ${anonCount.status}`)

// N5 — объём больше прежнего лимита 1000 (6 пачек по 500)
seed(USERS.manager, 2600, `QA-N5-${Date.now()}`)
const bulkBefore = await unread(jwt.manager)
const started = Date.now()
const bulk = await markAll(jwt.manager)
const ms = Date.now() - started
const bulkAfter = await unread(jwt.manager)
check('N5 2600 unread → all marked in one request', bulkBefore === 2600 && bulk.json?.data?.count === 2600 && bulkAfter === 0, `${bulkBefore} → ${bulk.text.slice(0, 60)} → ${bulkAfter}`)
check(`N5b it is fast (${ms} ms < 3000)`, ms < 3000, ms)
const latest = (await api('GET', '/api/notifications?sort=createdAt:desc&pagination[limit]=50', { jwt: jwt.manager })).json?.data || []
check('N6 the 50 newest in the bell are all read', latest.length > 0 && latest.every((n) => n.isRead), latest.filter((n) => !n.isRead).length)

// N7/N8 — одиночные действия не сломаны
seed(USERS.manager, 2, `QA-N7-${Date.now()}`)
const own = (await api('GET', '/api/notifications?filters[isRead][$eq]=false&pagination[limit]=5', { jwt: jwt.manager })).json?.data || []
const single = await api('PUT', `/api/notifications/${own[0]?.documentId}`, { jwt: jwt.manager, body: { data: { isRead: true } } })
check('N7 marking one notification read still works', single.status === 200 && await unread(jwt.manager) === 1, `${single.status} ${await unread(jwt.manager)}`)
const foreign = await api('PUT', `/api/notifications/${own[1]?.documentId}`, { jwt: jwt.manager2, body: { data: { isRead: true } } })
check('N7b someone else cannot mark it (403)', foreign.status === 403, foreign.status)
const del = await api('DELETE', `/api/notifications/${own[1]?.documentId}`, { jwt: jwt.manager })
check('N8 deleting own notification still works', del.status === 200 && await unread(jwt.manager) === 0, `${del.status} ${await unread(jwt.manager)}`)

// N9 — новое уведомление после «Прочитать все» остаётся непрочитанным
await markAll(jwt.manager)
seed(USERS.manager, 1, `QA-N9-${Date.now()}`)
check('N9 a notification arriving afterwards is unread (1)', await unread(jwt.manager) === 1)
await markAll(jwt.manager)

// N10 — интерфейс: колокольчик у ролей, где была жалоба (менеджер) и где не проверяли (координатор, врач)
if (!process.env.QA_SKIP_UI) {
  const { browser, newPage, errors } = await launch()
  for (const [role, home] of [['manager', '/manager'], ['coordinator', '/coordinator'], ['doctor', '/doctor']]) {
    seed(USERS[role], 1200, `QA-N10-${role}-${Date.now()}`)
    const p = await newPage({ as: role })
    await p.goto(`${process.env.QA_APP || 'http://localhost:1342'}${home}`)
    const bell = p.locator('header button:has(svg.lucide-bell)').first()
    await visible(bell, 15000); await sleep(2500)
    const before = (await bell.textContent()).trim()
    await bell.click()
    await p.getByRole('button', { name: 'Прочитать все' }).click()
    await sleep(1500)
    const afterClick = (await bell.textContent()).trim()
    await p.reload(); await visible(p.locator('header button:has(svg.lucide-bell)'), 15000); await sleep(3000)
    const afterReload = (await p.locator('header button:has(svg.lucide-bell)').first().textContent()).trim()
    check(`N10 ${role} UI: badge «${before}» → empty after click and after reload; server 0`, before === '9+' && afterClick === '' && afterReload === '' && await unread(jwt[role]) === 0, `${before} / ${afterClick} / ${afterReload} / ${await unread(jwt[role])}`)
    if (role === 'manager') await p.screenshot({ path: new URL('./screens/', import.meta.url).pathname + 'N10-manager-bell.png' })
    await p.context().close()
  }
  // Страница «Уведомления» у врача — та же кнопка
  seed(USERS.doctor, 30, `QA-N11-${Date.now()}`)
  const d = await newPage({ as: 'doctor' })
  await d.goto(`${process.env.QA_APP || 'http://localhost:1342'}/doctor/notifications`)
  const pageButton = d.locator('main').getByRole('button', { name: 'Прочитать все' })
  await visible(pageButton, 15000)
  await pageButton.click(); await sleep(1500)
  check('N11 doctor: «Прочитать все» on the Notifications page → 0', await unread(jwt.doctor) === 0, await unread(jwt.doctor))
  await d.context().close()
  check('N12 no page errors / 5xx', errors.length === 0, errors.join(' | '))
  await browser.close()
}

console.log(`API ${API}, DB ${dialect}`)
process.exit(save(process.env.QA_RESULTS_SUFFIX || '') ? 0 : 1)
