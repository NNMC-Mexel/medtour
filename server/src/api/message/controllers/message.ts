/**
 * Message controller with case-first RBAC, audit logging and server-owned sender.
 */
import { factories } from '@strapi/strapi';
import { getUserRole, isAdminUser, userCanAccessMedicalCase } from '../../../utils/medtour-access';

const UID = 'api::message.message' as any;
const CONVERSATION_UID = 'api::conversation.conversation' as any;

const MESSAGE_POPULATE = {
  sender: { fields: ['id', 'documentId', 'fullName', 'email', 'userRole'] },
  attachments: true,
  conversation: {
    populate: {
      users_permissions_users: { fields: ['id', 'documentId', 'fullName', 'email', 'userRole'] },
      medical_case: {
        populate: {
          patient: { fields: ['id', 'documentId', 'fullName', 'email'] },
          manager: { fields: ['id', 'documentId', 'fullName', 'email'] },
          coordinator: { fields: ['id', 'documentId', 'fullName', 'email'] },
          doctor: { populate: { users_permissions_user: { fields: ['id', 'documentId', 'fullName', 'email'] } } },
        },
      },
      activeManager: { fields: ['id', 'documentId', 'fullName', 'email'] },
    },
  },
} as any;

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function getRelationRef(value: any) {
  if (!value) return undefined;
  if (typeof value === 'object') return value.documentId || value.id;
  return value;
}

async function resolveMessage(strapi: any, ref: any) {
  if (!ref) return null;
  const asNumber = Number(ref);
  if (Number.isInteger(asNumber) && String(asNumber) === String(ref)) {
    return strapi.query(UID).findOne({ where: { id: asNumber }, populate: MESSAGE_POPULATE });
  }
  return strapi.documents(UID).findOne({ documentId: String(ref), populate: MESSAGE_POPULATE });
}

async function resolveConversation(strapi: any, ref: any) {
  if (!ref) return null;
  const asNumber = Number(ref);
  if (Number.isInteger(asNumber) && String(asNumber) === String(ref)) {
    return strapi.query(CONVERSATION_UID).findOne({
      where: { id: asNumber },
      populate: MESSAGE_POPULATE.conversation.populate,
    });
  }
  return strapi.documents(CONVERSATION_UID).findOne({
    documentId: String(ref),
    populate: MESSAGE_POPULATE.conversation.populate,
  });
}

async function canAccessConversation(strapi: any, user: any, conversation: any) {
  if (!user || !conversation) return false;
  if (isAdminUser(user)) return true;

  const role = getUserRole(user);
  const members = asArray((conversation as any).users_permissions_users);
  if (members.some((member: any) => member?.id === user.id)) return true;

  if ((conversation as any).channel === 'support' && (conversation as any).sharedQueue === true) {
    return ['manager', 'coordinator'].includes(role);
  }

  const medicalCase = (conversation as any).medical_case;
  if (!medicalCase) return false;
  if (role === 'doctor' && (conversation as any).doctorChatEnabled !== true) return false;
  return userCanAccessMedicalCase(strapi, user, medicalCase);
}

async function createCaseEvent(strapi: any, payload: Record<string, any>) {
  try {
    await strapi.documents('api::case-event.case-event' as any).create({ data: payload });
  } catch (error) {
    strapi.log.error('message case-event create failed:', error);
  }
}

export default factories.createCoreController(UID, ({ strapi }) => ({
  async findOne(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');

    const message = await resolveMessage(strapi, ctx.params.id);
    if (!message) return ctx.notFound('Message not found');
    if (!(await canAccessConversation(strapi, user, (message as any).conversation))) return ctx.forbidden('Access denied');

    return { data: message };
  },

  async find(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');

    const queryFilters = (ctx.query?.filters as any) || {};
    const items = await strapi.documents(UID).findMany({
      filters: queryFilters,
      sort: (ctx.query?.sort as any) || ['createdAt:asc'],
      populate: MESSAGE_POPULATE,
      limit: Number((ctx.query?.pagination as any)?.limit) || 500,
    });

    const data = [];
    for (const message of items as any[]) {
      if (await canAccessConversation(strapi, user, message.conversation)) data.push(message);
    }

    return { data, meta: { pagination: { page: 1, pageSize: data.length, pageCount: 1, total: data.length } } };
  },

  async create(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');

    const body = (ctx.request.body as any)?.data || ctx.request.body || {};
    const conversationRef = body.conversation;
    if (!conversationRef) return ctx.badRequest('conversation is required');

    const conversation = await resolveConversation(strapi, conversationRef);
    if (!conversation) return ctx.badRequest('Conversation not found');
    if (!(await canAccessConversation(strapi, user, conversation))) return ctx.forbidden('Access denied');

    const attachments = body.attachments !== undefined ? asArray(body.attachments).filter(Boolean) : undefined;
    const messageType = body.messageType || (attachments?.length ? 'file' : 'text');
    const now = new Date().toISOString();
    const content = String(body.content || '').trim() || (attachments?.length ? 'Attachment' : '');
    if (!content) return ctx.badRequest('content is required');

    const messageData: Record<string, any> = {
      content,
      messageType,
      conversation: (conversation as any).documentId || conversationRef,
      sender: user.documentId || user.id,
      deliveredAt: now,
      readBy: { [String(user.id)]: now },
      metadata: body.metadata || null,
    };
    if (attachments !== undefined) messageData.attachments = attachments;

    const created = await strapi.documents(UID).create({
      data: messageData as any,
      status: 'published',
      populate: MESSAGE_POPULATE,
    });

    await strapi.documents(CONVERSATION_UID).update({
      documentId: (conversation as any).documentId,
      data: {
        lastMessage: content.slice(0, 500),
        lastMessageAt: now,
      } as any,
      status: 'published',
    });

    const medicalCaseRef = getRelationRef((conversation as any).medical_case);
    if (medicalCaseRef) {
      await createCaseEvent(strapi, {
        medical_case: medicalCaseRef,
        actor: user.documentId || user.id,
        eventType: attachments?.length ? 'CHAT_UPLOAD' : 'CHAT_MESSAGE_SENT',
        message: attachments?.length ? 'Chat attachment uploaded' : 'Chat message sent',
        metadata: {
          conversationId: (conversation as any).documentId,
          messageId: (created as any).documentId,
          messageType,
          role: getUserRole(user),
          attachmentCount: attachments?.length || 0,
        },
      });
    }

    return { data: created };
  },
}));
