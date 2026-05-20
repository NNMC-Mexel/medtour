/**
 * Case-first conversation controller.
 * Keeps legacy appointment/user-member conversations working, while allowing
 * staff to operate shared MedicalCase chat queues without adding every manager
 * as an explicit conversation member.
 */
import { factories } from '@strapi/strapi';
import {
  getMedicalCaseAccessFilter,
  getUserRole,
  isAdminUser,
  userCanAccessMedicalCase,
} from '../../../utils/medtour-access';

const UID = 'api::conversation.conversation' as any;
const MESSAGE_UID = 'api::message.message' as any;
const CASE_UID = 'api::medical-case.medical-case' as any;

const CONVERSATION_POPULATE = {
  users_permissions_users: { fields: ['id', 'documentId', 'fullName', 'email', 'userRole'], populate: { avatar: true, role: true } },
  activeManager: { fields: ['id', 'documentId', 'fullName', 'email', 'userRole'] },
  medical_case: {
    populate: {
      patient: { fields: ['id', 'documentId', 'fullName', 'email', 'phone', 'country'] },
      manager: { fields: ['id', 'documentId', 'fullName', 'email'] },
      coordinator: { fields: ['id', 'documentId', 'fullName', 'email'] },
      doctor: { populate: { users_permissions_user: { fields: ['id', 'documentId', 'fullName', 'email'] }, specialization: true } },
    },
  },
  appointment: true,
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

async function resolveConversation(strapi: any, ref: any, populate: any = CONVERSATION_POPULATE) {
  if (!ref) return null;
  const asNumber = Number(ref);
  if (Number.isInteger(asNumber) && String(asNumber) === String(ref)) {
    return strapi.query(UID).findOne({ where: { id: asNumber }, populate });
  }
  return strapi.documents(UID).findOne({ documentId: String(ref), populate });
}

async function resolveMedicalCase(strapi: any, ref: any) {
  if (!ref) return null;
  const asNumber = Number(ref);
  if (Number.isInteger(asNumber) && String(asNumber) === String(ref)) {
    return strapi.query(CASE_UID).findOne({
      where: { id: asNumber },
      populate: {
        patient: true,
        manager: true,
        coordinator: true,
        doctor: { populate: { users_permissions_user: true } },
        conversation: true,
      },
    });
  }
  const items = await strapi.documents(CASE_UID).findMany({
    filters: { documentId: String(ref) },
    limit: 1,
    populate: {
      patient: true,
      manager: true,
      coordinator: true,
      doctor: { populate: { users_permissions_user: true } },
      conversation: true,
    },
  });
  return items[0] || null;
}

async function createCaseEvent(strapi: any, payload: Record<string, any>) {
  try {
    await strapi.documents('api::case-event.case-event' as any).create({ data: payload });
  } catch (error) {
    strapi.log.error('conversation case-event create failed:', error);
  }
}

async function canAccessConversation(strapi: any, user: any, conversation: any) {
  if (!user || !conversation) return false;
  if (isAdminUser(user)) return true;

  const role = getUserRole(user);
  const members = asArray((conversation as any).users_permissions_users);
  if (members.some((member: any) => member?.id === user.id)) return true;

  const medicalCase = (conversation as any).medical_case;
  if (!medicalCase) return false;
  if (role === 'doctor' && (conversation as any).doctorChatEnabled !== true) return false;
  return userCanAccessMedicalCase(strapi, user, medicalCase);
}

async function enrichConversationsForUser(strapi: any, user: any, conversations: any[]) {
  const enriched: any[] = [];

  for (const conversation of conversations) {
    const messages = await strapi.documents(MESSAGE_UID).findMany({
      filters: { conversation: { documentId: conversation.documentId } },
      sort: ['createdAt:asc'],
      populate: { sender: { fields: ['id', 'documentId', 'fullName', 'email', 'userRole'] }, attachments: true },
      limit: 500,
    });

    let unreadCount = 0;
    for (const message of messages as any[]) {
      const senderId = message?.sender?.id;
      const readBy = message?.readBy || {};
      const readByMe = readBy[String(user.id)] || readBy[user.documentId];
      if (senderId !== user.id && !readByMe && message.isRead !== true) unreadCount += 1;
    }

    const last = messages[messages.length - 1];
    enriched.push({
      ...conversation,
      unreadCount,
      lastMessage: last
        ? {
            id: last.id,
            documentId: last.documentId,
            content: last.content,
            createdAt: last.createdAt,
            sender: last.sender,
          }
        : conversation.lastMessage,
    });
  }

  return enriched;
}

async function connectConversationMembers(strapi: any, conversationId: number, participants: any[]) {
  const ids = participants.map((p) => p?.id).filter(Boolean);
  for (const participantId of ids) {
    await strapi.query('plugin::users-permissions.user').update({
      where: { id: participantId },
      data: { conversations: { connect: [conversationId] } } as any,
    });
  }
}

function getCaseParticipants(medicalCase: any, doctorChatEnabled: boolean) {
  return [
    medicalCase?.patient,
    medicalCase?.manager,
    medicalCase?.coordinator,
    doctorChatEnabled ? medicalCase?.doctor?.users_permissions_user : null,
  ].filter(Boolean);
}

export default factories.createCoreController(UID, ({ strapi }) => ({
  async find(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');

    const queryFilters = (ctx.query?.filters as any) || {};
    let filters: any = queryFilters;

    if (!isAdminUser(user)) {
      const caseFilter = await getMedicalCaseAccessFilter(strapi, user);
      if (caseFilter === null) {
        filters = { ...queryFilters, users_permissions_users: { id: user.id } };
      } else {
        filters = {
          ...queryFilters,
          $or: [
            { medical_case: caseFilter },
            { users_permissions_users: { id: user.id } },
          ],
        };
        if (getUserRole(user) === 'doctor') filters.doctorChatEnabled = true;
      }
    }

    const conversations = await strapi.documents(UID).findMany({
      filters,
      sort: (ctx.query?.sort as any) || ['lastMessageAt:desc', 'updatedAt:desc'],
      populate: CONVERSATION_POPULATE,
      limit: Number((ctx.query?.pagination as any)?.limit) || 200,
    });

    const visible = [];
    for (const conversation of conversations as any[]) {
      if (await canAccessConversation(strapi, user, conversation)) visible.push(conversation);
    }

    const data = await enrichConversationsForUser(strapi, user, visible);
    return { data, meta: { pagination: { page: 1, pageSize: data.length, pageCount: 1, total: data.length } } };
  },

  async findOne(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');

    const conversation = await resolveConversation(strapi, ctx.params.id);
    if (!conversation) return ctx.notFound('Conversation not found');
    if (!(await canAccessConversation(strapi, user, conversation))) return ctx.forbidden('Access denied');

    const data = (await enrichConversationsForUser(strapi, user, [conversation]))[0];
    return { data };
  },

  async forCase(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');

    const medicalCase = await resolveMedicalCase(strapi, ctx.params.caseId);
    if (!medicalCase) return ctx.notFound('Medical case not found');
    if (!(await userCanAccessMedicalCase(strapi, user, medicalCase))) return ctx.forbidden('Access denied');

    const existing = await strapi.documents(UID).findMany({
      filters: { medical_case: { documentId: medicalCase.documentId } },
      limit: 1,
      populate: CONVERSATION_POPULATE,
    });

    if (existing[0]) {
      const data = (await enrichConversationsForUser(strapi, user, [existing[0]]))[0];
      return { data };
    }

    const doctorChatEnabled = getUserRole(user) === 'doctor';
    const participants = getCaseParticipants(medicalCase, doctorChatEnabled);
    const created = await strapi.documents(UID).create({
      data: {
        channel: 'case',
        lifecycleStatus: 'open',
        sharedQueue: true,
        doctorChatEnabled,
        medical_case: medicalCase.documentId || medicalCase.id,
        lastMessageAt: new Date().toISOString(),
      },
      status: 'published',
      populate: CONVERSATION_POPULATE,
    });

    await connectConversationMembers(strapi, created.id, participants);

    const populated = await strapi.documents(UID).findOne({
      documentId: created.documentId,
      populate: CONVERSATION_POPULATE,
    });

    await createCaseEvent(strapi, {
      medical_case: medicalCase.documentId || medicalCase.id,
      actor: user.documentId || user.id,
      eventType: 'NOTE',
      message: 'Case chat opened',
      metadata: { conversationId: created.documentId },
    });

    const data = (await enrichConversationsForUser(strapi, user, [populated || created]))[0];
    return { data };
  },

  async messages(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');

    const conversation = await resolveConversation(strapi, ctx.params.id);
    if (!conversation) return ctx.notFound('Conversation not found');
    if (!(await canAccessConversation(strapi, user, conversation))) return ctx.forbidden('Access denied');

    const data = await strapi.documents(MESSAGE_UID).findMany({
      filters: { conversation: { documentId: conversation.documentId } },
      sort: ['createdAt:asc'],
      populate: { sender: { fields: ['id', 'documentId', 'fullName', 'email', 'userRole'] }, attachments: true },
      limit: Number((ctx.query?.pagination as any)?.limit) || 500,
    });

    return { data, meta: { pagination: { page: 1, pageSize: data.length, pageCount: 1, total: data.length } } };
  },

  async markRead(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');

    const conversation = await resolveConversation(strapi, ctx.params.id);
    if (!conversation) return ctx.notFound('Conversation not found');
    if (!(await canAccessConversation(strapi, user, conversation))) return ctx.forbidden('Access denied');

    const now = new Date().toISOString();
    const messages = await strapi.documents(MESSAGE_UID).findMany({
      filters: { conversation: { documentId: conversation.documentId } },
      populate: { sender: { fields: ['id'] } },
      limit: 500,
    });

    let count = 0;
    for (const message of messages as any[]) {
      if (message?.sender?.id === user.id) continue;
      const readBy = { ...(message.readBy || {}), [String(user.id)]: now };
      await strapi.documents(MESSAGE_UID).update({
        documentId: message.documentId,
        data: { isRead: true, readAt: now, readBy } as any,
        status: 'published',
      });
      count += 1;
    }

    const lastReadBy = { ...((conversation as any).lastReadBy || {}), [String(user.id)]: now };
    await strapi.documents(UID).update({
      documentId: conversation.documentId,
      data: { lastReadBy } as any,
      status: 'published',
    });

    const medicalCaseRef = getRelationRef((conversation as any).medical_case);
    if (medicalCaseRef) {
      await createCaseEvent(strapi, {
        medical_case: medicalCaseRef,
        actor: user.documentId || user.id,
        eventType: 'CHAT_READ',
        message: 'Chat marked as read',
        metadata: { conversationId: conversation.documentId, count },
      });
    }

    return { data: { count, readAt: now } };
  },

  async takeover(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');
    const role = getUserRole(user);
    if (!['manager', 'coordinator', 'admin'].includes(role)) return ctx.forbidden('Only staff can take over chats');

    const conversation = await resolveConversation(strapi, ctx.params.id);
    if (!conversation) return ctx.notFound('Conversation not found');
    if (!(await canAccessConversation(strapi, user, conversation))) return ctx.forbidden('Access denied');

    const updated = await strapi.documents(UID).update({
      documentId: conversation.documentId,
      data: {
        activeManager: user.documentId || user.id,
        takeoverAt: new Date().toISOString(),
        sharedQueue: true,
      } as any,
      status: 'published',
      populate: CONVERSATION_POPULATE,
    });

    const medicalCaseRef = getRelationRef((conversation as any).medical_case);
    if (medicalCaseRef) {
      await createCaseEvent(strapi, {
        medical_case: medicalCaseRef,
        actor: user.documentId || user.id,
        eventType: 'CHAT_TAKEOVER',
        message: 'Chat takeover',
        metadata: { conversationId: conversation.documentId, role },
      });
    }

    return { data: updated };
  },

  async create(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');

    const isAdmin = isAdminUser(user);
    const body = (ctx.request.body as any)?.data || ctx.request.body || {};
    const participantIds = body.users_permissions_users || body.participants || [];
    const medicalCaseRef = body.medical_case;
    const appointmentRef = body.appointment;

    if (medicalCaseRef) {
      if (!(await userCanAccessMedicalCase(strapi, user, medicalCaseRef))) return ctx.forbidden('Access denied');
      const created = await strapi.documents(UID).create({
        data: {
          ...body,
          channel: body.channel || 'case',
          lifecycleStatus: body.lifecycleStatus || 'open',
          sharedQueue: body.sharedQueue !== false,
        },
        status: 'published',
        populate: CONVERSATION_POPULATE,
      });
      return { data: created };
    }

    if (!isAdmin && !appointmentRef) {
      return ctx.badRequest('Conversation can only be created for a MedicalCase or appointment');
    }

    let appointment: any = null;
    if (appointmentRef) {
      appointment = typeof appointmentRef === 'number'
        ? await strapi.query('api::appointment.appointment').findOne({
            where: { id: appointmentRef },
            populate: {
              patient: { select: ['id'] },
              doctor: { populate: { users_permissions_user: { select: ['id'] } } },
            },
          })
        : await strapi.documents('api::appointment.appointment').findOne({
            documentId: appointmentRef,
            populate: {
              patient: { fields: ['id'] },
              doctor: { populate: { users_permissions_user: { fields: ['id'] } } },
            },
          });
    }

    if (!isAdmin && !appointment) return ctx.badRequest('Appointment not found');

    let requiredParticipants: number[] = [];
    if (appointment) {
      const patientId = (appointment as any).patient?.id;
      const doctorUserId = (appointment as any).doctor?.users_permissions_user?.id;
      requiredParticipants = [patientId, doctorUserId].filter(Boolean);

      if (!isAdmin) {
        const isParticipant = user.id === patientId || user.id === doctorUserId;
        if (!isParticipant) return ctx.forbidden('Access denied');
      }
    }

    const normalizedParticipants = Array.isArray(participantIds)
      ? participantIds.map((id) => Number(id)).filter(Boolean)
      : [];

    if (!isAdmin) {
      const hasAllAppointmentMembers = requiredParticipants.every((id) => normalizedParticipants.includes(id));
      if (!hasAllAppointmentMembers || normalizedParticipants.length !== requiredParticipants.length) {
        return ctx.badRequest('Conversation participants must match appointment participants');
      }
    }

    const conversationData = { ...body, channel: body.channel || 'appointment' };
    delete conversationData.users_permissions_users;
    delete conversationData.participants;
    if (appointment?.documentId) conversationData.appointment = appointment.documentId;

    const created = await strapi.documents(UID).create({
      data: conversationData,
      status: 'published',
    });

    const usersToConnect = isAdmin && normalizedParticipants.length > 0
      ? normalizedParticipants
      : requiredParticipants;
    for (const participantId of usersToConnect) {
      await strapi.query('plugin::users-permissions.user').update({
        where: { id: participantId },
        data: { conversations: { connect: [created.id] } } as any,
      });
    }

    const populated = await strapi.documents(UID).findOne({
      documentId: created.documentId,
      populate: CONVERSATION_POPULATE,
    });

    return { data: populated || created };
  },
}));
