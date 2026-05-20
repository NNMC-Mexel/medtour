import { getUserRole, isAdminUser, userCanAccessMedicalCase } from '../utils/medtour-access';

/**
 * Allows legacy explicit conversation members and case-first authorized users.
 */
export default async (policyContext, config, { strapi }) => {
  const user = policyContext.state?.user;
  if (!user) return false;
  if (isAdminUser(user)) return true;

  const ref = policyContext.params?.id;
  if (!ref) return true;

  const asNumber = Number(ref);
  const conversation = Number.isInteger(asNumber) && String(asNumber) === String(ref)
    ? await strapi.query('api::conversation.conversation').findOne({
        where: { id: asNumber },
        populate: {
          users_permissions_users: { fields: ['id'] },
          medical_case: true,
        },
      })
    : await strapi.documents('api::conversation.conversation').findOne({
        documentId: String(ref),
        populate: {
          users_permissions_users: { fields: ['id'] },
          medical_case: true,
        },
      });

  if (!conversation) return false;

  const members = conversation.users_permissions_users || [];
  if (members.some((member: any) => member.id === user.id)) return true;

  if (!conversation.medical_case) return false;
  if (getUserRole(user) === 'doctor' && conversation.doctorChatEnabled !== true) return false;
  return userCanAccessMedicalCase(strapi, user, conversation.medical_case);
};
