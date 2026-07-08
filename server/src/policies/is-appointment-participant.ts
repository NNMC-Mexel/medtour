/**
 * Policy: is-appointment-participant
 * Пропускает, если текущий пользователь — пациент ИЛИ доктор данного appointment.
 * Admin role всегда получает доступ.
 */
import { userCanAccessMedicalCase } from '../utils/medtour-access';

function sameId(a: unknown, b: unknown) {
  return a != null && b != null && String(a) === String(b);
}

export default async (policyContext, config, { strapi }) => {
  const user = policyContext.state?.user;
  if (!user) return false;

  // Admin bypass
  if (user.role?.type === 'admin' || user.userRole === 'admin') return true;

  const documentId = policyContext.params?.id;
  if (!documentId) return true; // list-запросы фильтруются в controller

  const appointment = await strapi.documents('api::appointment.appointment').findOne({
    documentId,
    populate: {
      patient: { fields: ['id'] },
      doctor: { fields: ['userId'], populate: { users_permissions_user: { fields: ['id'] } } },
      medical_case: { fields: ['id', 'documentId'] },
    },
  });

  if (!appointment) return false;

  // Проверяем: текущий user = patient?
  if (appointment.patient?.id === user.id) return true;

  // Проверяем новую связь и legacy userId, чтобы старые профили врачей
  // не теряли доступ к уже созданным видеоконсультациям.
  if (
    sameId(appointment.doctor?.users_permissions_user?.id, user.id) ||
    sameId(appointment.doctor?.userId, user.id)
  ) {
    return true;
  }

  const role = user.role?.type || user.userRole;
  if (['manager', 'coordinator'].includes(role) && appointment.medical_case) {
    return userCanAccessMedicalCase(strapi, user, appointment.medical_case);
  }

  return false;
};
