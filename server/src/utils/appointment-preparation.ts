/**
 * Подготовка пациента к консультации — в терминах кейса MedTour.
 *
 * Документы пациента живут в медицинском кейсе. Врачу перед приёмом важно
 * видеть, есть ли они вообще, а пациенту — получить напоминание загрузить
 * их заранее. Заключения врача (type = certificate) документами пациента
 * не считаются.
 */

export type AppointmentPreparation = {
  documentsCount: number;
  status: 'documents_uploaded' | 'documents_missing' | 'no_case';
};

const DOCUMENT_UID = 'api::medical-document.medical-document' as any;

/** documentId кейса → число опубликованных документов пациента в нём. */
export async function countPatientDocumentsByCase(strapi: any, caseDocumentIds: string[]) {
  const counts = new Map<string, number>();
  const ids = [...new Set(caseDocumentIds.filter(Boolean))];
  if (ids.length === 0) return counts;

  // Draft and published rows are separate in the DB: count published only.
  const rows = await strapi.db.query(DOCUMENT_UID).findMany({
    where: {
      medical_case: { documentId: { $in: ids } },
      type: { $ne: 'certificate' },
      publishedAt: { $notNull: true },
    },
    select: ['id'],
    populate: { medical_case: { select: ['documentId'] } },
  });
  for (const row of rows as any[]) {
    const caseId = row.medical_case?.documentId;
    if (caseId) counts.set(caseId, (counts.get(caseId) || 0) + 1);
  }
  return counts;
}

export const preparationFor = (caseDocumentId: string | undefined, counts: Map<string, number>): AppointmentPreparation => {
  if (!caseDocumentId) return { documentsCount: 0, status: 'no_case' };
  const documentsCount = counts.get(caseDocumentId) || 0;
  return { documentsCount, status: documentsCount > 0 ? 'documents_uploaded' : 'documents_missing' };
};

/** Добавляет `preparation` к каждой записи списка (одним запросом на весь список). */
export async function withPreparation(strapi: any, appointments: any[]) {
  const counts = await countPatientDocumentsByCase(
    strapi,
    appointments.map((appointment) => appointment?.medical_case?.documentId),
  );
  return appointments.map((appointment) => ({
    ...appointment,
    preparation: preparationFor(appointment?.medical_case?.documentId, counts),
  }));
}
