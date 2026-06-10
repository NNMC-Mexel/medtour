import { useState, useRef, useEffect } from 'react'
import { Send, Paperclip, Image, Smile, MoreVertical, Phone, Video, Search, Loader2, CheckCheck, ShieldCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import Avatar from '../ui/Avatar'
import Button from '../ui/Button'
import { cn, formatTimeAgo, getSpecName } from '../../utils/helpers'
import useChatStore from '../../stores/chatStore'
import useAuthStore from '../../stores/authStore'
import { getMediaUrl, appointmentsAPI, conversationsAPI, medicalCasesAPI, normalizeResponse, openMediaInNewTab } from '../../services/api'
import AuthenticatedImage from '../ui/AuthenticatedImage'

const ACTIVE_CASE_STATUSES = new Set([
  'NEW_LEAD',
  'REGISTERED',
  'WAITING_FOR_DOCUMENTS',
  'DOCUMENTS_UPLOADED',
  'UNDER_REVIEW',
  'DOCTOR_ASSIGNED',
  'WAITING_PATIENT_CONFIRMATION',
  'WAITING_PAYMENT',
  'CONSULTATION_BOOKED',
  'CONSULTATION_COMPLETED',
  'LOCAL_TREATMENT',
  'TREATMENT_IN_KAZAKHSTAN',
  'TRAVEL_PREPARATION',
  'ARRIVED_TO_KAZAKHSTAN',
  'IN_TREATMENT',
  'RECOVERY',
])

const getCaseId = (medicalCase) => medicalCase?.documentId || medicalCase?.id

function conversationCaseId(conversation) {
  const medicalCase = conversation?.medical_case
  if (!medicalCase) return null
  return medicalCase.documentId || medicalCase.id || medicalCase
}

const STAFF_CHAT_ROLES = new Set(['manager', 'coordinator', 'admin'])

const getPersonDisplayName = (person) => {
  if (!person) return ''
  return person.fullName || person.username || person.name || ''
}

function ChatComponent({ userRole = 'patient' }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const dateLocale = i18n.language === 'en' ? 'en-US' : i18n.language === 'kk' ? 'kk-KZ' : 'ru-RU'
  const { user } = useAuthStore()
  const { 
    conversations, 
    messages, 
    currentConversation,
    managerPresence,
    typingUsers,
    isLoading,
    fetchConversations, 
    fetchMessages, 
    sendMessage,
    sendTyping,
    uploadAttachment,
    markConversationRead,
    takeoverChat,
    setCurrentConversation,
  } = useChatStore()
  
  const [newMessage, setNewMessage] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const messagesEndRef = useRef(null)
  const fileInputRef = useRef(null)
  const typingTimeoutRef = useRef(null)

  // Past consultation chats (from appointment.chatLog)
  const [consultationChats, setConsultationChats] = useState([])
  const [selectedConsultation, setSelectedConsultation] = useState(null)
  const [isBootstrappingCases, setIsBootstrappingCases] = useState(false)

  useEffect(() => {
    let isMounted = true

    const loadChatIndex = async () => {
      const existingConversations = await fetchConversations()

      try {
        setIsBootstrappingCases(true)
        const response = await medicalCasesAPI.getAll({ sort: 'updatedAt:desc' })
        const { data } = normalizeResponse(response)
        const cases = Array.isArray(data) ? data : []
        const activeCases = cases.filter((item) => ACTIVE_CASE_STATUSES.has(item.status))
        const relevantCases = activeCases.length > 0 ? activeCases : cases

        if (userRole === 'patient') {
          const firstCase = relevantCases[0]
          const hasConversation = firstCase?.conversation || existingConversations.some((conversation) => (
            String(conversationCaseId(conversation)) === String(getCaseId(firstCase))
          ))
          if (firstCase && !hasConversation && isMounted) {
            const conversation = await conversationsAPI.getForCase(getCaseId(firstCase))
            const { data: createdConversation } = normalizeResponse(conversation)
            if (createdConversation && isMounted) {
              setCurrentConversation(createdConversation)
              await fetchConversations()
            }
          }
          return
        }

        if (['manager', 'coordinator', 'admin'].includes(userRole)) {
          const knownCaseIds = new Set(existingConversations.map((conversation) => String(conversationCaseId(conversation))).filter(Boolean))
          const casesWithoutConversation = relevantCases
            .filter((item) => !item.conversation && !knownCaseIds.has(String(getCaseId(item))))
            .slice(0, 50)

          if (casesWithoutConversation.length > 0) {
            await Promise.all(
              casesWithoutConversation.map((item) => (
                conversationsAPI.getForCase(getCaseId(item)).catch((error) => {
                  console.error('Error ensuring case conversation:', error)
                  return null
                })
              )),
            )
            if (isMounted) await fetchConversations()
          }
        }
      } catch (error) {
        console.error('Error bootstrapping case conversations:', error)
      } finally {
        if (isMounted) setIsBootstrappingCases(false)
      }
    }

    if (user?.id) {
      loadChatIndex()
    }

    return () => {
      isMounted = false
    }
  }, [user?.id, userRole])

  useEffect(() => {
    if (currentConversation?.id) {
      fetchMessages(currentConversation.documentId || currentConversation.id)
    }
  }, [currentConversation?.id, currentConversation?.documentId])

  useEffect(() => {
    const id = currentConversation?.documentId || currentConversation?.id
    if (id && messages.length > 0) markConversationRead(id)
  }, [currentConversation?.id, currentConversation?.documentId, messages.length])

  useEffect(() => {
    if (userRole === 'patient' && user?.id) {
      appointmentsAPI.getAll({ status: 'completed' })
        .then(res => {
          const data = res.data?.data || res.data || []
          const withChat = data.filter(a => a.chatLog?.length > 0)
          setConsultationChats(withChat)
        })
        .catch(() => {})
    }
  }, [user?.id, userRole])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSelectConversation = (conv) => {
    setSelectedConsultation(null)
    setCurrentConversation(conv)
  }

  const handleSelectConsultation = (apt) => {
    setCurrentConversation(null)
    setSelectedConsultation(apt)
  }

  const handleSendMessage = async (e) => {
    e.preventDefault()
    const conversationId = currentConversation?.documentId || currentConversation?.id
    if (!newMessage.trim() || !conversationId || isSending) return

    setIsSending(true)
    try {
      await sendMessage(conversationId, newMessage.trim(), user.id)
      setNewMessage('')
      sendTyping(conversationId, false)
    } catch (error) {
      console.error('Error sending message:', error)
    } finally {
      setIsSending(false)
    }
  }

  const handleMessageChange = (event) => {
    const value = event.target.value
    setNewMessage(value)
    const conversationId = currentConversation?.documentId || currentConversation?.id
    if (!conversationId) return
    sendTyping(conversationId, value.trim().length > 0)
    window.clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = window.setTimeout(() => sendTyping(conversationId, false), 1200)
  }

  const handleUpload = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    const conversationId = currentConversation?.documentId || currentConversation?.id
    if (!file || !conversationId || isUploading) return
    setIsUploading(true)
    try {
      await uploadAttachment(conversationId, file)
    } catch (error) {
      console.error('Attachment upload failed:', error)
    } finally {
      setIsUploading(false)
    }
  }

  const getParticipant = (conv) => {
    return conv.participants?.find(p => p.id !== user?.id) || {}
  }

  const getConversationDisplay = (conv) => {
    if (userRole === 'patient') {
      const manager = conv.activeManager || conv.medical_case?.manager || getParticipant(conv)
      return {
        person: manager,
        name: t('chat.manager'),
      }
    }

    if (STAFF_CHAT_ROLES.has(userRole)) {
      const patient = conv.medical_case?.patient || getParticipant(conv)
      return {
        person: patient,
        name: getPersonDisplayName(patient) || t('chat.patient'),
      }
    }

    const participant = getParticipant(conv)
    return {
      person: participant,
      name: getPersonDisplayName(participant) || t('chat.interlocutor'),
    }
  }

  const filteredConversations = conversations.filter(conv => {
    const { name } = getConversationDisplay(conv)
    return name.toLowerCase().includes(searchQuery.toLowerCase())
  })

  return (
    <div className="h-full min-h-0 flex bg-white border-y border-slate-200 sm:border sm:rounded-2xl overflow-hidden">
      {/* Conversations List */}
      <div className={cn(
        'w-full md:w-80 border-r border-slate-200 flex flex-col min-h-0',
        (currentConversation || selectedConsultation) && 'hidden md:flex'
      )}>
        {/* Search */}
        <div className="p-4 border-b border-slate-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder={t('common.search')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-100 border-0 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>

        {/* Conversations */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {isLoading || isBootstrappingCases ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-teal-600 animate-spin" />
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-slate-500 text-sm">{t('chat.no_conversations')}</p>
              <p className="text-slate-400 text-xs mt-1">
                {t('chat.no_conversations_hint')}
              </p>
            </div>
          ) : (
            filteredConversations.map((conversation) => {
              const { person: participant, name: participantName } = getConversationDisplay(conversation)
              const isOnline = participant.isOnline || false
              const spec = userRole === 'patient'
                ? getSpecName(participant.specialization, lang)
                : ''

              return (
                <button
                  key={conversation.id}
                  onClick={() => handleSelectConversation(conversation)}
                  className={cn(
                    'w-full p-4 flex items-start gap-3 hover:bg-slate-50 transition-colors text-left',
                    currentConversation?.id === conversation.id && 'bg-teal-50'
                  )}
                >
                  <div className="relative">
                    <Avatar
                      src={getMediaUrl(participant.avatar || participant.photo)}
                      name={participantName}
                      size="md"
                    />
                    {isOnline && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-slate-900 truncate">
                        {participantName}
                      </h4>
                      <span className="text-xs text-slate-400">
                      {conversation.lastMessage?.createdAt
                          ? formatTimeAgo(conversation.lastMessage.createdAt)
                          : ''}
                      </span>
                    </div>
                    {spec && <p className="text-xs text-teal-600">{spec}</p>}
                    <p className="text-sm text-slate-500 truncate">
                      {conversation.lastMessage?.content || conversation.lastMessage || t('chat.no_messages')}
                    </p>
                  </div>
                  {conversation.unreadCount > 0 && (
                    <span className="w-5 h-5 bg-teal-600 text-white text-xs font-medium rounded-full flex items-center justify-center">
                      {conversation.unreadCount}
                    </span>
                  )}
                </button>
              )
            })
          )}

          {/* Past consultation chats */}
          {consultationChats.length > 0 && (
            <>
              <div className="px-4 py-2 border-t border-slate-100">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">{t('chat.history_title')}</p>
              </div>
              {consultationChats.map((apt) => {
                const doctorName = apt.doctor?.fullName || t('booking.doctor_fallback')
                const spec = getSpecName(apt.doctor?.specialization, lang)
                const lastMsg = apt.chatLog?.[apt.chatLog.length - 1]
                const aptDate = new Date(apt.dateTime)
                return (
                  <button
                    key={apt.id}
                    onClick={() => handleSelectConsultation(apt)}
                    className={cn(
                      'w-full p-4 flex items-start gap-3 hover:bg-slate-50 transition-colors text-left',
                      selectedConsultation?.id === apt.id && 'bg-teal-50'
                    )}
                  >
                    <div className="relative">
                      <Avatar
                        src={getMediaUrl(apt.doctor?.photo)}
                        name={doctorName}
                        size="md"
                      />
                      <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-slate-200 border-2 border-white rounded-full flex items-center justify-center">
                        <Video className="w-2 h-2 text-slate-500" />
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-slate-900 truncate">{doctorName}</h4>
                        <span className="text-xs text-slate-400">
                          {aptDate.toLocaleDateString(dateLocale, { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                      {spec && <p className="text-xs text-teal-600">{spec}</p>}
                      <p className="text-sm text-slate-500 truncate">
                        {lastMsg?.text || t('chat.no_messages')}
                      </p>
                    </div>
                  </button>
                )
              })}
            </>
          )}
        </div>
      </div>

      {/* Chat Area */}
      {selectedConsultation ? (
        /* Read-only consultation chat history */
        <div className="flex-1 flex flex-col min-h-0">
          {/* Header */}
          <div className="p-4 border-b border-slate-100 flex items-center gap-3">
            <button
              onClick={() => setSelectedConsultation(null)}
              className="md:hidden p-2 hover:bg-slate-100 rounded-lg"
            >
              ←
            </button>
            <Avatar
              src={getMediaUrl(selectedConsultation.doctor?.photo)}
              name={selectedConsultation.doctor?.fullName || t('booking.doctor_fallback')}
              size="md"
            />
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-slate-900 truncate">
                {selectedConsultation.doctor?.fullName || t('booking.doctor_fallback')}
              </h3>
              <p className="text-sm text-slate-500">
                {t('chat.video_consultation')} &middot;{' '}
                {new Date(selectedConsultation.dateTime).toLocaleDateString(dateLocale, {
                  day: 'numeric', month: 'long', year: 'numeric',
                })}
              </p>
            </div>
            <span className="text-xs text-slate-400 bg-slate-100 px-2.5 py-1 rounded-lg">{t('chat.archive')}</span>
          </div>

          {/* Messages (read-only) */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 space-y-4">
            {selectedConsultation.chatLog.map((msg, idx) => {
              const currentUserName = user?.fullName || user?.username || ''
              const isMe = msg.senderName === currentUserName
              return (
                <div key={idx} className={cn('flex flex-col', isMe ? 'items-end' : 'items-start')}>
                  <span className="text-xs text-slate-400 mb-1 px-1">{msg.senderName}</span>
                  <div className={cn(
                    'max-w-[70%] rounded-2xl px-4 py-3',
                    isMe ? 'bg-teal-600 text-white rounded-br-md' : 'bg-slate-100 text-slate-900 rounded-bl-md'
                  )}>
                    <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                    {msg.time && (
                      <p className={cn('text-xs mt-1', isMe ? 'text-teal-100' : 'text-slate-400')}>
                        {new Date(msg.time).toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Read-only notice */}
          <div className="p-4 border-t border-slate-100 bg-slate-50">
            <p className="text-center text-sm text-slate-400">{t('chat.archive_notice')}</p>
          </div>
        </div>
      ) : currentConversation ? (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Chat Header */}
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setCurrentConversation(null)}
                className="md:hidden p-2 hover:bg-slate-100 rounded-lg"
              >
                ←
              </button>
              {(() => {
                const { person: participant, name: participantName } = getConversationDisplay(currentConversation)
                const isOnline = participant.isOnline || false
                const spec = userRole === 'patient'
                  ? getSpecName(participant.specialization, lang)
                  : ''
                const statusText = userRole === 'patient'
                  ? (managerPresence.managerOnline ? 'Manager online' : 'We will reply later')
                  : (currentConversation.activeManager?.fullName
                      ? `Taken by ${currentConversation.activeManager.fullName}`
                      : 'Shared queue')

                return (
                  <>
                    <Avatar
                      src={getMediaUrl(participant.avatar || participant.photo)}
                      name={participantName}
                      size="md"
                    />
                    <div>
                      <h3 className="font-semibold text-slate-900">{participantName}</h3>
                      <p className="text-sm text-slate-500">
                        {spec || (userRole === 'patient' ? '' : statusText)}
                        {isOnline && (
                          <span className="text-emerald-600 ml-2">{t('chat.online_status')}</span>
                        )}
                        {userRole === 'patient' && (
                          <span className={cn(managerPresence.managerOnline ? 'text-emerald-600' : 'text-slate-400')}>
                            {statusText}
                          </span>
                        )}
                      </p>
                    </div>
                  </>
                )
              })()}
            </div>
            <div className="flex items-center gap-2">
              <button className="hidden sm:inline-flex p-2 hover:bg-slate-100 rounded-lg text-slate-600">
                <Phone className="w-5 h-5" />
              </button>
              <button className="hidden sm:inline-flex p-2 hover:bg-slate-100 rounded-lg text-slate-600">
                <Video className="w-5 h-5" />
              </button>
              <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-600">
                <MoreVertical className="w-5 h-5" />
              </button>
              {['manager', 'coordinator', 'admin'].includes(userRole) && (
                <button
                  type="button"
                  onClick={() => takeoverChat(currentConversation.documentId || currentConversation.id)}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 text-white text-sm hover:bg-slate-800"
                >
                  <ShieldCheck className="w-4 h-4" />
                  Take over
                </button>
              )}
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-teal-600 animate-spin" />
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-slate-500">{t('chat.no_messages')}</p>
                <p className="text-slate-400 text-sm mt-1">{t('chat.start_dialog')}</p>
              </div>
            ) : (
              messages.map((message) => {
                const isMe = message.sender?.id === user?.id || message.senderId === user?.id
                const time = new Date(message.createdAt || message.time)
                const attachments = message.attachments || []
                const readBy = message.readBy || {}
                const isReadByOther = Object.keys(readBy).some((key) => key !== String(user?.id))

                return (
                  <div
                    key={message.id}
                    className={cn('flex', isMe ? 'justify-end' : 'justify-start')}
                  >
                    <div className={cn(
                      'max-w-[70%] rounded-2xl px-4 py-3',
                      isMe
                        ? 'bg-teal-600 text-white rounded-br-md'
                        : 'bg-slate-100 text-slate-900 rounded-bl-md'
                    )}>
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      {attachments.length > 0 && (
                        <div className="mt-2 space-y-2">
                          {attachments.map((file) => {
                            const isImageFile = file.mime?.startsWith('image/') || message.messageType === 'image'
                            return (
                              <button
                                key={file.id || file.documentId || file.url}
                                type="button"
                                onClick={() => openMediaInNewTab(file)}
                                className={cn(
                                  'block text-left rounded-lg overflow-hidden border',
                                  isMe ? 'border-teal-400/50' : 'border-slate-200'
                                )}
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
                      <p className={cn(
                        'text-xs mt-1 flex items-center gap-1 justify-end',
                        isMe ? 'text-teal-100' : 'text-slate-400'
                      )}>
                        {time.toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' })}
                        {isMe && <CheckCheck className={cn('w-3.5 h-3.5', isReadByOther ? 'opacity-100' : 'opacity-50')} />}
                      </p>
                    </div>
                  </div>
                )
              })
            )}
            {(() => {
              const id = currentConversation?.documentId || currentConversation?.id
              const names = Object.values(typingUsers[String(id)] || {})
              if (names.length === 0) return null
              return <p className="text-xs text-slate-500 px-1">{names.join(', ')} typing...</p>
            })()}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input */}
          <form onSubmit={handleSendMessage} className="p-3 sm:p-4 border-t border-slate-100 safe-bottom sm:pb-4">
            <div className="flex items-center gap-2">
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleUpload} />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="hidden sm:inline-flex p-2 hover:bg-slate-100 rounded-lg text-slate-500"
                disabled={isUploading}
              >
                <Paperclip className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="hidden sm:inline-flex p-2 hover:bg-slate-100 rounded-lg text-slate-500"
                disabled={isUploading}
              >
                <Image className="w-5 h-5" />
              </button>
              <input
                type="text"
                value={newMessage}
                onChange={handleMessageChange}
                placeholder={t('chat.message_placeholder')}
                className="flex-1 px-4 py-3 bg-slate-100 border-0 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <button type="button" className="hidden sm:inline-flex p-2 hover:bg-slate-100 rounded-lg text-slate-500">
                <Smile className="w-5 h-5" />
              </button>
              <Button
                type="submit"
                size="icon"
                disabled={!newMessage.trim() || isSending || isUploading}
                isLoading={isSending || isUploading}
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </form>
        </div>
      ) : (
        // Empty State
        <div className="hidden md:flex flex-1 items-center justify-center bg-slate-50">
          <div className="text-center">
            <div className="w-20 h-20 mx-auto bg-slate-200 rounded-full flex items-center justify-center mb-4">
              <Send className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-2">
              {t('chat.select_dialog')}
            </h3>
            <p className="text-slate-500">
              {t('chat.select_dialog_hint')}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export default ChatComponent
