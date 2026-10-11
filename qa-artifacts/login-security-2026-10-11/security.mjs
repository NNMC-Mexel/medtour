// API security suite for the medtour port (isolated QA Strapi on :1351, synthetic users).
import { makeDb, toMs } from './db.mjs';
import fs from 'node:fs';
import path from 'node:path';
const [,, MODE, QA_DIR] = process.argv;
const API = 'http://127.0.0.1:1351';
const PASSWORD = 'QaMedtour1!x';
const MAILS = path.join(QA_DIR, 'mails.jsonl');
const LOG = path.join(QA_DIR, 'strapi.log');
const results = [];
// Never keep tokens in results: they are signed with the local JWT_SECRET.
const redact = (v) => String(v).replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, '<jwt>');
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail: redact(detail).slice(0, 300) }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  -> ' + detail}`); };
let ipSeq = 1;
const proxyIp = () => `10.20.${Math.floor(ipSeq / 250)}.${(ipSeq++ % 250) + 1}`;
const req = async (method, url, { body, jwt, xff } = {}) => {
  const headers = { 'Content-Type': 'application/json', 'X-Forwarded-For': xff ?? `203.0.113.7, ${proxyIp()}` };
  if (jwt) headers.Authorization = `Bearer ${jwt}`;
  const res = await fetch(API + url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  let json = null; try { json = await res.json(); } catch {}
  return { status: res.status, json, headers: res.headers };
};
const { sql, row, ts } = makeDb(MODE);
const login = (identifier, password = PASSWORD, xff) => req('POST', '/api/auth/local', { body: { identifier, password }, xff });
const email = (u) => `${u}@qa.invalid`;
const decodeQP = (s) => Buffer.from(s.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16))), 'latin1').toString('utf8');
const decodeMail = (raw) => {
  // Decode every MIME part (base64 / quoted-printable) and concatenate.
  const parts = raw.split(/\n--[^\n]+\n/);
  return parts.map((p) => {
    const [head, ...rest] = p.split('\n\n'); const body = rest.join('\n\n');
    if (/content-transfer-encoding:\s*base64/i.test(head)) return Buffer.from(body.replace(/\s+/g, ''), 'base64').toString('utf8');
    if (/content-transfer-encoding:\s*quoted-printable/i.test(head)) return decodeQP(body);
    return p;
  }).join('\n');
};
const subjectOf = (raw) => {
  const m = raw.match(/^Subject: (.*(?:\n[ \t].*)*)/m); if (!m) return '';
  return m[1].replace(/\n[ \t]/g, '').replace(/=\?utf-8\?([BQ])\?([^?]*)\?=/gi, (_, enc, txt) => enc.toUpperCase() === 'B' ? Buffer.from(txt, 'base64').toString('utf8') : decodeQP(txt.replace(/_/g, ' '))).replace(/\s+(?==\?)/g, '');
};
const mails = () => fs.existsSync(MAILS) ? fs.readFileSync(MAILS, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)).map((m) => ({ ...m, subject: subjectOf(m.data), text: decodeMail(m.data) })) : [];
const mailsTo = (u) => mails().filter((m) => m.to.some((t) => t.includes(email(u))));
const lastCode = (u) => { const m = mailsTo(u).at(-1); const c = m?.text.match(/code=([0-9a-f]{40,})/); return c?.[1]; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const userId = (u) => row(`select id from up_users where username='${u}'`).id;

// ── tokens
const admin = (await login('qa-admin')).json?.jwt;
const manager = (await login('qa-manager')).json?.jwt;
const patRu = (await login('qa-pat-ru')).json?.jwt;
check('seed logins work', admin && manager && patRu);
const ids = Object.fromEntries(['qa-admin', 'qa-admin2', 'qa-manager', 'qa-pat-en', 'qa-pat-ru', 'qa-pat-lock', 'qa-pat-reset', 'qa-pat-blocked'].map((u) => [u, userId(u)]));

// ── 1. Client IP: spoofed first X-Forwarded-For entry is ignored
{
  const before = fs.readFileSync(LOG, 'utf8').length;
  await login('nobody-ip@qa.invalid', 'Wrong1!pass', '6.6.6.6, 10.99.0.1');
  await sleep(300);
  const tail = fs.readFileSync(LOG, 'utf8').slice(before);
  const line = tail.split('\n').find((l) => l.includes('"audit":"LOGIN_FAILURE"')) || '';
  check('LOGIN_FAILURE logged with proxy-appended IP, not the client-supplied one', line.includes('"ip":"10.99.0.1"') && !line.includes('6.6.6.6'), line);
}
{
  // Rotating the client-supplied part must not dodge the per-IP login limit.
  const statuses = [];
  for (let i = 0; i < 70; i++) statuses.push((await login(`nobody${i}@qa.invalid`, 'Wrong1!pass', `198.51.100.${i}, 10.98.0.1`)).status);
  check('login limit holds while the client rotates the first X-Forwarded-For entry', statuses.includes(429), statuses.join(','));
  const other = await login('nobody-other@qa.invalid', 'Wrong1!pass', '198.51.100.1, 10.98.0.2');
  check('another client behind the same proxy is not limited', other.status === 400, other.status);
}

// ── 2. Account lockout (failures from 10 different IPs)
{
  const u = 'qa-pat-lock';
  let last;
  for (let i = 0; i < 9; i++) last = await login(u, 'Wrong1!pass');
  check('9 failures: still 400 invalid credentials', last.status === 400, last.status);
  check('counter is stored on the account', row(`select failed_login_count c from up_users where id=${ids[u]}`).c === 9);
  last = await login(u, 'Wrong1!pass');
  check('10th failure locks the account', !!row(`select login_locked_until l from up_users where id=${ids[u]}`).l);
  const locked = await login(u, PASSWORD);
  check('correct password during lock -> 429 account_locked', locked.status === 429 && locked.json?.error?.message === 'account_locked', JSON.stringify(locked.json));
  check('Retry-After header present', Number(locked.headers.get('retry-after')) > 800, locked.headers.get('retry-after'));
  await sleep(500);
  const lockMail = mailsTo(u).at(-1);
  check('lock email sent in the user language (kk)', lockMail && /жабылды/.test(lockMail.subject), lockMail?.subject);
  const log = fs.readFileSync(LOG, 'utf8');
  check('ACCOUNT_LOCKED in the audit log', log.includes('"audit":"ACCOUNT_LOCKED"') && log.includes(`"userId":${ids[u]}`));
  // forgot-password unlocks
  const fp = await req('POST', '/api/auth/forgot-password', { body: { email: email(u) } });
  check('forgot-password 200', fp.status === 200, fp.status);
  await sleep(500);
  const code = lastCode(u);
  check('reset email carries a code', !!code);
  const exp = row(`select reset_password_token_expires_at e from up_users where id=${ids[u]}`).e;
  const ttlMin = (toMs(exp) - Date.now()) / 60000;
  check('self-service link expires in ~60 min', ttlMin > 55 && ttlMin <= 60, ttlMin);
  const rp = await req('POST', '/api/auth/reset-password', { body: { code, password: 'NewLock1!pass', passwordConfirmation: 'NewLock1!pass' } });
  check('reset with valid link 200 + jwt', rp.status === 200 && rp.json?.jwt, JSON.stringify(rp.json).slice(0, 200));
  const after = row(`select failed_login_count c, login_locked_until l, reset_password_token t, reset_password_token_expires_at e from up_users where id=${ids[u]}`);
  check('reset clears lock, counter, token and expiry', !after.c && !after.l && !after.t && !after.e, JSON.stringify(after));
  const ok = await login(u, 'NewLock1!pass');
  check('login with new password after unlock', ok.status === 200, ok.status);
  const reuse = await req('POST', '/api/auth/reset-password', { body: { code, password: 'Again1!pass', passwordConfirmation: 'Again1!pass' } });
  check('used link cannot be reused', reuse.status === 400, reuse.status);
}
{
  const u = 'qa-pat-ru';
  for (let i = 0; i < 3; i++) await login(u, 'Wrong1!pass');
  check('3 failures counted', row(`select failed_login_count c from up_users where id=${ids[u]}`).c === 3);
  const ok = await login(u);
  check('successful login resets the counter', ok.status === 200 && !row(`select failed_login_count c from up_users where id=${ids[u]}`).c);
  const unknown = await login('no-such-user@qa.invalid', 'Wrong1!pass');
  check('unknown account: plain 400, no crash', unknown.status === 400, unknown.status);
}

// ── 3. Reset link expiry
{
  const u = 'qa-pat-reset';
  await req('POST', '/api/auth/forgot-password', { body: { email: email(u) } });
  await sleep(400);
  let code = lastCode(u);
  const weak = await req('POST', '/api/auth/reset-password', { body: { code, password: 'abcdefgh', passwordConfirmation: 'abcdefgh' } });
  check('weak password via link -> 400 policy', weak.status === 400 && /password_/.test(weak.json?.error?.details?.code || ''), JSON.stringify(weak.json));
  check('weak attempt does not burn the link', !!row(`select reset_password_token t from up_users where id=${ids[u]}`).t);
  sql(`update up_users set reset_password_token_expires_at=${ts(Date.now() - 1000)} where id=${ids[u]}`);
  const expired = await req('POST', '/api/auth/reset-password', { body: { code, password: 'Fresh1!pass', passwordConfirmation: 'Fresh1!pass' } });
  check('expired link -> 400 reset_link_expired', expired.status === 400 && expired.json?.error?.message === 'reset_link_expired', JSON.stringify(expired.json));
  check('expired token is erased', !row(`select reset_password_token t from up_users where id=${ids[u]}`).t);
  sql(`update up_users set reset_password_token='legacy${'a'.repeat(60)}', reset_password_token_expires_at=NULL where id=${ids[u]}`);
  const legacy = await req('POST', '/api/auth/reset-password', { body: { code: `legacy${'a'.repeat(60)}`, password: 'Fresh1!pass', passwordConfirmation: 'Fresh1!pass' } });
  check('legacy link without expiry counts as expired', legacy.json?.error?.message === 'reset_link_expired', JSON.stringify(legacy.json));
  const op = await req('POST', '/api/auth/reset-password', { body: { code: { $ne: null }, password: 'Fresh1!pass', passwordConfirmation: 'Fresh1!pass' } });
  check('operator object as code rejected', op.status === 400, op.status);
  // new link kills the old one
  await req('POST', '/api/auth/forgot-password', { body: { email: email(u) } }); await sleep(300);
  const first = lastCode(u);
  await req('POST', '/api/auth/forgot-password', { body: { email: email(u) } }); await sleep(300);
  const second = lastCode(u);
  const old = await req('POST', '/api/auth/reset-password', { body: { code: first, password: 'Fresh1!pass', passwordConfirmation: 'Fresh1!pass' } });
  check('a newer link invalidates the older one', first !== second && old.status === 400, old.status);
  const jwtBefore = (await login(u)).json?.jwt;
  const good = await req('POST', '/api/auth/reset-password', { body: { code: second, password: 'Fresh1!pass', passwordConfirmation: 'Fresh1!pass' } });
  check('newest link works', good.status === 200, good.status);
  const me = await req('GET', '/api/users/me', { jwt: jwtBefore });
  check('reset by link revokes earlier sessions', me.status === 401, me.status);
}

// ── 4. Server-only user fields
{
  const t = ids['qa-pat-en'];
  for (const field of ['resetPasswordToken', 'confirmationToken', 'tokenValidAfter', 'failedLoginCount', 'loginLockedUntil', 'resetPasswordTokenExpiresAt']) {
    const value = field === 'failedLoginCount' ? 0 : field.endsWith('At') || field === 'tokenValidAfter' || field === 'loginLockedUntil' ? '2000-01-01T00:00:00.000Z' : 'planted-token';
    const r = await req('PUT', `/api/users/${t}`, { jwt: admin, body: { [field]: value } });
    check(`PUT /users/:id rejects ${field}`, r.status === 400 && r.json?.error?.message === 'protected_user_fields', `${r.status} ${JSON.stringify(r.json)}`);
  }
  check('planted token was not written', row(`select reset_password_token t from up_users where id=${t}`).t !== 'planted-token');
  const wrapped = await req('PUT', `/api/users/${t}`, { jwt: admin, body: { data: { resetPasswordToken: 'planted-token' } } });
  check('PUT with {data:{…}} wrapper also rejected', wrapped.status === 400, wrapped.status);
  const pw = await req('PUT', `/api/users/${t}`, { jwt: admin, body: { password: 'Strong1!pass' } });
  check('PUT /users/:id no longer accepts password', pw.status === 400 && pw.json?.error?.message === 'password_change_not_allowed_here', JSON.stringify(pw.json));
  const normal = await req('PUT', `/api/users/${t}`, { jwt: admin, body: { phone: '+7 700 000 0001' } });
  check('ordinary admin edit still works', normal.status === 200, normal.status);
  const c1 = await req('POST', '/api/users', { jwt: admin, body: { username: 'qa-new1', email: 'qa-new1@qa.invalid', password: 'abcdefgh', userRole: 'manager' } });
  check('POST /users with weak password -> 400', c1.status === 400, c1.status);
  const c2 = await req('POST', '/api/users', { jwt: admin, body: { username: 'qa-new2', email: 'qa-new2@qa.invalid', password: 'Strong1!pass', userRole: 'manager', resetPasswordToken: 'planted' } });
  check('POST /users with resetPasswordToken -> 400', c2.status === 400 && c2.json?.error?.message === 'protected_user_fields', JSON.stringify(c2.json));
  const one = await req('GET', `/api/users/${t}`, { jwt: admin });
  const leaked = ['password', 'resetPasswordToken', 'failedLoginCount', 'loginLockedUntil', 'lastFailedLoginAt', 'resetPasswordTokenExpiresAt', 'tokenValidAfter'].filter((k) => one.json && k in one.json);
  check('GET /users/:id does not expose private fields', one.status === 200 && leaked.length === 0, leaked.join(','));
  const filt = await req('GET', `/api/users?filters[resetPasswordToken][$notNull]=true`, { jwt: admin });
  check('filtering by resetPasswordToken is not an oracle', filt.status === 400 || (Array.isArray(filt.json) && filt.json.length === Number(row(`select count(*) n from up_users`).n)), `${filt.status} ${Array.isArray(filt.json) ? filt.json.length : JSON.stringify(filt.json)}`);
}

// ── 5. Admin password actions
{
  const en = ids['qa-pat-en'];
  for (const [who, jwt] of [['manager', manager], ['patient', patRu], ['anonymous', null]]) {
    const a = await req('POST', `/api/users/${en}/password-reset`, { jwt });
    const b = await req('PUT', `/api/users/${en}/password`, { jwt, body: { password: 'Strong1!pass' } });
    check(`${who} cannot use admin password endpoints`, [401, 403].includes(a.status) && [401, 403].includes(b.status), `${a.status}/${b.status}`);
  }
  const patJwt = (await login('qa-pat-en')).json?.jwt;
  const send = await req('POST', `/api/users/${en}/password-reset`, { jwt: admin });
  check('admin sends reset link -> 200', send.status === 200 && send.json?.email === email('qa-pat-en'), JSON.stringify(send.json));
  await sleep(500);
  const mail = mailsTo('qa-pat-en').at(-1);
  check('link email in English', /Set a new password/.test(mail?.subject || ''), mail?.subject);
  const html = mail ? mail.text.slice(mail.text.indexOf('<!DOCTYPE')) : '';
  check('HTML in the user name is escaped in the email (HTML part)', html && !html.includes('<img src=x') && html.includes('&lt;img'), '');
  const ttlH = (toMs(row(`select reset_password_token_expires_at e from up_users where id=${en}`).e) - Date.now()) / 3600000;
  check('admin link expires in ~24 h', ttlH > 23.5 && ttlH <= 24, ttlH);
  check('old password still works until the link is used', (await login('qa-pat-en')).status === 200);
  check('session survives sending a link', (await req('GET', '/api/users/me', { jwt: patJwt })).status === 200);
  const adminCode = lastCode('qa-pat-en');
  const weak = await req('PUT', `/api/users/${en}/password`, { jwt: admin, body: { password: 'abcdefgh' } });
  check('admin set weak password -> 400', weak.status === 400, weak.status);
  const set = await req('PUT', `/api/users/${en}/password`, { jwt: admin, body: { password: 'AdminSet1!pass' } });
  check('admin sets password -> 200 notified', set.status === 200 && set.json?.notified === true, JSON.stringify(set.json));
  await sleep(500);
  const notice = mailsTo('qa-pat-en').at(-1);
  check('change notice sent, without the password', /changed by an administrator/.test(notice?.subject || '') && !notice.text.includes('AdminSet1!pass'), notice?.subject);
  check('user sessions revoked', (await req('GET', '/api/users/me', { jwt: patJwt })).status === 401);
  check('old password no longer works', (await login('qa-pat-en')).status === 400);
  check('new password works', (await login('qa-pat-en', 'AdminSet1!pass')).status === 200);
  const stale = await req('POST', '/api/auth/reset-password', { body: { code: adminCode, password: 'Other1!pass', passwordConfirmation: 'Other1!pass' } });
  check('admin-set password kills the outstanding reset link', stale.status === 400, stale.status);
  const self = await req('PUT', `/api/users/${ids['qa-admin']}/password`, { jwt: admin, body: { password: 'Strong1!pass' } });
  check('admin cannot set own password here', self.status === 400 && self.json?.error?.message === 'use_profile_for_own_password', JSON.stringify(self.json));
  const blocked = await req('POST', `/api/users/${ids['qa-pat-blocked']}/password-reset`, { jwt: admin });
  check('blocked user: no link', blocked.status === 400 && blocked.json?.error?.message === 'user_blocked', JSON.stringify(blocked.json));
  for (const bad of ['999999', 'abc', '1 OR 1=1', '-1']) {
    const r = await req('POST', `/api/users/${encodeURIComponent(bad)}/password-reset`, { jwt: admin });
    check(`unknown/garbage id "${bad}" -> 404`, r.status === 404, r.status);
  }
  // lockout cleared by admin-set password
  sql(`update up_users set login_locked_until=${ts(Date.now() + 600000)}, failed_login_count=0 where id=${ids['qa-admin2']}`);
  check('admin2 locked', (await login('qa-admin2')).status === 429);
  const unlock = await req('PUT', `/api/users/${ids['qa-admin2']}/password`, { jwt: admin, body: { password: 'Unlock1!pass' } });
  check('admin-set password unlocks the account', unlock.status === 200 && (await login('qa-admin2', 'Unlock1!pass')).status === 200);
  const log = fs.readFileSync(LOG, 'utf8');
  check('PASSWORD_CHANGED via admin logged', log.includes('"audit":"PASSWORD_CHANGED","via":"admin"'));
  check('PASSWORD_RESET_REQUESTED via admin logged', log.includes('"audit":"PASSWORD_RESET_REQUESTED","via":"admin"'));
  check('no test password appears in the server log', !['AdminSet1!pass', 'NewLock1!pass', 'Fresh1!pass', 'Unlock1!pass', PASSWORD].some((p) => log.includes(p)));
}

// ── 6. Profile password change
{
  const u = 'qa-pat-reset';
  const jwt = (await login(u, 'Fresh1!pass')).json?.jwt;
  await req('POST', '/api/auth/forgot-password', { body: { email: email(u) } }); await sleep(300);
  const ch = await req('POST', '/api/auth/change-password', { jwt, body: { currentPassword: 'Fresh1!pass', password: 'Profile1!pass', passwordConfirmation: 'Profile1!pass' } });
  check('profile change-password 200', ch.status === 200 && ch.json?.jwt, ch.status);
  check('profile change clears an outstanding reset link', !row(`select reset_password_token t from up_users where id=${ids[u]}`).t);
  check('old session revoked, new token works', (await req('GET', '/api/users/me', { jwt })).status === 401 && (await req('GET', '/api/users/me', { jwt: ch.json?.jwt })).status === 200);
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
fs.writeFileSync(path.join(QA_DIR, `security-results-${MODE}.json`), JSON.stringify(results, null, 2));
process.exit(failed.length ? 1 : 0);
