/**
 * Policy: is-medical-document-participant
 * Пропускает, если текущий пользователь — владелец документа (patient),
 * доктор, связанный с документом, или staff с доступом к связанному case.
 * Admin role всегда получает доступ.
 */
export default async (policyContext, config, { strapi }) => {
  const user = policyContext.state?.user;
  if (!user) return false;

  // Admin bypass
  if (user.role?.type === 'admin' || user.userRole === 'admin') return true;

  const documentId = policyContext.params?.id;
  if (!documentId) return true;

  const medDoc = await strapi.documents('api::medical-document.medical-document').findOne({
    documentId,
    populate: {
      user: { fields: ['id'] },
      doctor: { populate: { users_permissions_user: { fields: ['id'] } } },
      medical_case: {
        populate: {
          manager: { fields: ['id'] },
          coordinator: { fields: ['id'] },
          doctor: { populate: { users_permissions_user: { fields: ['id'] } } },
        },
      },
    },
  });

  if (!medDoc) return false;

  // Пациент — владелец документа
  if (medDoc.user?.id === user.id) return true;

  // Доктор, привязанный к документу
  if (medDoc.doctor?.users_permissions_user?.id === user.id) return true;

  const role = user.role?.type || user.userRole;
  const medicalCase = medDoc.medical_case;
  if (role === 'manager' && medicalCase && (!medicalCase.manager || medicalCase.manager?.id === user.id)) return true;
  if (role === 'coordinator' && medicalCase && (!medicalCase.coordinator || medicalCase.coordinator?.id === user.id)) return true;
  if (role === 'doctor' && medicalCase?.doctor?.users_permissions_user?.id === user.id) return true;

  return false;
};
