import { create } from 'zustand'
import { io } from 'socket.io-client'
import {
  conversationsAPI,
  messagesAPI,
  normalizeResponse,
  getSignalingUrl,
  getAuthToken,
  uploadFile,
} from '../services/api'
import { showMessageNotification, clearNotificationReminder } from '../utils/notifications'
import useAuthStore from './authStore'

const conversationKey = (conversation) => conversation?.documentId || conversation?.id
const messageKey = (message) => message?.documentId || message?.id

const upsertByKey = (items, item, getKey) => {
  const key = getKey(item)
  if (!key) return items
  const exists = items.some((existing) => getKey(existing) === key)
  return exists ? items.map((existing) => (getKey(existing) === key ? { ...existing, ...item } : existing)) : [item, ...items]
}

// A message can reach us twice: through the open conversation's room and as a
// personal "chat:unread" signal. Count each message once.
const countedUnreadMessages = new Set()
const markCounted = (conversationId, messageId) => {
  if (!messageId) return true
  const key = `${conversationId}:${messageId}`
  if (countedUnreadMessages.has(key)) return false
  if (countedUnreadMessages.size > 500) countedUnreadMessages.clear()
  countedUnreadMessages.add(key)
  return true
}
const currentUserId = () => useAuthStore.getState().user?.id

/** Непрочитанные во всех беседах — для отметки на пункте «Сообщения». */
export const selectTotalUnread = (state) =>
  state.conversations.reduce((sum, conversation) => sum + (Number(conversation.unreadCount) || 0), 0)

const useChatStore = create((set, get) => ({
  conversations: [],
  currentConversation: null,
  messages: [],
  managerPresence: { managerOnline: false, onlineManagers: 0 },
  typingUsers: {},
  socket: null,
  isSocketConnected: false,
  isLoading: false,
  error: null,

  connectSocket: () => {
    const existing = get().socket
    const token = getAuthToken()
    if (existing?.connected || !token) return existing

    const socket = io(getSignalingUrl(), {
      // Функция, а не объект: после смены пароля сервер выдаёт новый JWT, и
      // переподключение должно идти с ним, а не с отозванным.
      auth: (cb) => cb({ token: getAuthToken() || token }),
      transports: ['websocket', 'polling'],
      reconnection: true,
    })

    socket.on('connect', () => {
      set({ isSocketConnected: true })
      socket.emit('chat:presence:get')
    })

    socket.on('disconnect', () => set({ isSocketConnected: false }))
    socket.on('chat:manager-presence', (presence) => set({ managerPresence: presence }))
    socket.on('chat:typing', ({ conversationId, userId, userName, isTyping }) => {
      set((state) => {
        const key = String(conversationId)
        const current = { ...(state.typingUsers[key] || {}) }
        if (isTyping) current[userId] = userName
        else delete current[userId]
        return { typingUsers: { ...state.typingUsers, [key]: current } }
      })
    })
    socket.on('chat:message-created', ({ conversationId, message }) => {
      const currentId = conversationKey(get().currentConversation)
      if (String(currentId) !== String(conversationId)) showMessageNotification(message)
      set((state) => {
        const nextConversations = state.conversations.map((conversation) => {
          if (String(conversationKey(conversation)) !== String(conversationId)) return conversation
          return {
            ...conversation,
            lastMessage: {
              id: message.id,
              documentId: message.documentId,
              content: message.content,
              createdAt: message.createdAt,
              sender: message.sender,
            },
            lastMessageAt: message.createdAt,
            unreadCount: String(currentId) === String(conversationId)
              || String(message.sender?.id ?? '') === String(currentUserId() ?? '')
              || !markCounted(conversationId, message.id)
              ? conversation.unreadCount || 0
              : (conversation.unreadCount || 0) + 1,
          }
        })

        if (String(currentId) !== String(conversationId)) return { conversations: nextConversations }
        const exists = state.messages.some((item) => messageKey(item) === messageKey(message))
        return {
          conversations: nextConversations,
          messages: exists ? state.messages : [...state.messages, message],
        }
      })
    })
    // Personal signal: someone wrote in one of our conversations, even if it is
    // not open (and its room not joined). Carries no message text.
    socket.on('chat:unread', ({ conversationId, messageId } = {}) => {
      if (!conversationId) return
      if (String(conversationKey(get().currentConversation)) === String(conversationId)) return
      if (!markCounted(conversationId, messageId)) return
      const known = get().conversations.some((conversation) => String(conversationKey(conversation)) === String(conversationId))
      if (!known) {
        get().refreshConversations()
        return
      }
      set((state) => ({
        conversations: state.conversations.map((conversation) => (
          String(conversationKey(conversation)) === String(conversationId)
            ? { ...conversation, unreadCount: (Number(conversation.unreadCount) || 0) + 1 }
            : conversation
        )),
      }))
    })
    socket.on('chat:read', ({ conversationId }) => {
      set((state) => ({
        conversations: state.conversations.map((conversation) => (
          String(conversationKey(conversation)) === String(conversationId)
            ? { ...conversation, unreadCount: 0 }
            : conversation
        )),
      }))
    })
    socket.on('chat:takeover', ({ conversationId, managerId, managerName, takeoverAt }) => {
      set((state) => ({
        conversations: state.conversations.map((conversation) => (
          String(conversationKey(conversation)) === String(conversationId)
            ? {
                ...conversation,
                takeoverAt,
                activeManager: { ...(conversation.activeManager || {}), id: managerId, fullName: managerName },
              }
            : conversation
        )),
      }))
    })

    set({ socket })
    return socket
  },

  joinConversation: (conversationId) => {
    const socket = get().connectSocket()
    if (socket && conversationId) socket.emit('chat:join', { conversationId })
  },

  joinStaffQueue: () => {
    const socket = get().connectSocket()
    socket?.emit('chat:join-staff-queue')
  },

  sendTyping: (conversationId, isTyping) => {
    const socket = get().socket
    if (socket?.connected && conversationId) socket.emit('chat:typing', { conversationId, isTyping })
  },

  fetchConversations: async () => {
    set({ isLoading: true, error: null })
    try {
      get().connectSocket()
      const response = await conversationsAPI.getAll()
      const { data } = normalizeResponse(response)
      set({ conversations: data || [], isLoading: false })
      return data || []
    } catch (error) {
      console.error('Error fetching conversations:', error)
      set({ error: error.message, isLoading: false, conversations: [] })
      return []
    }
  },

  // Silent re-sync of the conversation list (unread counters) for the cabinet
  // menu: no loading state, so an open chat screen does not flicker.
  refreshConversations: async () => {
    if (!getAuthToken()) return
    try {
      get().connectSocket()
      const response = await conversationsAPI.getAll()
      const { data } = normalizeResponse(response)
      if (Array.isArray(data)) set({ conversations: data })
    } catch {
      // The badge is auxiliary; keep the previous value when the API is down.
    }
  },

  fetchMessages: async (conversationId) => {
    set({ isLoading: true, error: null })
    try {
      const response = await conversationsAPI.getMessages(conversationId)
      const { data } = normalizeResponse(response)
      const sortedMessages = (data || []).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      set({ messages: sortedMessages, isLoading: false })
      get().joinConversation(conversationId)
      await get().markConversationRead(conversationId)
    } catch (error) {
      console.error('Error fetching messages:', error)
      set({ error: error.message, isLoading: false, messages: [] })
    }
  },

  sendMessage: async (conversationId, content, senderId, options = {}) => {
    try {
      const response = await messagesAPI.create({
        conversation: conversationId,
        content,
        sender: senderId,
        messageType: options.messageType || 'text',
        attachments: options.attachments,
        metadata: options.metadata,
      })

      const { data } = normalizeResponse(response)

      set((state) => ({
        messages: state.messages.some((item) => messageKey(item) === messageKey(data))
          ? state.messages
          : [...state.messages, data],
        conversations: state.conversations.map((conversation) => (
          String(conversationKey(conversation)) === String(conversationId)
            ? {
                ...conversation,
                lastMessage: {
                  id: data.id,
                  documentId: data.documentId,
                  content: data.content,
                  createdAt: data.createdAt,
                  sender: data.sender,
                },
                lastMessageAt: data.createdAt,
              }
            : conversation
        )),
      }))

      get().socket?.emit('chat:message-created', { conversationId, message: data })
      return { success: true, data }
    } catch (error) {
      console.error('Error sending message:', error)
      return { success: false, error: error.message }
    }
  },

  uploadAttachment: async (conversationId, file, caption = '') => {
    const uploaded = await uploadFile(file)
    const isImage = file.type?.startsWith('image/')
    return get().sendMessage(conversationId, caption || uploaded.name || file.name, null, {
      messageType: isImage ? 'image' : 'file',
      attachments: [uploaded.id],
      metadata: { fileName: uploaded.name || file.name, mime: file.type, size: file.size },
    })
  },

  getOrCreateCaseConversation: async (caseId) => {
    set({ isLoading: true, error: null })
    try {
      const response = await conversationsAPI.getForCase(caseId)
      const { data } = normalizeResponse(response)
      set((state) => ({
        currentConversation: data,
        conversations: upsertByKey(state.conversations, data, conversationKey),
        isLoading: false,
      }))
      get().joinConversation(conversationKey(data))
      return data
    } catch (error) {
      console.error('Error opening case conversation:', error)
      set({ error: error.message, isLoading: false })
      return null
    }
  },

  getOrCreateConversation: async (participantIds, currentUserId) => {
    set({ isLoading: true })
    try {
      const { conversations } = get()
      const otherIds = participantIds.filter(id => id !== currentUserId)
      const existing = conversations.find(conv => {
        const members = (conv.participants || conv.users_permissions_users || []).map(p => p.id)
        return otherIds.every(id => members.includes(id))
      })

      if (existing) {
        set({ currentConversation: existing, isLoading: false })
        return existing
      }

      const response = await conversationsAPI.create(participantIds)
      const { data } = normalizeResponse(response)

      set((state) => ({
        currentConversation: data,
        conversations: [data, ...state.conversations],
        isLoading: false,
      }))

      return data
    } catch (error) {
      console.error('Error creating conversation:', error)
      set({ error: error.message, isLoading: false })
      return null
    }
  },

  setCurrentConversation: (conversation) => {
    set({ currentConversation: conversation })
    const id = conversationKey(conversation)
    if (id) get().joinConversation(id)
  },

  upsertConversation: (conversation) => {
    if (!conversation) return
    set((state) => ({
      conversations: upsertByKey(state.conversations, conversation, conversationKey),
    }))
  },

  addMessage: (message) => {
    set((state) => {
      if (state.messages.some((item) => messageKey(item) === messageKey(message))) return state
      return { messages: [...state.messages, message] }
    })
  },

  markConversationRead: async (conversationId) => {
    if (!conversationId) return
    clearNotificationReminder(conversationId)
    try {
      const response = await conversationsAPI.markRead(conversationId)
      const readAt = response?.data?.data?.readAt || new Date().toISOString()
      set((state) => ({
        conversations: state.conversations.map((conversation) => (
          String(conversationKey(conversation)) === String(conversationId)
            ? { ...conversation, unreadCount: 0 }
            : conversation
        )),
      }))
      get().socket?.emit('chat:read', { conversationId, readAt })
    } catch (error) {
      console.error('Failed to mark conversation as read:', error)
    }
  },

  takeoverChat: async (conversationId) => {
    try {
      const response = await conversationsAPI.takeover(conversationId)
      const { data } = normalizeResponse(response)
      set((state) => ({
        currentConversation: data,
        conversations: upsertByKey(state.conversations, data, conversationKey),
      }))
      get().socket?.emit('chat:takeover', { conversationId })
      return { success: true, data }
    } catch (error) {
      console.error('Failed to take over chat:', error)
      return { success: false, error: error.message }
    }
  },

  markAsRead: async (messageId) => {
    try {
      await messagesAPI.markAsRead(messageId)
    } catch (error) {
      console.error('Failed to mark as read:', error)
    }
  },

  clearMessages: () => set({ messages: [], currentConversation: null, typingUsers: {} }),
  clearError: () => set({ error: null }),
  reset: () => {
    countedUnreadMessages.clear()
    get().socket?.disconnect()
    set({
      conversations: [],
      currentConversation: null,
      messages: [],
      managerPresence: { managerOnline: false, onlineManagers: 0 },
      typingUsers: {},
      socket: null,
      isSocketConnected: false,
      isLoading: false,
      error: null,
    })
  },
}))

export default useChatStore
