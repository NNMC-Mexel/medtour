import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCheck, Loader2, MessageSquare, Paperclip, Send } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card'
import Button from '../ui/Button'
import AuthenticatedImage from '../ui/AuthenticatedImage'
import useChatStore from '../../stores/chatStore'
import useAuthStore from '../../stores/authStore'
import useChatThread from '../../hooks/useChatThread'
import { openMediaInNewTab } from '../../services/api'
import { cn } from '../../utils/helpers'

const conversationKey = (conversation) => conversation?.documentId || conversation?.id
const messageKey = (message) => message?.documentId || message?.id

/**
 * Переписка с пациентом прямо на странице заявки — та же беседа заявки, что и
 * в «Сообщениях» (channel: case), поэтому сообщения приходят по сокету и
 * видны в обоих местах.
 */
function CaseChatPanel({ caseId }) {
  const { t, i18n } = useTranslation()
  const dateLocale = i18n.language === 'en' ? 'en-US' : i18n.language === 'kk' ? 'kk-KZ' : 'ru-RU'
  const { user } = useAuthStore()
  const {
    currentConversation,
    messages,
    typingUsers,
    getOrCreateCaseConversation,
    fetchMessages,
    sendMessage,
    sendTyping,
    uploadAttachment,
    markConversationRead,
    clearMessages,
  } = useChatStore()

  const [isOpening, setIsOpening] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [newMessage, setNewMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const fileInputRef = useRef(null)
  const typingTimeoutRef = useRef(null)
  // Последнее сообщение, после которого чат уже отмечен прочитанным.
  const lastReadKeyRef = useRef(null)

  // Беседа в сторе общая с «Сообщениями»: открываем беседу заявки при входе и
  // закрываем при уходе, иначе входящие сообщения считались бы прочитанными.
  useEffect(() => {
    if (!caseId) return undefined
    let isMounted = true
    setIsOpening(true)
    setLoadFailed(false)
    getOrCreateCaseConversation(caseId).then(async (conversation) => {
      if (!isMounted) return
      if (!conversation) {
        setLoadFailed(true)
        setIsOpening(false)
        return
      }
      // fetchMessages сам отмечает историю прочитанной.
      await fetchMessages(conversationKey(conversation))
      const loaded = useChatStore.getState().messages
      lastReadKeyRef.current = messageKey(loaded[loaded.length - 1])
      if (isMounted) setIsOpening(false)
    })
    return () => {
      isMounted = false
      window.clearTimeout(typingTimeoutRef.current)
      clearMessages()
    }
  }, [caseId, getOrCreateCaseConversation, fetchMessages, clearMessages])

  // Карточка встроена в страницу, а не полноэкранный диалог: страницу не блокируем.
  const { listRef, onListScroll } = useChatThread({ isOpen: false, messages })

  const conversationId = conversationKey(currentConversation)

  // Входящее пришло, пока карточка открыта, — менеджер его видит, поэтому
  // сразу отмечаем прочитанным (иначе после обновления вернётся бейдж).
  // Свои сообщения и уже отмеченные не трогаем.
  useEffect(() => {
    const last = messages[messages.length - 1]
    const key = messageKey(last)
    if (isOpening || !conversationId || !key || key === lastReadKeyRef.current) return
    lastReadKeyRef.current = key
    const senderId = last.sender?.id ?? last.senderId
    if (String(senderId ?? '') === String(user?.id ?? '')) return
    markConversationRead(conversationId)
  }, [conversationId, isOpening, markConversationRead, messages, user?.id])

  const handleSend = async (event) => {
    event.preventDefault()
    const content = newMessage.trim()
    if (!content || !conversationId || isSending) return
    setIsSending(true)
    try {
      const result = await sendMessage(conversationId, content, user.id)
      if (result?.success) {
        setNewMessage('')
        sendTyping(conversationId, false)
      }
    } finally {
      setIsSending(false)
    }
  }

  const handleMessageChange = (event) => {
    const value = event.target.value
    setNewMessage(value)
    if (!conversationId) return
    sendTyping(conversationId, value.trim().length > 0)
    window.clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = window.setTimeout(() => sendTyping(conversationId, false), 1200)
  }

  const handleUpload = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !conversationId || isUploading) return
    setIsUploading(true)
    setUploadError('')
    try {
      await uploadAttachment(conversationId, file)
    } catch (error) {
      // Сервер объясняет причину (тип или размер файла) — показываем её,
      // иначе файл просто «не отправлялся» без объяснений.
      console.error('Attachment upload failed:', error)
      setUploadError(error?.message || t('case_detail.chat_upload_error'))
    } finally {
      setIsUploading(false)
    }
  }

  const typingNames = Object.values(typingUsers[String(conversationId)] || {})
  const statusText = currentConversation?.activeManager?.fullName
    ? t('chat.taken_by', { name: currentConversation.activeManager.fullName })
    : t('chat.shared_queue')

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-teal-600" />
            {t('case_detail.section_chat')}
          </CardTitle>
          {currentConversation && <span className="truncate text-xs text-slate-500">{statusText}</span>}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div
          ref={listRef}
          onScroll={onListScroll}
          className="h-[26rem] space-y-3 overflow-y-auto overscroll-contain px-4 py-4"
        >
          {isOpening ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
            </div>
          ) : loadFailed ? (
            <p className="py-8 text-center text-sm text-slate-500">{t('case_detail.chat_load_error')}</p>
          ) : messages.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-slate-500">{t('chat.no_messages')}</p>
              <p className="mt-1 text-xs text-slate-400">{t('case_detail.chat_empty_hint')}</p>
            </div>
          ) : (
            messages.map((message) => {
              const senderId = message.sender?.id ?? message.senderId
              const isMe = String(senderId ?? '') === String(user?.id ?? '')
              const time = new Date(message.createdAt || message.time)
              const attachments = message.attachments || []
              const isReadByOther = Object.keys(message.readBy || {}).some((key) => key !== String(user?.id))
              const senderName = message.sender?.fullName || message.sender?.username

              return (
                <div key={message.documentId || message.id} className={cn('flex flex-col', isMe ? 'items-end' : 'items-start')}>
                  {!isMe && senderName && <span className="mb-1 px-1 text-xs text-slate-400">{senderName}</span>}
                  <div className={cn(
                    'max-w-[85%] rounded-2xl px-3.5 py-2.5',
                    isMe ? 'rounded-br-md bg-teal-600 text-white' : 'rounded-bl-md bg-slate-100 text-slate-900',
                  )}>
                    <p className="whitespace-pre-wrap break-words text-sm">{message.content}</p>
                    {attachments.length > 0 && (
                      <div className="mt-2 space-y-2">
                        {attachments.map((file) => {
                          const isImageFile = file.mime?.startsWith('image/') || message.messageType === 'image'
                          return (
                            <button
                              key={file.id || file.documentId || file.url}
                              type="button"
                              onClick={() => openMediaInNewTab(file)}
                              className={cn('block overflow-hidden rounded-lg border text-left', isMe ? 'border-teal-400/50' : 'border-slate-200')}
                            >
                              {isImageFile ? (
                                <AuthenticatedImage media={file} alt={file.name || 'Attachment'} className="max-h-40 max-w-full object-cover" />
                              ) : (
                                <span className={cn('block px-3 py-2 text-xs', isMe ? 'text-white' : 'text-slate-700')}>
                                  {file.name || 'Attachment'}
                                </span>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    )}
                    <p className={cn('mt-1 flex items-center justify-end gap-1 text-xs', isMe ? 'text-teal-100' : 'text-slate-400')}>
                      {!Number.isNaN(time.getTime()) && time.toLocaleString(dateLocale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      {isMe && <CheckCheck className={cn('h-3.5 w-3.5', isReadByOther ? 'opacity-100' : 'opacity-50')} />}
                    </p>
                  </div>
                </div>
              )
            })
          )}
          {typingNames.length > 0 && (
            <p className="px-1 text-xs text-slate-500">{t('case_detail.chat_typing', { names: typingNames.join(', ') })}</p>
          )}
        </div>

        {uploadError && (
          <p role="alert" className="border-t border-slate-100 px-4 pt-2 text-xs text-rose-600">{uploadError}</p>
        )}
        <form onSubmit={handleSend} className={cn('flex items-center gap-2 p-3', !uploadError && 'border-t border-slate-100')}>
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleUpload} />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            aria-label={t('chat.attach_file')}
            title={t('chat.attach_file')}
            disabled={!conversationId || isUploading}
            className="inline-flex shrink-0 rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
          >
            <Paperclip className="h-5 w-5" />
          </button>
          <input
            type="text"
            value={newMessage}
            onChange={handleMessageChange}
            placeholder={t('chat.message_placeholder')}
            disabled={!conversationId}
            className="min-w-0 flex-1 rounded-xl border-0 bg-slate-100 px-4 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-teal-500 sm:text-sm"
          />
          <Button
            type="submit"
            size="icon"
            aria-label={t('common.send')}
            disabled={!newMessage.trim() || !conversationId || isSending || isUploading}
            isLoading={isSending || isUploading}
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

export default CaseChatPanel
