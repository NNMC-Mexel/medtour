/**
 * Сертификаты врача: PDF и изображения, публичные — видны всем на странице
 * врача (как фото, файлы раздаёт file-proxy по связи с api::doctor.doctor).
 *
 * Раз файл становится публичным, прикрепить можно только свою свежую загрузку
 * или файл, уже принадлежащий этому врачу (utils/file-attach) — иначе чужой
 * медицинский документ можно было бы опубликовать, указав его id.
 */
import { areFilesAttachable, getRowIdsForDocument, toFileIdList } from './file-attach';

export const MAX_DOCTOR_CERTIFICATES = 20;
export const CERTIFICATE_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

/** Код ошибки или null, если поле certificates можно сохранить. */
export async function validateCertificatesInput(
  strapi: any,
  value: unknown,
  { userId, doctorDocumentId }: { userId: number; doctorDocumentId?: string },
): Promise<string | null> {
  const ids = toFileIdList(value);
  if (ids === null) return 'certificates_invalid';
  if (new Set(ids).size !== ids.length) return 'certificates_duplicate';
  if (ids.length > MAX_DOCTOR_CERTIFICATES) return 'certificates_too_many';
  if (ids.length === 0) return null;

  const files = await strapi.db.query('plugin::upload.file').findMany({
    where: { id: { $in: ids } },
    select: ['id', 'mime'],
  });
  if (files.length !== ids.length) return 'certificates_not_found';
  if (files.some((file: any) => !CERTIFICATE_MIME_TYPES.has(String(file.mime || '').toLowerCase()))) {
    return 'certificates_bad_type';
  }

  const attachable = await areFilesAttachable(ids, {
    userId,
    ownRelatedType: 'api::doctor.doctor',
    ownRelatedIds: await getRowIdsForDocument('api::doctor.doctor', doctorDocumentId),
  });
  return attachable ? null : 'certificates_not_available';
}
