/**
 * Message lifecycle hooks.
 * afterCreate: создаёт уведомление для всех участников беседы, кроме отправителя.
 */

export default {
  async afterCreate(event) {
    const { result } = event;
    const documentId = result?.documentId;
    if (!documentId) return;

    try {
      const msg = await strapi.documents('api::message.message').findOne({
        documentId: String(documentId),
        populate: {
          sender: { fields: ['id', 'fullName'] },
          conversation: {
            populate: {
              users_permissions_users: { fields: ['id'], populate: { role: { fields: ['type'] } } },
              activeManager: { fields: ['id', 'userRole'], populate: { role: { fields: ['type'] } } },
              medical_case: {
                populate: {
                  patient: { fields: ['id', 'userRole'], populate: { role: { fields: ['type'] } } },
                  manager: { fields: ['id', 'userRole'], populate: { role: { fields: ['type'] } } },
                  coordinator: { fields: ['id', 'userRole'], populate: { role: { fields: ['type'] } } },
                  doctor: { populate: { users_permissions_user: { fields: ['id', 'userRole'], populate: { role: { fields: ['type'] } } } } },
                },
              },
            },
          },
        },
      });

      const senderId = (msg as any)?.sender?.id;
      const senderName = (msg as any)?.sender?.fullName || 'Собеседник';
      const conversation = (msg as any)?.conversation || {};
      const participants = [
        ...(conversation.users_permissions_users || []),
        conversation.activeManager,
        conversation.medical_case?.patient,
        conversation.medical_case?.manager,
        conversation.medical_case?.coordinator,
        conversation.doctorChatEnabled ? conversation.medical_case?.doctor?.users_permissions_user : null,
      ].filter(Boolean);
      const conversationDocId = (msg as any)?.conversation?.documentId;
      const preview = ((result as any).content || '').slice(0, 80);

      const svc = strapi.service('api::notification.notification');
      const notified = new Set<number>();

      for (const p of participants) {
        if (!p?.id || p.id === senderId) continue;
        if (notified.has(p.id)) continue;
        notified.add(p.id);
        const roleType = p?.role?.type || p?.userRole;
        const link =
          roleType === 'doctor' ? '/doctor/chat' :
            roleType === 'manager' ? '/manager/chat' :
            roleType === 'coordinator' ? '/coordinator' :
            roleType === 'admin' ? '/admin' :
            '/patient/chat';
        await svc.notifyUser(p.id, {
          title: `Сообщение от ${senderName}`,
          message: preview,
          type: 'message',
          link,
          metadata: { conversationId: conversationDocId, messageId: documentId },
        });
      }
    } catch (error) {
      strapi.log.error('message afterCreate notification error:', error);
    }
  },
};
