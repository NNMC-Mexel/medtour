export function getUserRole(user: any) {
  return user?.role?.type || user?.userRole;
}

export function isAdminUser(user: any) {
  return getUserRole(user) === 'admin';
}

export async function getDoctorDocumentId(strapi: any, user: any) {
  const doctor = await strapi.query('api::doctor.doctor').findOne({
    where: { users_permissions_user: user.id },
  });
  return doctor?.documentId;
}

export async function getMedicalCaseAccessFilter(strapi: any, user: any) {
  const role = getUserRole(user);

  if (role === 'admin') return {};
  if (role === 'patient') return { patient: { documentId: user.documentId } };
  if (role === 'manager') {
    return {
      $or: [
        { manager: { documentId: user.documentId } },
        { manager: { id: { $null: true } } },
      ],
    };
  }
  if (role === 'coordinator') {
    return {
      $or: [
        { coordinator: { documentId: user.documentId } },
        { coordinator: { id: { $null: true } } },
      ],
    };
  }

  if (role === 'doctor') {
    const doctorDocId = await getDoctorDocumentId(strapi, user);
    if (!doctorDocId) return null;
    return { doctor: { documentId: doctorDocId } };
  }

  return null;
}

export async function userCanAccessMedicalCase(strapi: any, user: any, caseRef: any) {
  if (!user || !caseRef) return false;
  if (isAdminUser(user)) return true;

  const documentId = typeof caseRef === 'string'
    ? caseRef
    : caseRef.documentId || caseRef.id;

  if (!documentId) return false;

  const accessFilter = await getMedicalCaseAccessFilter(strapi, user);
  if (accessFilter === null) return false;

  const matches = await strapi.documents('api::medical-case.medical-case' as any).findMany({
    filters: { documentId, ...accessFilter },
    limit: 1,
  });

  return matches.length > 0;
}
