/**
 * Врач может вести приём по нескольким специальностям (терапевт + кардиолог).
 *
 * Историческое поле `specialization` (manyToOne) остаётся «основным»: на нём
 * держатся карточки, письма, фильтры каталога и старые записи в БД. Новое поле
 * `specializations` (manyToMany) хранит полный список. Обе стороны синхронны:
 * первый элемент списка всегда равен основной специализации, а список никогда
 * не бывает пустым, если основная задана.
 */

type AnyRecord = Record<string, any>;

const toId = (value: any): number | null => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'object') return toId(value.id ?? value.value ?? null);
  const id = Number(value);
  return Number.isFinite(id) && id > 0 ? id : null;
};

/**
 * Приводит любое представление связи к массиву числовых id.
 * Strapi присылает связи как id, как объект сущности, как массив того и другого
 * и как `{ set | connect: [...] }` — форма зависит от клиента.
 */
export const toSpecializationIds = (value: any): number[] => {
  if (value === null || value === undefined) return [];

  let source = value;
  if (!Array.isArray(source) && typeof source === 'object') {
    if (Array.isArray(source.set)) source = source.set;
    else if (Array.isArray(source.connect)) source = source.connect;
    else if (Array.isArray(source.data)) source = source.data;
    else source = [source];
  }
  if (!Array.isArray(source)) source = [source];

  const ids: number[] = [];
  for (const item of source) {
    const id = toId(item);
    if (id !== null && !ids.includes(id)) ids.push(id);
  }
  return ids;
};

/**
 * Держит `specialization` и `specializations` согласованными в теле запроса.
 * Мутирует переданный объект — вызывается на `ctx.request.body.data`.
 */
export const syncSpecializationPayload = (body: AnyRecord) => {
  if (!body || typeof body !== 'object') return body;

  const hasList = 'specializations' in body;
  const hasPrimary = 'specialization' in body;
  if (!hasList && !hasPrimary) return body;

  const listIds = hasList ? toSpecializationIds(body.specializations) : [];
  const primaryId = hasPrimary ? toId(body.specialization) : null;

  // Список — источник истины, если клиент его прислал.
  if (hasList) {
    const ids = primaryId && !listIds.includes(primaryId) ? [primaryId, ...listIds] : listIds;
    body.specializations = ids;
    body.specialization = ids[0] ?? null;
    return body;
  }

  // Совместимость: старый клиент прислал только основную специальность.
  body.specialization = primaryId;
  body.specializations = primaryId ? [primaryId] : [];
  return body;
};

/**
 * Гарантирует непустой `specializations` в ответе.
 *
 * Врачи, заведённые до появления множественных специальностей, хранят только
 * `specialization`. Без этой подстановки их карточки на фронте оказались бы
 * «без специальности» сразу после релиза.
 */
export const withSpecializationList = (doctor: AnyRecord) => {
  if (!doctor || typeof doctor !== 'object') return doctor;

  const list = Array.isArray(doctor.specializations) ? doctor.specializations : [];
  if (list.length > 0) {
    // Основная специальность всегда первой — от неё зависит заголовок карточки.
    const primaryId = toId(doctor.specialization);
    if (!primaryId) return doctor;
    const ordered = [
      ...list.filter((spec: any) => toId(spec) === primaryId),
      ...list.filter((spec: any) => toId(spec) !== primaryId),
    ];
    return { ...doctor, specializations: ordered };
  }

  if (doctor.specialization && typeof doctor.specialization === 'object') {
    return { ...doctor, specializations: [doctor.specialization] };
  }

  return { ...doctor, specializations: [] };
};

/** Все id специальностей врача — для сопоставления с акциями и фильтрами. */
export const doctorSpecializationEntities = (doctor: AnyRecord): any[] => {
  if (!doctor || typeof doctor !== 'object') return [];
  const list = Array.isArray(doctor.specializations) ? doctor.specializations : [];
  const entities = [...list];
  if (doctor.specialization && !entities.some((spec) => toId(spec) === toId(doctor.specialization))) {
    entities.push(doctor.specialization);
  }
  return entities.filter(Boolean);
};
