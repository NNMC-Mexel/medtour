/**
 * Проверка, что файл можно прикрепить к своей записи.
 *
 * Доступ к файлу выводится из того, к чему он прикреплён: файл медицинского
 * документа виден участникам кейса, вложение чата — участникам беседы. Значит,
 * возможность прикрепить ЧУЖОЙ файл к своей записи равносильна его чтению, а id
 * файлов — последовательные целые, перебор тривиален.
 *
 * Правило: прикреплять можно только «ничей» файл, который загрузил сам
 * пользователь (uploadedByUserId ставит расширение upload), либо файл, уже
 * принадлежащий именно этой записи (повторное сохранение формы).
 */

type AttachOptions = {
  userId: number;
  ownRelatedType?: string;
  ownRelatedIds?: number[];
};

/** Нормализует media-поле запроса (число, строка, {id}, массив) в список id; null — формат не распознан. */
export const toFileIdList = (value: unknown): number[] | null => {
  if (value === null || value === undefined || value === '') return [];
  const raw = Array.isArray(value) ? value : [value];
  const ids = raw.map((item: any) => Number(item && typeof item === 'object' ? item.id : item));
  return ids.every((id) => Number.isSafeInteger(id) && id > 0) ? ids : null;
};

export async function isFileAttachable(
  fileId: number,
  { userId, ownRelatedType, ownRelatedIds = [] }: AttachOptions,
): Promise<boolean> {
  if (!Number.isSafeInteger(fileId) || fileId <= 0 || !userId) return false;

  try {
    const relations = await strapi.db
      .connection('files_related_mph')
      .select('related_id', 'related_type')
      .where('file_id', fileId);

    if (!relations?.length) {
      const file: any = await strapi.db.query('plugin::upload.file').findOne({
        where: { id: fileId },
        select: ['id', 'uploadedByUserId'],
      });
      return Boolean(file && Number(file.uploadedByUserId) === Number(userId));
    }

    return relations.every((relation: any) =>
      relation.related_type === ownRelatedType && ownRelatedIds.includes(Number(relation.related_id)));
  } catch (error: any) {
    strapi.log.error(`isFileAttachable failed for file ${fileId}: ${error?.message}`);
    return false;
  }
}

/** true, если все файлы из media-поля можно прикрепить. Пустое поле (отвязка) разрешено. */
export async function areFilesAttachable(value: unknown, options: AttachOptions): Promise<boolean> {
  const ids = toFileIdList(value);
  if (ids === null) return false;
  for (const id of ids) {
    if (!(await isFileAttachable(id, options))) return false;
  }
  return true;
}

/** Все строки записи (draft + published) — у них разные числовые id, и файл может быть связан с любой. */
export async function getRowIdsForDocument(uid: string, documentId: string | null | undefined): Promise<number[]> {
  if (!documentId) return [];
  const rows = await strapi.db.query(uid as any).findMany({ where: { documentId }, select: ['id'] });
  return rows.map((row: any) => Number(row.id));
}
