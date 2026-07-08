import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageCircle, MessageSquarePlus, Send, X } from 'lucide-react'
import Button from '../ui/Button'
import { cn } from '../../utils/helpers'
import useAuthStore from '../../stores/authStore'
import useChatStore from '../../stores/chatStore'
import { conversationsAPI, normalizeResponse, openMediaInNewTab } from '../../services/api'
import AuthenticatedImage from '../ui/AuthenticatedImage'

const SUPPORT_VISITOR_KEY = 'medtour-support-visitor-id'
const SUPPORT_CONVERSATION_KEY = 'medtour-support-conversation-id'
const SUPPORT_CONTACT_KEY = 'medtour-support-contact'

function getStoredValue(key) {
  if (typeof window === 'undefined') return ''
  return window.localStorage.getItem(key) || ''
}

function setStoredValue(key, value) {
  if (typeof window === 'undefined') return
  if (value) window.localStorage.setItem(key, value)
  else window.localStorage.removeItem(key)
}

function getVisitorId() {
  const existing = getStoredValue(SUPPORT_VISITOR_KEY)
  if (existing) return existing
  const generated = `guest-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`
  setStoredValue(SUPPORT_VISITOR_KEY, generated)
  return generated
}

function getMessageId(message) {
  return message?.documentId || message?.id || message?.localId
}

function PatientChatWidget() {
  const { t, i18n } = useTranslation()
  const { user } = useAuthStore()
  const isPatient = !user || user.userRole === 'patient'
  const {
    conversations,
    managerPresence,
    fetchConversations,
    upsertConversation,
  } = useChatStore()
  const [isOpen, setIsOpen] = useState(false)
  const [supportMessages, setSupportMessages] = useState([])
  const [supportConversationId, setSupportConversationId] = useState(() => getStoredValue(SUPPORT_CONVERSATION_KEY))
  const [visitorId] = useState(() => getVisitorId())
  const [contact, setContact] = useState(() => getStoredValue(SUPPORT_CONTACT_KEY))
  const [draft, setDraft] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const widgetRef = useRef(null)
  const endRef = useRef(null)

  const unreadCount = useMemo(
    () => conversations.reduce((sum, item) => sum + (item.unreadCount || 0), 0),
    [conversations],
  )

  useEffect(() => {
    if (!isOpen || !user?.id) return
    fetchConversations()
  }, [fetchConversations, isOpen, user?.id])

  useEffect(() => {
    if (!user?.id || supportConversationId) return
    const supportConversation = conversations.find((conversation) => conversation.channel === 'support')
    const nextId = supportConversation?.documentId || supportConversation?.id
    if (!nextId) return
    setSupportConversationId(nextId)
    setStoredValue(SUPPORT_CONVERSATION_KEY, nextId)
  }, [conversations, supportConversationId, user?.id])

  useEffect(() => {
    if (!isOpen || !supportConversationId) return
    conversationsAPI.getSupportMessages(supportConversationId, visitorId)
      .then((response) => {
        const { data } = normalizeResponse(response)
        setSupportMessages(Array.isArray(data) ? data : [])
      })
      .catch(() => {
        setStoredValue(SUPPORT_CONVERSATION_KEY, '')
        setSupportConversationId('')
        setSupportMessages([])
      })
  }, [isOpen, supportConversationId, visitorId])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [supportMessages.length, isOpen])

  useEffect(() => {
    if (!isOpen) return undefined

    const handlePointerDown = (event) => {
      if (widgetRef.current?.contains(event.target)) return
      setIsOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
    }
  }, [isOpen])

  useEffect(() => {
    const handleOpenSupportChat = () => {
      setIsOpen(true)
    }

    window.addEventListener('medtour:open-support-chat', handleOpenSupportChat)
    return () => window.removeEventListener('medtour:open-support-chat', handleOpenSupportChat)
  }, [])

  const startSupportChat = () => {
    setSupportMessages([])
    setSupportConversationId('')
    setStoredValue(SUPPORT_CONVERSATION_KEY, '')
    setDraft('')
    setSendError('')
  }

  const openWidget = () => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {})
    }
    setIsOpen(true)
  }

  const handleSend = async (event) => {
    event.preventDefault()
    const content = draft.trim()
    if (!content || isSending) return

    setIsSending(true)
    setSendError('')

    const localMessage = {
      localId: `local-${Date.now()}`,
      content,
      createdAt: new Date().toISOString(),
      sender: user ? { id: user.id, documentId: user.documentId, fullName: user.fullName, email: user.email } : undefined,
      metadata: { actorType: user?.userRole || 'guest' },
    }
    setSupportMessages((items) => [...items, localMessage])

    try {
      const response = await conversationsAPI.sendSupportMessage({
        conversationId: supportConversationId || undefined,
        visitorId,
        content,
        contact: user ? undefined : contact.trim(),
        name: user?.fullName || '',
        locale: i18n.language,
        sourceUrl: typeof window !== 'undefined' ? window.location.href : '',
      })
      const { data } = normalizeResponse(response)
      const nextConversationId = data?.conversation?.documentId || data?.conversation?.id
      if (nextConversationId) {
        setSupportConversationId(nextConversationId)
        setStoredValue(SUPPORT_CONVERSATION_KEY, nextConversationId)
      }
      if (data?.conversation) {
        upsertConversation({
          ...data.conversation,
          channel: data.conversation.channel || 'support',
          lastMessage: data.message || data.conversation.lastMessage,
          lastMessageAt: data.message?.createdAt || data.conversation.lastMessageAt,
        })
      }
      if (!user && contact.trim()) setStoredValue(SUPPORT_CONTACT_KEY, contact.trim())
      if (data?.message) {
        setSupportMessages((items) => [
          ...items.filter((item) => item.localId !== localMessage.localId),
          data.message,
        ])
      }
      if (user?.id) fetchConversations()
      window.dispatchEvent(new CustomEvent('medtour:support-chat-updated', {
        detail: { conversationId: nextConversationId },
      }))
      setDraft('')
    } catch {
      setSupportMessages((items) => items.filter((item) => item.localId !== localMessage.localId))
      setSendError(t('chat.widget_send_error'))
    } finally {
      setIsSending(false)
    }
  }

  if (!isPatient) return null

  return (
    <div ref={widgetRef} data-chat-widget className="fixed bottom-4 right-4 z-40">
      {!isOpen ? (
        <button
          type="button"
          onClick={openWidget}
          className="relative flex h-14 w-14 items-center justify-center rounded-full bg-teal-600 text-white shadow-lg shadow-teal-900/20 transition-colors hover:bg-teal-700"
          aria-label={t('chat.widget_open')}
        >
          <MessageCircle className="h-6 w-6" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[11px] font-semibold">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      ) : (
        <div className="flex h-[min(560px,calc(100vh-2rem))] w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-900 px-4 py-3 text-white">
            <div className="min-w-0">
              <p className="truncate font-semibold">{t('chat.widget_title')}</p>
              <p className={cn('text-xs', managerPresence.managerOnline ? 'text-emerald-300' : 'text-slate-300')}>
                {managerPresence.managerOnline ? t('chat.widget_status_online') : t('chat.widget_status_later')}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={startSupportChat}
                className="inline-flex items-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium hover:bg-white/10"
                aria-label={t('chat.widget_new_chat')}
                title={t('chat.widget_new_chat')}
              >
                <MessageSquarePlus className="h-4 w-4" />
                <span className="hidden sm:inline">{t('chat.widget_new_chat')}</span>
              </button>
              <button type="button" onClick={() => setIsOpen(false)} className="rounded-lg p-2 hover:bg-white/10" aria-label={t('chat.widget_close')} title={t('chat.widget_close')}>
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {!user && (
            <div className="border-b border-slate-100 bg-white px-4 py-3">
              <label className="text-xs font-medium text-slate-600" htmlFor="support-contact">
                {t('chat.widget_contact_label')}
              </label>
              <input
                id="support-contact"
                value={contact}
                onChange={(event) => {
                  setContact(event.target.value)
                  setStoredValue(SUPPORT_CONTACT_KEY, event.target.value)
                }}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                placeholder={t('chat.widget_contact_placeholder')}
              />
              <p className="mt-1 text-xs text-slate-500">{t('chat.widget_contact_hint')}</p>
            </div>
          )}

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4">
            {supportMessages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <p className="font-medium text-slate-900">{t('chat.widget_support_empty_title')}</p>
                <p className="mt-1 max-w-72 text-sm text-slate-500">{t('chat.widget_support_empty_hint')}</p>
              </div>
            ) : (
              supportMessages.map((message) => {
                const isMe = message.sender?.id === user?.id || (!message.sender && message.metadata?.actorType === 'guest')
                return (
                  <div key={getMessageId(message)} className={cn('flex', isMe ? 'justify-end' : 'justify-start')}>
                    <div className={cn(
                      'max-w-[82%] rounded-xl px-3 py-2 text-sm',
                      isMe ? 'bg-teal-600 text-white' : 'border border-slate-200 bg-white text-slate-900',
                    )}>
                      <p className="whitespace-pre-wrap">{message.content}</p>
                      {(message.attachments || []).map((file) => (
                        <button key={file.id || file.url} type="button" onClick={() => openMediaInNewTab(file)} className="mt-2 block text-left">
                          {file.mime?.startsWith('image/') ? (
                            <AuthenticatedImage media={file} alt={file.name || t('chat.widget_attachment')} className="max-h-32 rounded-lg object-cover" />
                          ) : (
                            <span className={cn('text-xs underline', isMe ? 'text-teal-50' : 'text-teal-700')}>{file.name || t('chat.widget_attachment')}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })
            )}
            <div ref={endRef} />
          </div>

          {sendError && (
            <div className="border-t border-rose-100 bg-rose-50 px-4 py-2 text-xs text-rose-700">
              {sendError}
            </div>
          )}

          <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-slate-100 p-3">
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              className="min-w-0 flex-1 rounded-lg border-0 bg-slate-100 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-500"
              placeholder={t('chat.widget_message_placeholder')}
            />
            <Button type="submit" size="icon" disabled={!draft.trim() || isSending} isLoading={isSending}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      )}
    </div>
  )
}

export default PatientChatWidget
