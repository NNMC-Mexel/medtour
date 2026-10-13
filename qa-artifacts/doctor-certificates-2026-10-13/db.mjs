// DB helper for QA suites: same queries against the SQLite or Postgres stand.
import { execFileSync } from 'node:child_process'
const SQLITE = new URL('../../server/.tmp/qa-sec.db', import.meta.url).pathname
const PSQL = '/opt/homebrew/opt/postgresql@16/bin/psql'
export const makeDb = (mode) => {
  const isSelect = (q) => /^\s*select/i.test(q)
  const sql = (q) => {
    if (mode === 'pg') {
      const args = ['-h', '127.0.0.1', '-p', '5544', '-U', 'qa', '-d', 'medtour_qa', '-At', '-c']
      if (!isSelect(q)) { execFileSync(PSQL, [...args, q]); return [] }
      return JSON.parse(execFileSync(PSQL, [...args, `select coalesce(json_agg(qa_row), '[]') from (${q}) qa_row`]).toString().trim())
    }
    const out = execFileSync('sqlite3', ['-json', SQLITE, q]).toString().trim()
    return out ? JSON.parse(out) : []
  }
  // Datetime literal in the stand's own convention: SQLite stores epoch ms,
  // Postgres a timestamp WITHOUT time zone in the server's local zone.
  const ts = (ms) => mode === 'pg' ? `to_timestamp(${ms} / 1000.0)::timestamp` : String(ms)
  return { sql, row: (q) => sql(q)[0] || null, ts }
}
// SQLite keeps datetimes as epoch ms; Postgres returns a naive timestamp in the
// server's local zone, which Date.parse also reads as local time.
export const toMs = (v) => v == null ? NaN : (typeof v === 'number' || /^\d+$/.test(String(v))) ? Number(v) : Date.parse(String(v).replace(' ', 'T'))
