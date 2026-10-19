'use strict';

/**
 * Перенос врачей MedConnect → MedTour через REST API обеих платформ.
 *
 * Скрипт запускается с ноутбука и не требует доступа к базам и MinIO: читает
 * врачей из MedConnect под админом и создаёт их в MedTour под админом, так что
 * срабатывают все проверки контроллеров MedTour, как при ручном вводе.
 *
 * Что переносится: ФИО, специальности, стаж, описание, образование, лицензия,
 * должность, клиника, языки, переводы и фото. Цены, рейтинг, отзывы, аккаунты,
 * расписания и сертификаты не переносятся.
 *
 * Новые врачи видны сразу. Скрытыми создаются те, кто скрыт в MedConnect, и
 * те, у кого нет номера лицензии: MedTour не даёт включить врача без неё.
 *
 * Врачи, уже заведённые в MedTour (совпадение по ФИО), не перезаписываются:
 * им дописываются только пустые поля. Повторный запуск ничего не дублирует.
 *
 *   MEDCONNECT_URL=https://… MEDCONNECT_EMAIL=… MEDCONNECT_PASSWORD=… \
 *   MEDTOUR_URL=https://…    MEDTOUR_EMAIL=…    MEDTOUR_PASSWORD=… \
 *   npm run import:medconnect-doctors:dry
 *
 * Вместо логина и пароля можно передать готовый JWT: MEDCONNECT_TOKEN / MEDTOUR_TOKEN.
 */

const path = require('node:path');
const { pathToFileURL } = require('node:url');

const TRANSLATED_FIELDS = ['fullName', 'education', 'bio'];
const TEXT_FIELDS = ['bio', 'education', 'licenseNumber', 'position'];
const PHOTO_TYPES = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};
const PAGE_SIZE = 100;

const normalizeName = (value) => String(value || '')
  .toLocaleLowerCase('ru')
  .replace(/ё/g, 'е')
  .replace(/\s+/g, ' ')
  .trim();

const isBlank = (value) => (
  value === null
  || value === undefined
  || (typeof value === 'string' && value.trim() === '')
  || (Array.isArray(value) && value.length === 0)
);

const text = (value) => (typeof value === 'string' ? value.trim() : '');

// MedConnect хранит клинику списком nnmc/umit; у старых карточек её нет,
// тогда остаётся только текст «места работы».
function sourceClinicType(doctor) {
  if (doctor.clinic === 'nnmc' || doctor.clinic === 'umit') return doctor.clinic;
  const workplace = normalizeName(doctor.workplace);
  if (/умит|umit|томотерап/.test(workplace)) return 'umit';
  if (/ннмц|nnmc|национальн/.test(workplace)) return 'nnmc';
  return null;
}

function sourceSpecializations(doctor) {
  const list = Array.isArray(doctor.specializations) && doctor.specializations.length > 0
    ? doctor.specializations
    : [doctor.specialization];
  const seen = new Set();
  return list.filter((item) => {
    const key = normalizeName(item?.name);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Только переводимые поля карточки и только непустые строки.
function pickI18n(i18n) {
  const result = {};
  if (!i18n || typeof i18n !== 'object' || Array.isArray(i18n)) return result;
  for (const [locale, entry] of Object.entries(i18n)) {
    if (!entry || typeof entry !== 'object') continue;
    const next = {};
    for (const field of TRANSLATED_FIELDS) {
      if (text(entry[field])) next[field] = text(entry[field]);
    }
    if (Object.keys(next).length > 0) result[locale] = next;
  }
  return result;
}

// Дописывает только отсутствующие переводы; null — если добавить нечего.
function mergeMissingI18n(target, source) {
  const merged = JSON.parse(JSON.stringify(target && typeof target === 'object' ? target : {}));
  let changed = false;
  for (const [locale, entry] of Object.entries(source)) {
    for (const [field, value] of Object.entries(entry)) {
      if (text(merged[locale]?.[field])) continue;
      merged[locale] = { ...(merged[locale] || {}), [field]: value };
      changed = true;
    }
  }
  return changed ? merged : null;
}

// Отделения — тем же правилом, по которому их подбирает сайт. Считаем как для
// активного врача: скрытому они понадобятся, когда его включат.
function departmentsFor(specializations, departments, belongsToDepartment) {
  return departments
    .filter((department) => belongsToDepartment({ isActive: true, specializations }, department))
    .map((department) => department.slug);
}

/**
 * Строит план переноса без побочных эффектов: его печатает --dry-run, и его же
 * исполняет apply.
 */
function planImport({ sourceDoctors, targetDoctors, targetSpecializations, clinics, departments, belongsToDepartment }) {
  const plan = { create: [], fill: [], unchanged: [], skipped: [], newSpecializations: [] };

  const specializationsByName = new Map();
  for (const item of targetSpecializations) {
    const key = normalizeName(item.name);
    if (key && !specializationsByName.has(key)) specializationsByName.set(key, item);
  }
  const newSpecializations = new Map();
  const resolveSpecialization = (source) => {
    const key = normalizeName(source.name);
    if (specializationsByName.has(key)) return { key, existing: specializationsByName.get(key) };
    if (!newSpecializations.has(key)) {
      newSpecializations.set(key, {
        key,
        data: {
          name: text(source.name),
          nameEn: text(source.nameEn) || null,
          nameKk: text(source.nameKk) || null,
          description: text(source.description) || null,
          icon: text(source.icon) || null,
          i18n: source.i18n && typeof source.i18n === 'object' ? source.i18n : null,
        },
      });
    }
    return { key, created: newSpecializations.get(key).data };
  };

  const clinicsByType = new Map(clinics.map((clinic) => [clinic.clinicType, clinic]));

  const targetsByName = new Map();
  for (const doctor of targetDoctors) {
    const key = normalizeName(doctor.fullName);
    if (!key) continue;
    targetsByName.set(key, [...(targetsByName.get(key) || []), doctor]);
  }

  const seenSource = new Set();
  for (const source of sourceDoctors) {
    const fullName = text(source.fullName);
    const key = normalizeName(fullName);
    if (!key) {
      plan.skipped.push({ fullName: '(без ФИО)', reason: `MedConnect id ${source.documentId}: пустое ФИО` });
      continue;
    }
    if (seenSource.has(key)) {
      plan.skipped.push({ fullName, reason: 'в MedConnect несколько врачей с таким ФИО — перенесён первый' });
      continue;
    }
    seenSource.add(key);

    const specializations = sourceSpecializations(source).map(resolveSpecialization);
    const clinicType = sourceClinicType(source);
    const clinic = clinicType ? clinicsByType.get(clinicType) || null : null;
    const i18n = pickI18n(source.i18n);
    const languages = Array.isArray(source.languages) ? source.languages : [];
    const experience = Number.isInteger(source.experience) && source.experience > 0 ? source.experience : null;
    const photo = source.photo?.url ? source.photo : null;
    const notes = [];
    if (!clinic) notes.push(clinicType ? `в MedTour нет клиники ${clinicType}` : 'клиника не определена');
    // MedTour не даёт сделать активным врача без лицензии (lifecycles.ts).
    const hasLicense = Boolean(text(source.licenseNumber));

    const matches = targetsByName.get(key) || [];
    if (matches.length > 1) {
      plan.skipped.push({ fullName, reason: `в MedTour ${matches.length} врача с таким ФИО — разберите вручную` });
      continue;
    }

    if (matches.length === 0) {
      const treatmentDepartments = departmentsFor(specializations.map((item) => item.existing || item.created), departments, belongsToDepartment);
      // Скрытый в MedConnect остаётся скрытым и в MedTour.
      const hiddenInSource = source.isActive === false;
      if (hiddenInSource) notes.push('СКРЫТ: скрыт в MedConnect');
      else if (!hasLicense) notes.push('СКРЫТ: нет номера лицензии — впишите его и включите врача');
      plan.create.push({
        fullName,
        notes,
        specializationKeys: specializations.map((item) => item.key),
        photo,
        data: {
          fullName,
          treatmentDepartments,
          experience: experience ?? 0,
          ...Object.fromEntries(TEXT_FIELDS.map((field) => [field, text(source[field])])),
          workplace: clinic?.name || text(source.workplace),
          clinic: clinic?.documentId || null,
          languages,
          i18n,
          isActive: !hiddenInSource && hasLicense,
        },
      });
      continue;
    }

    // Уже есть в MedTour: дописываем только пустые поля, остальное не трогаем.
    const target = matches[0];
    const data = {};
    for (const field of TEXT_FIELDS) {
      if (isBlank(target[field]) && text(source[field])) data[field] = text(source[field]);
    }
    if (!target.experience && experience) data.experience = experience;
    if (isBlank(target.languages) && languages.length > 0) data.languages = languages;
    const i18nPatch = mergeMissingI18n(target.i18n, i18n);
    if (i18nPatch) data.i18n = i18nPatch;
    if (!target.clinic && clinic) {
      data.clinic = clinic.documentId;
      if (isBlank(target.workplace)) data.workplace = clinic.name;
    }
    const targetHasSpecializations = (target.specializations?.length || 0) > 0 || Boolean(target.specialization);
    const specializationKeys = !targetHasSpecializations ? specializations.map((item) => item.key) : [];
    const fillPhoto = !target.photo && photo ? photo : null;

    const fields = [...Object.keys(data), ...(specializationKeys.length ? ['specializations'] : []), ...(fillPhoto ? ['photo'] : [])];
    if (fields.length === 0) {
      plan.unchanged.push({ fullName });
      continue;
    }
    plan.fill.push({ fullName, documentId: target.documentId, fields, specializationKeys, photo: fillPhoto, data });
  }

  // Специальности создаём только для тех врачей, которых действительно меняем.
  const used = new Set([...plan.create, ...plan.fill].flatMap((item) => item.specializationKeys));
  plan.newSpecializations = [...newSpecializations.values()].filter((item) => used.has(item.key));
  return plan;
}

function formatPlan(plan) {
  const lines = [];
  lines.push(`Новых врачей: ${plan.create.length}`);
  for (const item of plan.create) {
    const extra = [
      item.photo ? 'с фото' : 'без фото',
      item.data.treatmentDepartments.length ? `отделения: ${item.data.treatmentDepartments.join(', ')}` : 'без отделений',
      ...item.notes,
    ];
    lines.push(`  + ${item.fullName} (${extra.join('; ')})`);
  }
  lines.push(`Уже есть в MedTour, дописываем пустые поля: ${plan.fill.length}`);
  for (const item of plan.fill) lines.push(`  ~ ${item.fullName}: ${item.fields.join(', ')}`);
  lines.push(`Уже есть в MedTour, менять нечего: ${plan.unchanged.length}`);
  for (const item of plan.unchanged) lines.push(`  = ${item.fullName}`);
  lines.push(`Пропущено: ${plan.skipped.length}`);
  for (const item of plan.skipped) lines.push(`  ! ${item.fullName}: ${item.reason}`);
  lines.push(`Новых специальностей: ${plan.newSpecializations.length}`);
  for (const item of plan.newSpecializations) lines.push(`  + ${item.data.name}`);
  return lines.join('\n');
}

// ---------------------------------------------------------------- HTTP

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function createClient(label, baseUrl) {
  const origin = String(baseUrl || '').replace(/\/+$/, '');
  let token = null;

  async function request(method, urlPath, { json, form, raw = false } = {}) {
    const url = new URL(urlPath, `${origin}/`);
    for (let attempt = 0; ; attempt++) {
      const headers = {};
      // Токен — только своему серверу, даже если ссылка на фото ведёт на хранилище.
      if (token && url.origin === new URL(origin).origin) headers.Authorization = `Bearer ${token}`;
      if (json !== undefined) headers['Content-Type'] = 'application/json';
      const response = await fetch(url, {
        method,
        headers,
        body: json !== undefined ? JSON.stringify(json) : form,
      });
      // Лимиты MedTour (например, 60 загрузок за 15 минут) — ждём и повторяем.
      if (response.status === 429 && attempt < 3) {
        const wait = Math.max(Number(response.headers.get('retry-after')) || 60, 5);
        console.log(`  ${label}: лимит запросов, жду ${wait} с…`);
        await sleep(wait * 1000);
        continue;
      }
      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`${label} ${method} ${url.pathname} → ${response.status} ${body.slice(0, 300)}`);
      }
      if (raw) return response;
      return response.status === 204 ? null : response.json();
    }
  }

  return {
    origin,
    request,
    async login({ token: presetToken, identifier, password }) {
      if (presetToken) {
        token = presetToken;
      } else {
        if (!identifier || !password) throw new Error(`${label}: нужен логин и пароль администратора или токен`);
        token = (await request('POST', '/api/auth/local', { json: { identifier, password } })).jwt;
      }
      const me = await request('GET', '/api/users/me?populate=role');
      return me?.userRole || me?.role?.type || null;
    },
    async findAll(urlPath, query = '') {
      const items = [];
      for (let page = 1; ; page++) {
        const separator = query ? '&' : '';
        const response = await request('GET', `${urlPath}?${query}${separator}pagination[page]=${page}&pagination[pageSize]=${PAGE_SIZE}`);
        items.push(...(response.data || []));
        const pageCount = response.meta?.pagination?.pageCount || 1;
        if (page >= pageCount) return items;
      }
    },
  };
}

async function loadDepartments(medtour) {
  const modulePath = path.resolve(__dirname, '../../frontend/src/data/treatmentDepartments.js');
  const { mergeTreatmentDepartments, doctorBelongsToTreatmentDepartment } = await import(pathToFileURL(modulePath).href);
  let cmsDepartments = [];
  try {
    cmsDepartments = (await medtour.request('GET', '/api/global')).data?.treatmentDepartments || [];
  } catch (error) {
    console.log(`  Не удалось прочитать отделения из CMS, беру список по умолчанию: ${error.message}`);
  }
  const departments = mergeTreatmentDepartments(cmsDepartments).filter((department) => department.isActive !== false);
  return { departments, belongsToDepartment: doctorBelongsToTreatmentDepartment };
}

async function transferPhoto(medconnect, medtour, photo, fullName) {
  const response = await medconnect.request('GET', new URL(photo.url, `${medconnect.origin}/`).href, { raw: true });
  const mime = String(response.headers.get('content-type') || photo.mime || '').split(';')[0].trim();
  const extension = PHOTO_TYPES[mime];
  if (!extension) throw new Error(`фото в формате ${mime || 'неизвестно'} не поддерживается`);
  const form = new FormData();
  const fileName = `${fullName.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'doctor'}${extension}`;
  form.append('files', new Blob([await response.arrayBuffer()], { type: mime }), fileName);
  const [uploaded] = await medtour.request('POST', '/api/upload', { form });
  return uploaded.id;
}

async function applyPlan(plan, { medconnect, medtour }) {
  const result = { created: 0, filled: 0, specializations: 0, errors: [] };
  const specializationIds = new Map();
  const existing = await medtour.findAll('/api/specializations');
  for (const item of existing) {
    const key = normalizeName(item.name);
    if (key && !specializationIds.has(key)) specializationIds.set(key, item.id);
  }
  for (const item of plan.newSpecializations) {
    const created = await medtour.request('POST', '/api/specializations', { json: { data: item.data } });
    specializationIds.set(item.key, created.data.id);
    result.specializations++;
    console.log(`  специальность создана: ${item.data.name}`);
  }
  const specializationPayload = (keys) => {
    const ids = keys.map((key) => specializationIds.get(key)).filter(Boolean);
    return ids.length ? { specialization: ids[0], specializations: ids } : {};
  };

  for (const item of [...plan.create.map((entry) => ({ ...entry, mode: 'create' })), ...plan.fill.map((entry) => ({ ...entry, mode: 'fill' }))]) {
    let photoId = null;
    try {
      if (item.photo) {
        try {
          photoId = await transferPhoto(medconnect, medtour, item.photo, item.fullName);
        } catch (error) {
          result.errors.push(`${item.fullName}: фото не перенесено — ${error.message}`);
        }
      }
      const data = { ...item.data, ...specializationPayload(item.specializationKeys), ...(photoId ? { photo: photoId } : {}) };
      if (Object.keys(data).length === 0) continue;
      if (item.mode === 'create') {
        await medtour.request('POST', '/api/doctors', { json: { data } });
        result.created++;
        console.log(`  создан: ${item.fullName}`);
      } else {
        await medtour.request('PUT', `/api/doctors/${item.documentId}`, { json: { data } });
        result.filled++;
        console.log(`  дополнен: ${item.fullName}`);
      }
    } catch (error) {
      result.errors.push(`${item.fullName}: ${error.message}`);
      // Карточка не сохранилась — фото без владельца не оставляем.
      if (photoId) await medtour.request('DELETE', `/api/upload/files/${photoId}`).catch(() => {});
    }
  }
  return result;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const env = process.env;
  for (const name of ['MEDCONNECT_URL', 'MEDTOUR_URL']) {
    if (!env[name]) throw new Error(`Не задан ${name}`);
  }

  const medconnect = createClient('MedConnect', env.MEDCONNECT_URL);
  const medtour = createClient('MedTour', env.MEDTOUR_URL);
  const medconnectRole = await medconnect.login({ token: env.MEDCONNECT_TOKEN, identifier: env.MEDCONNECT_EMAIL, password: env.MEDCONNECT_PASSWORD });
  // Не-админ MedConnect видит только активных врачей — перенос был бы неполным.
  if (!['admin', 'content_manager'].includes(medconnectRole)) throw new Error(`MedConnect: нужен администратор, а роль — ${medconnectRole}`);
  const medtourRole = await medtour.login({ token: env.MEDTOUR_TOKEN, identifier: env.MEDTOUR_EMAIL, password: env.MEDTOUR_PASSWORD });
  if (medtourRole !== 'admin') throw new Error(`MedTour: нужен администратор, а роль — ${medtourRole}`);

  console.log('Читаю данные…');
  const doctorPopulate = 'populate[specialization]=true&populate[specializations]=true&populate[photo]=true';
  const [sourceDoctors, targetDoctors, targetSpecializations, clinics, { departments, belongsToDepartment }] = await Promise.all([
    medconnect.findAll('/api/doctors', `${doctorPopulate}&sort=fullName:asc`),
    medtour.findAll('/api/doctors', `${doctorPopulate}&populate[clinic]=true`),
    medtour.findAll('/api/specializations'),
    medtour.findAll('/api/clinics'),
    loadDepartments(medtour),
  ]);
  console.log(`MedConnect: ${sourceDoctors.length} врачей. MedTour: ${targetDoctors.length} врачей, ${clinics.length} клиник.\n`);

  const plan = planImport({ sourceDoctors, targetDoctors, targetSpecializations, clinics, departments, belongsToDepartment });
  console.log(formatPlan(plan));

  if (dryRun) {
    console.log('\nПробный запуск: в MedTour ничего не записано.');
    return;
  }
  console.log('\nПереношу…');
  const result = await applyPlan(plan, { medconnect, medtour });
  console.log(`\nГотово: создано ${result.created}, дополнено ${result.filled}, новых специальностей ${result.specializations}.`);
  if (result.errors.length) {
    console.log(`Ошибки (${result.errors.length}):`);
    for (const error of result.errors) console.log(`  ! ${error}`);
    process.exitCode = 1;
  }
}

module.exports = { normalizeName, sourceClinicType, pickI18n, mergeMissingI18n, planImport, formatPlan };

if (require.main === module) {
  main().catch((error) => { console.error(error.message || error); process.exit(1); });
}
