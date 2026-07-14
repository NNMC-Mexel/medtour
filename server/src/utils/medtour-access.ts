export function getUserRole(user: any) {
  return user?.role?.type || user?.userRole;
}

export function isAdminUser(user: any) {
  return getUserRole(user) === 'admin';
}

/**
 * Resolve a Users & Permissions user for manually protected custom routes.
 *
 * Strapi's role matrix rejects newly added controller actions until every
 * deployed role is reconfigured. Custom clinical endpoints instead opt out of
 * that action-level gate and enforce their stricter case/appointment checks in
 * the controller. JWT verification here preserves authentication in that mode.
 */
export async function getAuthenticatedUser(strapi: any, ctx: any) {
  if (ctx.state?.user) return ctx.state.user;

  const authHeader = ctx.request?.headers?.authorization || '';
  const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : undefined;
  if (!token) return null;

  try {
    const payload = await strapi.plugin('users-permissions').service('jwt').verify(token);
    if (!payload?.id) return null;

    return strapi.query('plugin::users-permissions.user').findOne({
      where: { id: payload.id, blocked: false },
      populate: { role: true },
    });
  } catch {
    return null;
  }
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
    // A consultation doctor may differ from the case's primary assigned doctor
    // (legacy data and multi-specialist cases both use this shape). Participation
    // in an appointment linked to the case is therefore also a valid, scoped
    // access path to that case and its medical documents.
    return {
      $or: [
        { doctor: { documentId: doctorDocId } },
        { appointments: { doctor: { documentId: doctorDocId } } },
      ],
    };
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
