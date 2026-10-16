// QA на PostgreSQL 16 (как на проде): чистая база → сервер сам создаёт документы,
// тексты целы на 4 языках, правка админа сохраняется и переживает перезапуск.
//   API=http://localhost:1351 PSQL=… node pg-api.mjs [after-restart]
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const QA_DIR = path.dirname(new URL(import.meta.url).pathname)
const ROOT = path.resolve(QA_DIR, '../..')
const API = process.env.API || 'http://localhost:1351'
const PSQL = process.env.PSQL || '/opt/homebrew/opt/postgresql@16/bin/psql'
const AFTER_RESTART = process.argv[2] === 'after-restart'
const SEEDS = Object.fromEntries(['offer', 'consent'].map((slug) => [slug, JSON.parse(fs.readFileSync(path.join(ROOT, `server/src/api/legal-document/seed/${slug}.json`), 'utf8'))]))
const sql = (q) => execFileSync(PSQL, ['-h', '127.0.0.1', '-p', '5544', '-U', 'qa', '-d', 'medtour_qa', '-tAc', q], { encoding: 'utf8' }).trim()
const MARK = 'QA-PG: правка администратора'
const EMAIL = 'qa_pg_admin@test.kz'

const results = []
const check = (id, name, ok, detail = '') => {
  results.push({ id, name, ok: !!ok, detail: String(detail).slice(0, 300) })
  console.log(`${ok ? 'PASS' : 'FAIL'}  [${id}] ${name}${ok ? '' : '  -> ' + detail}`)
}
const req = async (method, url, { body, jwt } = {}) => {
  const headers = { 'Content-Type': 'application/json', ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}) }
  const res = await fetch(API + url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  const text = await res.text(); let json = null; try { json = JSON.parse(text) } catch { /* empty */ }
  return { status: res.status, json }
}

check('pg.count', 'в таблице legal_documents ровно два документа', sql('select count(*) from legal_documents') === '2', sql('select string_agg(slug, \',\') from legal_documents'))
check('pg.jsonb', 'body хранится как jsonb', sql("select data_type from information_schema.columns where table_name='legal_documents' and column_name='body'") === 'jsonb', '')

for (const slug of ['offer', 'consent']) {
  for (const lang of ['ru', 'kk', 'en', 'zh']) {
    const r = await req('GET', `/api/legal-documents/${slug}?lang=${lang}`)
    const expected = AFTER_RESTART && slug === 'offer' && lang === 'ru' ? `${SEEDS.offer.body.ru}\n${MARK}` : SEEDS[slug].body[lang]
    check(`pg.get.${slug}.${lang}`, `${slug}/${lang}: текст совпадает посимвольно`, r.status === 200 && r.json.data.body === expected, `${r.status} ${r.json?.data?.body?.length} vs ${expected.length}`)
  }
}

if (!AFTER_RESTART) {
  await req('POST', '/api/auth/local/register', { body: { username: 'qa_pg_admin', email: EMAIL, password: 'QaTest123!', fullName: 'QA PG Admin', phone: '+77009998877' } })
  sql(`update up_users set confirmed=true, user_role='admin' where email='${EMAIL}'`)
  sql(`update up_users_role_lnk set role_id=(select id from up_roles where type='admin') where user_id=(select id from up_users where email='${EMAIL}')`)
  const jwt = (await req('POST', '/api/auth/local', { body: { identifier: EMAIL, password: 'QaTest123!' } })).json?.jwt
  const edit = await req('GET', '/api/legal-documents/offer/edit', { jwt })
  const put = await req('PUT', '/api/legal-documents/offer', { jwt, body: { data: { expectedUpdatedAt: edit.json?.data?.updatedAt, body: { ru: `${SEEDS.offer.body.ru}\n${MARK}` } } } })
  check('pg.put', 'админ сохраняет правку (expectedUpdatedAt из jsonb/timestamp совпадает)', put.status === 200 && put.json.data.body.ru.endsWith(MARK), `${edit.status}/${put.status}`)
  const conflict = await req('PUT', '/api/legal-documents/offer', { jwt, body: { data: { expectedUpdatedAt: edit.json?.data?.updatedAt, revisionDate: '2026-12-01' } } })
  check('pg.conflict', 'повторная правка со старым updatedAt → 409', conflict.status === 409, conflict.status)
}

const out = path.join(QA_DIR, `pg-api-results${AFTER_RESTART ? '-after-restart' : ''}.json`)
fs.writeFileSync(out, JSON.stringify(results, null, 1))
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} passed`)
