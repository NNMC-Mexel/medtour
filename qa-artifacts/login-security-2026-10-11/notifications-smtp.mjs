// Notifications are per-user (admin included) and SMTP outages do not hang forms.
// Run on a stand with notif-seed data and SMTP_HOST pointing at an unroutable address.
const API = 'http://127.0.0.1:1351', PASSWORD = 'QaMedtour1!x'
const results = []
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail: String(detail) }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  -> ' + detail}`) }
let n = 1
const req = async (method, url, { body, jwt } = {}) => {
  const t = Date.now()
  const res = await fetch(API + url, { method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `10.40.0.${n++}`, ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}) }, body: body && JSON.stringify(body) })
  let json = null; try { json = await res.json() } catch {}
  return { status: res.status, json, ms: Date.now() - t }
}
const login = async (u) => (await req('POST', '/api/auth/local', { body: { identifier: `${u}@qa.invalid`, password: PASSWORD } })).json?.jwt
const admin = await login('qa-admin'), patient = await login('qa-pat-ru')
const list = async (jwt) => (await req('GET', '/api/notifications?sort=createdAt:desc&pagination[limit]=50', { jwt })).json?.data || []
{
  const a = await list(admin), p = await list(patient)
  check('admin bell shows only own notifications', a.length === 2 && a.every((x) => x.title.startsWith('admin')), a.map((x) => x.title).join(','))
  check('patient bell shows only own notifications', p.length === 3 && p.every((x) => x.title.startsWith('patient')), p.map((x) => x.title).join(','))
  const spoof = await req('GET', '/api/notifications?filters[user][id][$ne]=0', { jwt: admin })
  check('admin cannot widen the list with a user filter', (spoof.json?.data || []).length === 2, (spoof.json?.data || []).length)
  const other = p[0].documentId
  const up = await req('PUT', `/api/notifications/${other}`, { jwt: admin, body: { data: { isRead: true } } })
  const del = await req('DELETE', `/api/notifications/${other}`, { jwt: admin })
  check("admin cannot mark or delete someone else's notification", up.status === 403 && del.status === 403, `${up.status}/${del.status}`)
  check("...and the recipient's notification stays unread", (await list(patient)).filter((x) => !x.isRead).length === 3)
  const mark = await req('PUT', '/api/notifications/mark-all-read', { jwt: admin })
  const again = await list(admin)
  check('mark all read: admin list has no unread afterwards (what the 30 s poll sees)', mark.status === 200 && again.length === 2 && again.every((x) => x.isRead), JSON.stringify(again.map((x) => x.isRead)))
  check("mark all read by admin does not touch the patient's", (await list(patient)).filter((x) => !x.isRead).length === 3)
  const pm = await req('PUT', '/api/notifications/mark-all-read', { jwt: patient })
  check('patient mark all read works too', pm.status === 200 && (await list(patient)).every((x) => x.isRead))
  const cnt = await req('GET', '/api/notifications/unread-count', { jwt: admin })
  check('unread-count agrees', cnt.json?.data?.count === 0, JSON.stringify(cnt.json))
}
{
  const fp = await req('POST', '/api/auth/forgot-password', { body: { email: 'qa-pat-en@qa.invalid' } })
  check('SMTP unreachable: forgot-password answers 200 within 25 s (was up to minutes)', fp.status === 200 && fp.ms < 25_000, `${fp.status} ${fp.ms} ms`)
  const reg = await req('POST', '/api/auth/local/register', { body: { username: 'qa-reg-smtp', email: 'qa-reg-smtp@qa.invalid', password: 'Strong1!pass', fullName: 'QA Reg' } })
  check('SMTP unreachable: register finishes within 45 s and keeps the account', reg.status === 200 && reg.ms < 45_000 && reg.json?.emailDelivered === false, `${reg.status} ${reg.ms} ms ${JSON.stringify(reg.json).slice(0, 160)}`)
  const link = await req('POST', '/api/users/5/password-reset', { jwt: admin })
  check('SMTP unreachable: admin reset link -> 502 within 25 s', link.status === 502 && link.ms < 25_000, `${link.status} ${link.ms} ms`)
}
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
import('node:fs').then((fs) => fs.writeFileSync(new URL('./notifications-smtp-results.json', import.meta.url), JSON.stringify(results, null, 2)))
process.exitCode = failed.length ? 1 : 0
