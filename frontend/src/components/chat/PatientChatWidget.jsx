import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { MessageCircle, Minus, Paperclip, Send, X } from 'lucide-react'
import Button from '../ui/Button'
import { cn } from '../../utils/helpers'
import useAuthStore from '../../stores/authStore'
import useChatStore from '../../stores/chatStore'
import { getMediaUrl, medicalCasesAPI, normalizeResponse, openMediaInNewTab } from '../../services/api'

function PatientChatWidget() {
  const { user } = useAuthStore()
  const {
    conversations,
    currentConversation,
    messages,
    managerPresence,
    isLoading,
    connectSocket,
    fetchMessages,
    getOrCreateCaseConversation,
    sendMessage,
    sendTyping,
    uploadAttachment,
  } = useChatStore()
  const [isOpen, setIsOpen] = useState(false)
  const [activeCase, setActiveCase] = useState(null)
  const [draft, setDraft] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef(null)
  const endRef = useRef(null)

  const unreadCount = useMemo(
    () => conversations.reduce((sum, item) => sum + (item.unreadCount || 0), 0),
    [conversations],
  )

  useEffect(() => {
    connectSocket()
    medicalCasesAPI.getAll({ sort: 'updatedAt:desc' })
      .then((response) => {
        const { data } = normalizeResponse(response)
        const cases = Array.isArray(data) ? data : []
        setActiveCase(cases.find((item) => !['COMPLETED', 'CANCELLED'].includes(item.status)) || cases[0] || null)
      })
      .catch(() => {})
  }, [user?.id])

  useEffect(() => {
    if (!isOpen || !activeCase) return
    const caseId = activeCase.documentId || activeCase.id
    getOrCreateCaseConversation(caseId).then((conversation) => {
      if (conversation) fetchMessages(conversation.documentId || conversation.id)
    })
  }, [isOpen, activeCase?.documentId, activeCase?.id])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, isOpen])

  const conversationId = currentConversation?.documentId || currentConversation?.id

  const handleSend = async (event) => {
    event.preventDefault()
    if (!draft.trim() || !conversationId || isSending) return
    setIsSending(true)
    try {
      await sendMessage(conversationId, draft.trim(), user?.id)
      sendTyping(conversationId, false)
      setDraft('')
    } finally {
      setIsSending(false)
    }
  }

  const handleUpload = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !conversationId) return
    setIsUploading(true)
    try {
      await uploadAttachment(conversationId, file)
    } finally {
      setIsUploading(false)
    }
  }

  if (!user || user.userRole !== 'patient') return null

  return (
    <div className="fixed bottom-4 right-4 z-40">
      {!isOpen ? (
        <button
          type="button"
          onClick={() => {
            if ('Notification' in window && Notification.permission === 'default') {
              Notification.requestPermission().catch(() => {})
            }
            setIsOpen(true)
          }}
          className="relative w-14 h-14 rounded-full bg-teal-600 text-white shadow-lg shadow-teal-900/20 flex items-center justify-center hover:bg-teal-700"
          aria-label="Open chat"
        >
          <MessageCircle className="w-6 h-6" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-rose-500 text-[11px] font-semibold flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      ) : (
        <div className="w-[min(380px,calc(100vw-2rem))] h-[min(560px,calc(100vh-2rem))] bg-white border border-slate-200 rounded-xl shadow-2xl flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
            <div>
              <p className="font-semibold">MedTour chat</p>
              <p className={cn('text-xs', managerPresence.managerOnline ? 'text-emerald-300' : 'text-slate-300')}>
                {managerPresence.managerOnline ? 'Manager online' : 'We will reply later'}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/10 rounded-lg" aria-label="Minimize chat">
                <Minus className="w-4 h-4" />
              </button>
              <Link to="/patient/chat" className="p-2 hover:bg-white/10 rounded-lg" aria-label="Open full chat">
                <X className="w-4 h-4 rotate-45" />
              </Link>
            </div>
          </div>

          {!activeCase ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
              <p className="font-medium text-slate-900">No active case yet</p>
              <p className="text-sm text-slate-500 mt-1">Create a MedicalCase to start secure chat with MedTour.</p>
              <Link to="/patient/cases" className="mt-4">
                <Button size="sm">Open cases</Button>
              </Link>
            </div>
          ) : (
            <>
              <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3 bg-slate-50">
                {isLoading && messages.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-8">Loading chat...</p>
                ) : messages.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-8">Send us a message about your case.</p>
                ) : (
                  messages.map((message) => {
                    const isMe = message.sender?.id === user?.id
                    return (
                      <div key={message.documentId || message.id} className={cn('flex', isMe ? 'justify-end' : 'justify-start')}>
                        <div className={cn(
                          'max-w-[82%] rounded-xl px-3 py-2 text-sm',
                          isMe ? 'bg-teal-600 text-white' : 'bg-white border border-slate-200 text-slate-900',
                        )}>
                          <p className="whitespace-pre-wrap">{message.content}</p>
                          {(message.attachments || []).map((file) => {
                            const url = getMediaUrl(file)
                            return (
                              <button key={file.id || file.url} type="button" onClick={() => openMediaInNewTab(file)} className="block mt-2 text-left">
                                {file.mime?.startsWith('image/') && url ? (
                                  <img src={url} alt={file.name || 'Attachment'} className="max-h-32 rounded-lg object-cover" />
                                ) : (
                                  <span className={cn('text-xs underline', isMe ? 'text-teal-50' : 'text-teal-700')}>{file.name || 'Attachment'}</span>
                                )}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })
                )}
                <div ref={endRef} />
              </div>

              <form onSubmit={handleSend} className="p-3 border-t border-slate-100 flex items-center gap-2">
                <input ref={fileInputRef} type="file" className="hidden" onChange={handleUpload} />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
                  disabled={isUploading}
                  aria-label="Attach file"
                >
                  <Paperclip className="w-5 h-5" />
                </button>
                <input
                  value={draft}
                  onChange={(event) => {
                    setDraft(event.target.value)
                    if (conversationId) sendTyping(conversationId, event.target.value.trim().length > 0)
                  }}
                  className="flex-1 px-3 py-2 rounded-lg bg-slate-100 border-0 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="Message"
                />
                <Button type="submit" size="icon" disabled={!draft.trim() || isSending || isUploading} isLoading={isSending || isUploading}>
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default PatientChatWidget
