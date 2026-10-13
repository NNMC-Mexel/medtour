// Doctor certificates: API checks on a fresh stand (stand.sh sqlite|pg). Synthetic data only.
import fs from 'node:fs'
import path from 'node:path'
const [,, MODE = 'sqlite', QA_DIR = path.dirname(new URL(import.meta.url).pathname)] = process.argv
const API = 'http://127.0.0.1:1351', PASSWORD = 'QaMedtour1!x'
const results = []
const redact = (v) => String(v).replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, '<jwt>')
const check = (id, name, ok, detail = '') => { results.push({ id, name, ok: !!ok, detail: redact(detail).slice(0, 300) }); console.log(`${ok ? 'PASS' : 'FAIL'}  [${id}] ${name}${ok ? '' : '  -> ' + redact(detail).slice(0, 300)}`) }
let ip = 1
const req = async (method, url, { body, jwt, form } = {}) => {
  const headers = { 'X-Forwarded-For': `10.50.0.${ip++ % 250}` }
  if (!form) headers['Content-Type'] = 'application/json'
  if (jwt) headers.Authorization = `Bearer ${jwt}`
  const res = await fetch(API + url, { method, headers, body: form || (body === undefined ? undefined : JSON.stringify(body)) })
  const text = await res.text(); let json = null; try { json = JSON.parse(text) } catch {}
  return { status: res.status, json, text, headers: res.headers }
}
const login = async (u, p = PASSWORD) => (await req('POST', '/api/auth/local', { body: { identifier: `${u}@qa.invalid`, password: p } })).json?.jwt
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<< /Type /Catalog >>endobj\ntrailer<< /Root 1 0 R >>\n%%EOF\n')
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
const JPG = fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), 'sample.jpg'))
const DOCX = Buffer.from('PK\x03\x04qa-not-really-docx')
const uploaded = []
const upload = async (jwt, name, buf, type) => {
  const form = new FormData()
  form.append('files', new Blob([buf], { type }), name)
  const r = await req('POST', '/api/upload', { jwt, form })
  const file = Array.isArray(r.json) ? r.json[0] : null
  if (file?.url) uploaded.push(file.url)
  return { r, file }
}
const pub = async (docId) => (await req('GET', `/api/doctors/${docId}?populate=*`)).json?.data
const certIds = (doc) => (doc?.certificates || []).map((c) => c.id).sort((a, b) => a - b)

const admin = await login('qa-admin')
const patient = await login('qa-pat-ru')
check('S0', 'seed logins', admin && patient)

// Admin creates a doctor account and card with two certificates (the admin form flow)
const userRes = await req('POST', '/api/users', { jwt: admin, body: { username: 'qa-cert-doc', email: 'qa-cert-doc@qa.invalid', password: 'CertDoc1!pass', confirmed: true, blocked: false, userRole: 'doctor', fullName: 'QA Cert Doctor' } })
const doctorUserId = userRes.json?.id
const a1 = await upload(admin, 'license.pdf', PDF, 'application/pdf')
const a2 = await upload(admin, 'diploma.png', PNG, 'image/png')
check('C1', 'admin uploads PDF and PNG', a1.file?.id && a2.file?.id, `${a1.r.status} ${a2.r.status} ${a1.r.text.slice(0, 120)}`)
const created = await req('POST', '/api/doctors?status=published', { jwt: admin, body: { data: { fullName: 'QA Cert Doctor', isActive: true, licenseNumber: 'QA-LIC-1', users_permissions_user: doctorUserId, userId: doctorUserId, certificates: [a1.file.id, a2.file.id] } } })
const docId = created.json?.data?.documentId
check('C2', 'admin creates a doctor with certificates', [200, 201].includes(created.status) && docId, `${created.status} ${created.text.slice(0, 200)}`)
let p = await pub(docId)
check('C3', 'anonymous doctor page lists both certificates (name, mime, url)', certIds(p).length === 2 && p.certificates.every((c) => c.url && c.mime && c.name), JSON.stringify(p?.certificates?.map((c) => [c.name, c.mime])))
const fileRes = await fetch(API + p.certificates.find((c) => c.mime === 'application/pdf').url)
check('C4', 'anonymous can open the PDF certificate file', fileRes.status === 200, fileRes.status)
const listRes = await req('GET', '/api/doctors?populate=*&pagination[limit]=100')
check('C5', 'public doctors list includes certificates', listRes.json?.data?.find((d) => d.documentId === docId)?.certificates?.length === 2)

// The doctor edits own certificates from the profile
const doctor = await login('qa-cert-doc', 'CertDoc1!pass')
const d1 = await upload(doctor, 'course.jpg', JPG, 'image/jpeg')
check('C6', 'doctor uploads a JPEG', d1.file?.id, d1.r.text.slice(0, 120))
const keep = [a1.file.id, a2.file.id, d1.file.id]
const draftOnly = await req('PUT', `/api/doctors/${docId}`, { jwt: doctor, body: { data: { certificates: keep } } })
p = await pub(docId)
check('C7', 'profile save WITHOUT ?status=published reaches the public page', draftOnly.status === 200 && certIds(p).length === 3, `${draftOnly.status} public=${certIds(p).length}`)
const published = await req('PUT', `/api/doctors/${docId}?status=published`, { jwt: doctor, body: { data: { certificates: keep } } })
p = await pub(docId)
check('C8', 'doctor adds own certificate (published save) -> public page shows 3', published.status === 200 && certIds(p).length === 3, `${published.status} public=${certIds(p).length} ${published.text.slice(0, 150)}`)

// Abuse
const foreign = await upload(patient, 'patient-scan.pdf', PDF, 'application/pdf')
const steal = await req('PUT', `/api/doctors/${docId}?status=published`, { jwt: doctor, body: { data: { certificates: [...keep, foreign.file.id] } } })
check('C9', "doctor cannot publish someone else's upload as a certificate", steal.status === 400 && steal.json?.error?.details?.code === 'certificates_not_available', `${steal.status} ${steal.text.slice(0, 150)}`)
const adminSteal = await req('PUT', `/api/doctors/${docId}?status=published`, { jwt: admin, body: { data: { certificates: [...keep, foreign.file.id] } } })
check('C10', "admin cannot publish a patient's upload either", adminSteal.status === 400, adminSteal.status)
const bad = await upload(doctor, 'cv.docx', DOCX, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
if (bad.file?.id) {
  const r = await req('PUT', `/api/doctors/${docId}?status=published`, { jwt: doctor, body: { data: { certificates: [...keep, bad.file.id] } } })
  check('C11', 'DOCX is refused as a certificate (PDF/JPEG/PNG/WebP only)', r.status === 400 && r.json?.error?.details?.code === 'certificates_bad_type', `${r.status} ${r.text.slice(0, 150)}`)
} else check('C11', 'DOCX is refused (already at upload)', bad.r.status >= 400, bad.r.status)
const svg = await upload(doctor, 'x.svg', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), 'image/svg+xml')
check('C12', 'SVG upload refused', !svg.file?.id && svg.r.status >= 400, svg.r.status)
for (const [label, value, code] of [['garbage', 'abc', 'certificates_invalid'], ['duplicates', [a1.file.id, a1.file.id], 'certificates_duplicate'], ['missing id', [999999], 'certificates_not_found'], ['too many', Array.from({ length: 21 }, (_, i) => i + 1), 'certificates_too_many']]) {
  const r = await req('PUT', `/api/doctors/${docId}?status=published`, { jwt: doctor, body: { data: { certificates: value } } })
  check('C13', `invalid list (${label}) -> 400 ${code}`, r.status === 400 && r.json?.error?.details?.code === code, `${r.status} ${r.json?.error?.details?.code}`)
}
check('C14', 'after rejected saves the public list is unchanged', certIds(await pub(docId)).length === 3)

// Other roles
const otherUser = await req('POST', '/api/users', { jwt: admin, body: { username: 'qa-cert-doc2', email: 'qa-cert-doc2@qa.invalid', password: 'CertDoc2!pass', confirmed: true, blocked: false, userRole: 'doctor', fullName: 'QA Other Doctor' } })
await req('POST', '/api/doctors?status=published', { jwt: admin, body: { data: { fullName: 'QA Other Doctor', isActive: true, licenseNumber: 'QA-LIC-2', users_permissions_user: otherUser.json?.id, userId: otherUser.json?.id } } })
const other = await login('qa-cert-doc2', 'CertDoc2!pass')
const o = await req('PUT', `/api/doctors/${docId}?status=published`, { jwt: other, body: { data: { certificates: [] } } })
check('C15', "another doctor cannot change this doctor's certificates", o.status === 403, o.status)
const pt = await req('PUT', `/api/doctors/${docId}?status=published`, { jwt: patient, body: { data: { certificates: [] } } })
check('C16', 'patient cannot change certificates', pt.status === 403, pt.status)
const an = await req('PUT', `/api/doctors/${docId}?status=published`, { body: { data: { certificates: [] } } })
check('C17', 'anonymous cannot change certificates', an.status === 401 || an.status === 403, an.status)

// Removing
const rm = await req('PUT', `/api/doctors/${docId}?status=published`, { jwt: doctor, body: { data: { certificates: [a2.file.id, d1.file.id] } } })
check('C18', 'doctor removes a certificate', rm.status === 200 && certIds(await pub(docId)).length === 2, rm.status)
const re = await req('PUT', `/api/doctors/${docId}?status=published`, { jwt: doctor, body: { data: { certificates: [a1.file.id, a2.file.id, d1.file.id] } } })
check('C19', 'a removed certificate (now unattached) can be re-attached by its uploader only', re.status === 400, `${re.status} (uploaded by admin, re-attach by doctor)`)
const adminEdit = await req('PUT', `/api/doctors/${docId}?status=published`, { jwt: admin, body: { data: { fullName: 'QA Cert Doctor', certificates: [] } } })
check('C20', 'admin clears certificates from the doctor form', adminEdit.status === 200 && certIds(await pub(docId)).length === 0, adminEdit.status)
const restore = await req('PUT', `/api/doctors/${docId}?status=published`, { jwt: admin, body: { data: { certificates: [a1.file.id, a2.file.id] } } })
check('C21', 'admin re-attaches own uploads', restore.status === 200 && certIds(await pub(docId)).length === 2, restore.status)

// Other doctor fields still work for the doctor, price still admin-only
const bio = await req('PUT', `/api/doctors/${docId}?status=published`, { jwt: doctor, body: { data: { bio: 'QA bio', price: 99999 } } })
const after = await pub(docId)
check('C22', 'doctor saves bio; price stays admin-only', bio.status === 200 && after?.bio === 'QA bio' && after?.price !== 99999, `${bio.status} price=${after?.price}`)

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
fs.writeFileSync(path.join(QA_DIR, `cert-api-results-${MODE}.json`), JSON.stringify(results, null, 2))
fs.writeFileSync(path.join(QA_DIR, `uploaded-${MODE}.txt`), uploaded.join('\n'))
process.exitCode = failed.length ? 1 : 0
