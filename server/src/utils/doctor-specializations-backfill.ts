import type { Core } from '@strapi/strapi';

const DOCTOR_UID = 'api::doctor.doctor' as any;

/**
 * Переносит единственную специальность врача в список `specializations`.
 *
 * Врачи, заведённые до появления множественных специальностей, хранят связь
 * только в `specialization`. Заполняется только пустой список — набор,
 * собранный администратором, переживает любой перезапуск. Связь ставится на
 * уровне БД (черновая строка ↔ черновая специальность, опубликованная ↔
 * опубликованная): document-service на связях между draft&publish-типами
 * путает id черновика и публикации.
 */
export async function backfillDoctorSpecializations(strapi: Core.Strapi) {
  const rows = await strapi.db.query(DOCTOR_UID).findMany({
    select: ['id', 'documentId', 'publishedAt'],
    populate: { specialization: { select: ['id'] }, specializations: { select: ['id'] } },
    limit: 5000,
  });

  let updated = 0;
  for (const row of rows as any[]) {
    if (Array.isArray(row.specializations) && row.specializations.length > 0) continue;
    const primaryId = row.specialization?.id;
    if (!primaryId) continue;
    await strapi.db.query(DOCTOR_UID).update({
      where: { id: row.id },
      data: { specializations: [primaryId] },
    });
    updated += 1;
  }

  if (updated > 0) strapi.log.info(`[bootstrap] Specialization list installed for ${updated} doctor rows.`);
  return updated;
}

/**
 * Возвращает врачам потерянную основную специальность.
 *
 * Правка специализации в админке публикует её заново: Strapi пересоздаёт
 * опубликованную строку, и обратная связь manyToOne `doctor.specialization`
 * у опубликованных врачей обнуляется (список `specializations` переживает
 * публикацию). Без основной специальности врач выпадал из писем, записей и
 * фильтров по старому полю. Основной снова становится первая из списка —
 * строка к строке: черновик к черновику, публикация к публикации.
 */
export async function repairDoctorPrimarySpecializations(strapi: Core.Strapi) {
  const rows = await strapi.db.query(DOCTOR_UID).findMany({
    select: ['id'],
    where: { specialization: { id: { $null: true } } },
    populate: { specializations: { select: ['id'] } },
    limit: 5000,
  });

  let repaired = 0;
  for (const row of rows as any[]) {
    const firstId = Array.isArray(row.specializations) ? row.specializations[0]?.id : null;
    if (!firstId) continue;
    await strapi.db.query(DOCTOR_UID).update({ where: { id: row.id }, data: { specialization: firstId } });
    repaired += 1;
  }

  if (repaired > 0) strapi.log.info(`[specializations] Primary specialization restored for ${repaired} doctor rows.`);
  return repaired;
}
