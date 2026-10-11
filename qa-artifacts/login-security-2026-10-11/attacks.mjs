// Senior QA: adversarial cases from the code review. Run on a fresh stand (stand.sh) after nothing else.
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { makeDb, toMs } from './db.mjs'
const [,, MODE, QA_DIR] = process.argv
const { sql, row, ts } = makeDb(MODE)
const API = 'http://127.0.0.1:1351'
const PASSWORD = 'QaMedtour1!x'
const LOG = path.join(QA_DIR, 'strapi.log')
const results = []
// Never keep tokens in results: they are signed with the local JWT_SECRET.
const redact = (v) => String(v).replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, '<jwt>');
const check = (id, name, ok, detail = '') => { results.push({ id, name, ok: !!ok, detail: redact(detail).slice(0, 400) }); console.log(`${ok ? 'PASS' : 'FAIL'}  [${id}] ${name}${ok ? '' : '  -> ' + detail}`) }
let ipSeq = 1
const proxyIp = () => `10.30.${Math.floor(ipSeq / 250)}.${(ipSeq++ % 250) + 1}`
const req = async (method, url, { body, raw, jwt, xff, headers = {} } = {}) => {
  const h = { 'Content-Type': 'application/json', ...headers }
  if (xff !== null) h['X-Forwarded-For'] = xff ?? `203.0.113.9, ${proxyIp()}`
  if (jwt) h.Authorization = `Bearer ${jwt}`
  const res = await fetch(API + url, { method, headers: h, body: raw ?? (body === undefined ? undefined : JSON.stringify(body)) })
  let json = null; const text = await res.text(); try { json = JSON.parse(text) } catch {}
  return { status: res.status, json, text, headers: res.headers }
}
const login = (identifier, password = PASSWORD, opts = {}) => req('POST', '/api/auth/local', { body: { identifier, password }, ...opts })
const email = (u) => `${u}@qa.invalid`
const id = (u) => row(`select id from up_users where username='${u}'`).id
const u = (name) => row(`select failed_login_count c, login_locked_until l, reset_password_token t, reset_password_token_expires_at e, password p, confirmed, blocked from up_users where username='${name}'`)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const logSince = (mark) => fs.readFileSync(LOG, 'utf8').slice(mark)
const logMark = () => fs.readFileSync(LOG, 'utf8').length
const admin = (await login('qa-admin')).json?.jwt
const doctor = (await login('qa-doc')).json?.jwt
check('S0', 'seed logins', admin && doctor)

// A1 — {data:{…}} wrapper must not hide top-level fields from the checks
{
  const t = id('qa-pat-ru')
  const before = u('qa-pat-ru')
  const r1 = await req('PUT', `/api/users/${t}`, { jwt: admin, body: { data: {}, password: 'abc' } })
  const afterPw = u('qa-pat-ru')
  check('A1.1', 'PUT {data:{}, password} is rejected and password unchanged', r1.status === 400 && afterPw.p === before.p, `${r1.status} changed=${afterPw.p !== before.p} ${r1.text.slice(0, 160)}`)
  const r2 = await req('PUT', `/api/users/${t}`, { jwt: admin, body: { data: { phone: '+7 700 111 2233' }, resetPasswordToken: 'planted-by-admin' } })
  check('A1.2', 'PUT {data:{…}, resetPasswordToken} is rejected and token not planted', r2.status === 400 && u('qa-pat-ru').t !== 'planted-by-admin', `${r2.status} token=${u('qa-pat-ru').t}`)
  const r3 = await req('PUT', `/api/users/${t}`, { jwt: admin, body: { data: {}, tokenValidAfter: '2000-01-01T00:00:00.000Z' } })
  check('A1.3', 'PUT {data:{}, tokenValidAfter} is rejected', r3.status === 400, `${r3.status} ${r3.text.slice(0, 160)}`)
  const r4 = await req('PUT', `/api/users/${t}`, { jwt: admin, body: { data: { password: 'abc' } } })
  check('A1.4', 'PUT {data:{password}} is rejected', r4.status === 400, r4.status)
  const r5 = await req('POST', '/api/users', { jwt: admin, body: { data: { username: 'qa-w1', email: 'qa-w1@qa.invalid', password: 'Strong1!pass', userRole: 'manager' }, resetPasswordToken: 'planted' } })
  const created = row(`select reset_password_token t from up_users where username='qa-w1'`)
  check('A1.5', 'POST {data:{…}, resetPasswordToken}: token never stored', !created || created.t !== 'planted', JSON.stringify(created))
}

// A2 — parallel bursts must not evade the lockout (lost updates on the counter)
{
  const name = 'qa-pat-burst'
  let bursts = 0
  for (; bursts < 3; bursts++) {
    await Promise.all(Array.from({ length: 10 }, (_, i) => login(email(name), `Wrong${bursts}${i}!x`)))
    if (u(name).l) break
  }
  const st = u(name)
  check('A2.1', '10 parallel wrong logins lock the account (no lost updates)', !!st.l && bursts === 0, `bursts=${bursts + 1} count=${st.c} locked=${st.l}`)
  await sleep(800)
  const lockMails = fs.existsSync(path.join(QA_DIR, 'mails.jsonl')) ? fs.readFileSync(path.join(QA_DIR, 'mails.jsonl'), 'utf8').split('\n').filter((l) => l.includes(email(name))).length : 0
  check('A2.2', 'parallel burst sends exactly one lock email', lockMails === 1, lockMails)
  const more = await Promise.all(Array.from({ length: 30 }, (_, i) => login(email(name), `More${i}!x`)))
  check('A2.3', '30 more parallel attempts during the lock: all 429, no 500', more.every((r) => r.status === 429), [...new Set(more.map((r) => r.status))].join(','))
}

// A3 — stale/legacy token of a BLOCKED user must not be re-armed by forgot-password
{
  const name = 'qa-pat-blocked'
  const legacy = 'legacy' + 'b'.repeat(60)
  sql(`update up_users set reset_password_token='${legacy}', reset_password_token_expires_at=NULL where username='${name}'`)
  await req('POST', '/api/auth/forgot-password', { body: { email: email(name) } })
  const st = u(name)
  check('A3.1', 'forgot-password for a blocked user does not give the old token a fresh expiry', !Number.isFinite(toMs(st.e)), `expires=${st.e}`)
  const r = await req('POST', '/api/auth/reset-password', { body: { code: legacy, password: 'Revived1!pass', passwordConfirmation: 'Revived1!pass' } })
  check('A3.2', 'legacy token of a blocked user cannot be used', r.status === 400, `${r.status} ${r.text.slice(0, 120)}`)
}

// A4 — a link issued before the account was blocked
{
  const name = 'qa-pat-blocked2'
  await req('POST', '/api/auth/forgot-password', { body: { email: email(name) } })
  const code = u(name).t
  await req('PUT', `/api/users/${id(name)}`, { jwt: admin, body: { blocked: true } })
  const r = await req('POST', '/api/auth/reset-password', { body: { code, password: 'Blocked1!pass', passwordConfirmation: 'Blocked1!pass' } })
  const me = r.json?.jwt ? await req('GET', '/api/users/me', { jwt: r.json.jwt }) : { status: 'no-jwt' }
  check('A4.1', 'blocked user cannot use a link issued before the block (or gets no working session)', r.status === 400 || me.status === 401, `reset=${r.status} me=${me.status}`)
  check('A4.2', 'blocked user: link rejected outright (no password change while blocked)', r.status === 400, `reset=${r.status}`)
}

// A5 — the same link used twice in parallel
{
  const name = 'qa-pat-race'
  await req('POST', '/api/auth/forgot-password', { body: { email: email(name) } })
  const code = u(name).t
  const rs = await Promise.all(['RaceOne1!x', 'RaceTwo2!x', 'RaceThree3!x'].map((p) => req('POST', '/api/auth/reset-password', { body: { code, password: p, passwordConfirmation: p } })))
  const ok = rs.filter((r) => r.status === 200).length
  check('A5.1', 'one link, three parallel resets: no 500', rs.every((r) => r.status < 500), rs.map((r) => r.status).join(','))
  check('A5.2', 'one link, three parallel resets: exactly one succeeds', ok === 1, rs.map((r) => r.status).join(','))
}

// A6/A7 — same counter whatever the identifier; lock applies to all of them
{
  const name = 'qa-pat-phone'
  const ids = ['+7 701 555 0101', '87015550101', name, email(name).toUpperCase(), email(name)]
  for (let i = 0; i < 10; i++) await login(ids[i % ids.length], `Wrong${i}!pass`)
  const st = u(name)
  check('A6.1', 'failures via phone / 8-prefix / username / UPPER email / email share one counter and lock', !!st.l, `count=${st.c} locked=${st.l}`)
  const results = await Promise.all(ids.map((i) => login(i)))
  check('A6.2', 'locked account refuses every identifier form', results.every((r) => r.status === 429), results.map((r) => r.status).join(','))
}

// A8 — odd identifier / password types never crash
{
  const bodies = [
    { identifier: ['qa-admin@qa.invalid'], password: 'x' }, { identifier: { $ne: null }, password: 'x' },
    { identifier: 12345, password: 'x' }, { identifier: 'a'.repeat(20000), password: 'x' },
    { identifier: 'qa-admin@qa.invalid', password: { $ne: null } }, { identifier: null, password: null }, {},
    { identifier: "' OR 1=1 --", password: "' OR 1=1 --" },
  ]
  const st = []
  for (const body of bodies) st.push((await req('POST', '/api/auth/local', { body })).status)
  check('A8.1', 'malformed login bodies: 4xx, never 500 or 200', st.every((s) => s >= 400 && s < 500), st.join(','))
  const raw = await req('POST', '/api/auth/local', { raw: '{"identifier":' })
  check('A8.2', 'broken JSON: 4xx', raw.status >= 400 && raw.status < 500, raw.status)
}

// A9 — unconfirmed user: correct password is not a "failure"; wrong one is
{
  const name = 'qa-pat-unconf'
  const r = await login(email(name))
  check('A9.1', 'unconfirmed + correct password: refused, not counted', r.status >= 400 && !u(name).c, `${r.status} count=${u(name).c}`)
  await login(email(name), 'Wrong1!pass')
  check('A9.2', 'unconfirmed + wrong password: counted', u(name).c === 1, u(name).c)
}

// A10 — enumeration: lock answer differs for existing vs unknown accounts (documented risk)
{
  const unknown = await Promise.all(Array.from({ length: 11 }, (_, i) => login('ghost@qa.invalid', `Wrong${i}!x`)))
  check('A10.1', 'unknown account never answers account_locked', unknown.every((r) => r.json?.error?.message !== 'account_locked'), unknown.map((r) => r.status).join(','))
}

// A11 — admin set-password input hardening; stored as bcrypt
{
  const t = id('qa-pat-en')
  const bad = [123456789, ['Strong1!pass'], { $ne: null }, null, '', ' Strong1!pass', 'Ab1!' + 'x'.repeat(100)]
  const st = []
  for (const password of bad) st.push((await req('PUT', `/api/users/${t}/password`, { jwt: admin, body: { password } })).status)
  check('A11.1', 'non-string / empty / padded / >72 bytes passwords -> 400', st.every((s) => s === 400), st.join(','))
  const big = await req('PUT', `/api/users/${t}/password`, { jwt: admin, raw: JSON.stringify({ password: 'A1!a' + 'x'.repeat(2_000_000) }) })
  check('A11.2', '2 MB body rejected without 500', big.status === 413 || big.status === 400, big.status)
  const ok = await req('PUT', `/api/users/${t}/password`, { jwt: admin, body: { password: 'Bcrypt1!check' } })
  check('A11.3', 'stored as bcrypt hash', ok.status === 200 && /^\$2[aby]\$/.test(u('qa-pat-en').p), u('qa-pat-en').p?.slice(0, 7))
  const docId = row(`select document_id d from up_users where id=${t}`).d
  const byDoc = await req('POST', `/api/users/${docId}/password-reset`, { jwt: admin })
  check('A11.4', 'documentId in path -> 404 (endpoints take numeric id)', byDoc.status === 404, byDoc.status)
  const doc = await req('PUT', `/api/users/${t}/password`, { jwt: doctor, body: { password: 'Doctor1!pass' } })
  check('A11.5', 'doctor cannot use admin password endpoint', doc.status === 403, doc.status)
}

// A12 — e-mail outage
{
  execSync('pkill -f smtp-sink.cjs || true')
  await sleep(300)
  const name = 'qa-pat-mailfail'
  const r = await req('POST', `/api/users/${id(name)}/password-reset`, { jwt: admin })
  check('A12.1', 'admin link with mail down -> 502 email_send_failed', r.status === 502 && r.json?.error?.message === 'email_send_failed', `${r.status} ${r.text.slice(0, 120)}`)
  const fp = await req('POST', '/api/auth/forgot-password', { body: { email: email(name) } })
  check('A12.2', 'forgot-password with mail down still 200 (no account oracle)', fp.status === 200, fp.status)
  check('A12.3', '...and the issued token still gets an expiry', Number.isFinite(toMs(u(name).e)))
  const ghost = await req('POST', '/api/auth/forgot-password', { body: { email: 'ghost@qa.invalid' } })
  check('A12.4', 'forgot-password: same answer for unknown email', ghost.status === fp.status && JSON.stringify(ghost.json) === JSON.stringify(fp.json), `${JSON.stringify(ghost.json)} vs ${JSON.stringify(fp.json)}`)
  let last
  for (let i = 0; i < 10; i++) last = await login(email(name), `Wrong${i}!pass`)
  check('A12.5', 'lock still happens with mail down; 10th answer is a normal 400', !!u(name).l && last.status === 400, `${last.status} locked=${u(name).l}`)
  const set = await req('PUT', `/api/users/${id(name)}/password`, { jwt: admin, body: { password: 'MailDown1!x' } })
  check('A12.6', 'admin set-password with mail down: 200, notified=false', set.status === 200 && set.json?.notified === false, JSON.stringify(set.json))
  execSync(`node ${path.join(QA_DIR, 'smtp-sink.cjs')} > ${path.join(QA_DIR, 'smtp.log')} 2>&1 &`)
  await sleep(500)
}

// A13 — other write paths for server-only fields
{
  const jwt = (await login('qa-pat-race', 'RaceOne1!x')).json?.jwt || (await login('qa-pat-race', 'RaceTwo2!x')).json?.jwt || (await login('qa-pat-race', 'RaceThree3!x')).json?.jwt
  const me = await req('PUT', '/api/users/me', { jwt, body: { fullName: 'QA Race', resetPasswordToken: 'self-planted', tokenValidAfter: '2000-01-01T00:00:00.000Z', loginLockedUntil: '2099-01-01T00:00:00.000Z' } })
  const st = u('qa-pat-race')
  check('A13.1', 'PUT /users/me ignores server-only fields', me.status === 200 && st.t !== 'self-planted' && !st.l, `${me.status} t=${st.t} l=${st.l}`)
  const reg = await req('POST', '/api/auth/local/register', { body: { username: 'qa-reg1', email: 'qa-reg1@qa.invalid', password: 'Strong1!pass', resetPasswordToken: 'reg-planted' } })
  const regRow = row(`select reset_password_token t from up_users where username='qa-reg1'`)
  check('A13.2', 'register with resetPasswordToken: not stored', !regRow || regRow.t !== 'reg-planted', `${reg.status} ${JSON.stringify(regRow)}`)
}

// A14 — private fields through filters / sort / fields / populate
{
  sql(`update up_users set failed_login_count=5 where username='qa-pat-ru'`)
  const all = (await req('GET', '/api/users?pagination[pageSize]=100', { jwt: admin })).json
  const total = Array.isArray(all) ? all.length : -1
  const probes = {
    'filters failedLoginCount': '/api/users?filters[failedLoginCount][$gt]=0',
    'filters loginLockedUntil': '/api/users?filters[loginLockedUntil][$notNull]=true',
    'filters resetPasswordTokenExpiresAt': '/api/users?filters[resetPasswordTokenExpiresAt][$notNull]=true',
    'filters password $startsWith': '/api/users?filters[password][$startsWith]=$2',
  }
  for (const [label, url] of Object.entries(probes)) {
    const r = await req('GET', url, { jwt: admin })
    const n = Array.isArray(r.json) ? r.json.length : null
    check('A14', `admin ${label}: no oracle`, r.status === 400 || n === total || n === 0 && total === 0, `${r.status} n=${n} total=${total}`)
  }
  const fields = await req('GET', '/api/users?fields[0]=failedLoginCount&fields[1]=resetPasswordToken&sort=loginLockedUntil:desc', { jwt: admin })
  check('A14', 'fields/sort on private fields: rejected (400) or values never returned', fields.status === 400 || !/"(failedLoginCount|resetPasswordToken|loginLockedUntil)":/.test(fields.text), fields.text.slice(0, 160))
  const pop = await req('GET', '/api/doctors?populate[users_permissions_user][fields][0]=failedLoginCount&populate[users_permissions_user][fields][1]=resetPasswordToken', { xff: undefined })
  check('A14', 'anonymous populate of doctor user: rejected or private fields absent', pop.status === 400 || !/"(failedLoginCount|resetPasswordToken|password)":/.test(pop.text), `${pop.status} ${pop.text.slice(0, 160)}`)
  const popf = await req('GET', '/api/doctors?filters[users_permissions_user][failedLoginCount][$gt]=0')
  check('A14', 'anonymous filter by doctor user failedLoginCount: rejected or ignored', popf.status === 400 || popf.status === 403 || popf.status === 200, popf.status)
}

// A15 — X-Forwarded-For edge cases
{
  const st = []
  for (const xff of ['garbage', '', ' , , ', '2001:db8::1', '1.1.1.1,2.2.2.2,3.3.3.3,4.4.4.4', 'a'.repeat(5000)]) st.push((await login('ghost-xff@qa.invalid', 'Wrong1!x', { xff })).status)
  st.push((await login('ghost-xff@qa.invalid', 'Wrong1!x', { xff: null })).status)
  check('A15.1', 'odd X-Forwarded-For values: no 500', st.every((s) => s < 500), st.join(','))
  const mark = logMark()
  await login('ghost-ipv6@qa.invalid', 'Wrong1!x', { xff: '6.6.6.6, 2001:db8::7' })
  await sleep(200)
  check('A15.2', 'IPv6 client address recorded as-is', logSince(mark).includes('"ip":"2001:db8::7"'), logSince(mark).split('\n').find((l) => l.includes('LOGIN_FAILURE')))
}

// A16 — lock expiry and failure window
{
  const name = 'qa-pat-window'
  sql(`update up_users set login_locked_until=${ts(Date.now() - 60_000)}, failed_login_count=0 where username='${name}'`)
  const ok = await login(email(name))
  check('A16.1', 'expired lock: correct password works and lock is cleared', ok.status === 200 && !u(name).l, `${ok.status} l=${u(name).l}`)
  sql(`update up_users set failed_login_count=9, last_failed_login_at=${ts(Date.now() - 61 * 60_000)} where username='${name}'`)
  await login(email(name), 'Wrong1!x')
  check('A16.2', '9 old failures (>60 min) + 1 new = count 1, no lock', u(name).c === 1 && !u(name).l, `c=${u(name).c} l=${u(name).l}`)
  sql(`update up_users set failed_login_count=9, last_failed_login_at=${ts(Date.now() - 5 * 60_000)} where username='${name}'`)
  await login(email(name), 'Wrong2!x')
  check('A16.3', '9 recent failures + 1 = lock', !!u(name).l, `c=${u(name).c} l=${u(name).l}`)
  const lockedUntil = toMs(u(name).l)
  check('A16.4', 'lock lasts ~15 min', Math.abs(lockedUntil - Date.now() - 15 * 60_000) < 60_000, (lockedUntil - Date.now()) / 60000)
}

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
fs.writeFileSync(path.join(QA_DIR, `attacks-results-${MODE}.json`), JSON.stringify(results, null, 2))
process.exit(failed.length ? 1 : 0)
