import { useState, useCallback, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  MessageCircle,
  Maximize,
  Minimize,
  Clock,
  Copy,
  Check,
  AlertCircle,
  Loader2,
  Send,
  X,
  Upload,
  FileText,
  Save,
  ChevronLeft,
  ChevronRight,
  Stethoscope,
  ClipboardList,
  Settings,
  MoreVertical,
  User,
  Link as LinkIcon,
  FolderOpen,
  Folder,
  ChevronDown,
  ExternalLink,
  Star,
  PhoneOff,
  Paperclip,
  Download,
  Image,
  RefreshCw,
  Hourglass,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { io } from 'socket.io-client'
import Button from '../components/ui/Button'
import Avatar from '../components/ui/Avatar'
import { useToast } from '../components/ui/Toast'
import { cn, getSpecName } from '../utils/helpers'
import useAuthStore from '../stores/authStore'
import api, { appointmentsAPI, documentsAPI, uploadFile, getSignalingUrl, openMediaInNewTab, getServerNow } from '../services/api'
import { formatDateTimeInTimeZone, getDeviceTimeZone, KAZAKHSTAN_TIME_ZONE } from '../utils/kazakhstanTime'
import { MEDIA_KIND, MEDIA_REASON, acquireLocalMedia, describeMediaOutcome } from '../utils/mediaAccess'
import { playChatChime } from '../utils/audioCues'
import { isChatSurfaceVisible, isOwnChatMessage, resolveIncomingChatSignal } from '../utils/chatSignals'
import { CONSULTATION_SURFACE, isNegotiationInitiator, resolveConsultationSurface } from '../utils/consultationFlow'

// Подсказку «браузер не умеет» или «нужен HTTPS» бессмысленно писать отдельно
// про камеру и отдельно про микрофон — причина одна на оба устройства.
const SHARED_MEDIA_REASONS = new Set([MEDIA_REASON.UNSUPPORTED, MEDIA_REASON.INSECURE])
const mediaStringKey = (kind, reason) =>
  SHARED_MEDIA_REASONS.has(reason)
    ? `video.media.common.${reason}`
    : `video.media.${kind}.${reason}`

const _TURN_USER = import.meta.env.VITE_TURN_USERNAME || '';
const _TURN_CRED = import.meta.env.VITE_TURN_CREDENTIAL || '';
const _TURN_URL  = import.meta.env.VITE_TURN_URL     || ''; // turn:host:3478
const _TURN_TCP  = import.meta.env.VITE_TURN_URL_TCP || ''; // turn:host:443?transport=tcp

const _TURN_INTERNAL = import.meta.env.VITE_TURN_INTERNAL || '';
const _HAS_TURN_CREDENTIALS = Boolean(_TURN_USER && _TURN_CRED);

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    // TURN внутренний IP (для пользователей в кампусе — обходит hairpin NAT)
    ...(_TURN_INTERNAL && _HAS_TURN_CREDENTIALS ? [{ urls: _TURN_INTERNAL,                          username: _TURN_USER, credential: _TURN_CRED }] : []),
    ...(_TURN_INTERNAL && _HAS_TURN_CREDENTIALS ? [{ urls: _TURN_INTERNAL + '?transport=tcp',       username: _TURN_USER, credential: _TURN_CRED }] : []),
    // TURN UDP публичный (основной для внешних пользователей)
    ...(_TURN_URL && _HAS_TURN_CREDENTIALS ? [{ urls: _TURN_URL,                          username: _TURN_USER, credential: _TURN_CRED }] : []),
    // TURN TCP публичный
    ...(_TURN_URL && _HAS_TURN_CREDENTIALS ? [{ urls: _TURN_URL + '?transport=tcp',       username: _TURN_USER, credential: _TURN_CRED }] : []),
    // TURNS TLS (резерв для строгих корпоративных файрволов)
    ...(_TURN_TCP && _HAS_TURN_CREDENTIALS ? [{ urls: _TURN_TCP,                          username: _TURN_USER, credential: _TURN_CRED }] : []),
    // ВНИМАНИЕ: публичный open relay удалён — медицинские данные не должны
    // проходить через сторонние серверы. Настройте VITE_TURN_URL для production.
  ],
}

/**
 * Временные учётные данные TURN от сервера (coturn `use-auth-secret`).
 * Статические VITE_TURN_* видны каждому, кто скачал бандл; они остаются только
 * запасным вариантом, пока на сервере не задан TURN_STATIC_AUTH_SECRET.
 */
const fetchEphemeralIceServers = async () => {
  try {
    const { data } = await api.get('/api/turn-credentials')
    const payload = data?.data
    if (!payload?.username || !payload?.credential || !payload?.urls?.length) return null
    return payload.urls.map((urls) => ({ urls, username: payload.username, credential: payload.credential }))
  } catch {
    return null
  }
}

/**
 * `?force-relay=1` — отладка: только TURN relay, без host/srflx. Внутри одной
 * сети звонок идёт напрямую, и relay не проверяется вовсе; собеседник за
 * границей почти всегда за симметричным NAT и зависит от relay целиком. Флаг
 * воспроизводит этот путь двумя клиентами рядом.
 */
const shouldForceRelay = () => {
  try {
    return new URLSearchParams(window.location.search).get('force-relay') === '1'
  } catch {
    return false
  }
}

// Отметка начала звонка живёт вне React-состояния: после обновления страницы
// счётчик продолжает идти, а не начинается с 00:00. Протухшую отметку (звонок
// не завершили кнопкой и вернулись в ту же комнату позже) отбрасываем.
const CALL_START_STORAGE_PREFIX = 'consultation:call-start:'
const CALL_START_MAX_AGE_MS = 12 * 60 * 60 * 1000

function readCallStart(roomId) {
  if (!roomId) return null
  try {
    const value = Number(window.localStorage.getItem(CALL_START_STORAGE_PREFIX + roomId))
    if (!Number.isFinite(value) || value <= 0) return null
    if (Date.now() - value > CALL_START_MAX_AGE_MS) {
      window.localStorage.removeItem(CALL_START_STORAGE_PREFIX + roomId)
      return null
    }
    return value
  } catch {
    return null
  }
}

function writeCallStart(roomId, value) {
  if (!roomId) return
  try {
    window.localStorage.setItem(CALL_START_STORAGE_PREFIX + roomId, String(value))
  } catch {
    /* приватный режим — счётчик просто пойдёт с нуля */
  }
}

function clearCallStart(roomId) {
  if (!roomId) return
  try {
    window.localStorage.removeItem(CALL_START_STORAGE_PREFIX + roomId)
  } catch {
    /* см. writeCallStart */
  }
}

const SIGNALING_SERVER = getSignalingUrl();

function VideoConsultation({
  roomId: roomIdProp,
  isMinimized = false,
  onMinimize,
  onRestore,
  onClose,
} = {}) {
  const { roomId: routeRoomId } = useParams()
  const roomId = roomIdProp || routeRoomId
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const timeLocale = i18n.language === 'kk' ? 'kk-KZ' : i18n.language === 'en' ? 'en-US' : 'ru-RU'
  const { user, token } = useAuthStore()
  const toast = useToast()

  const [connectionState, setConnectionState] = useState('initializing')
  // Результат запроса камеры/микрофона: каждое устройство отдельно, чтобы
  // отсутствие одного не закрывало вход в комнату.
  const [mediaOutcome, setMediaOutcome] = useState(null)
  const [mediaNoticeDismissed, setMediaNoticeDismissed] = useState(false)
  const [mediaAttempt, setMediaAttempt] = useState(0)
  const allowNoDevicesRef = useRef(false)
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOn, setIsVideoOn] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [sidebarTab, setSidebarTab] = useState('chat') // 'chat' | 'notes'
  const [duration, setDuration] = useState(0)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [error, setError] = useState(null)
  const [appointment, setAppointment] = useState(null)
  const [linkCopied, setLinkCopied] = useState(false)
  const [remoteUser, setRemoteUser] = useState(null)
  const [remoteVideoPortrait, setRemoteVideoPortrait] = useState(true)
  const [remoteIsPortrait, setRemoteIsPortrait] = useState(false)
  const [containerHeight, setContainerHeight] = useState(0)
  const isMobileDevice = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)

  // Непрочитанные сообщения чата: счётчик растёт, пока чат не на экране
  // (панель закрыта, открыта другая вкладка, звонок свёрнут или страница в фоне).
  const [unreadChatCount, setUnreadChatCount] = useState(0)
  // Обработчик 'chat-message' навешивается один раз, поэтому видимость чата
  // читаем через ref — иначе в замыкании навсегда останется начальное значение.
  const chatVisibilityRef = useRef({ sidebarOpen: true, sidebarTab: 'chat', isMinimized: false })
  const lastChimeAtRef = useRef(null)
  const isChatVisible = isChatSurfaceVisible({
    sidebarOpen,
    sidebarTab,
    isMinimized,
    documentVisibility: typeof document === 'undefined' ? 'visible' : document.visibilityState,
  })

  useEffect(() => {
    chatVisibilityRef.current = { sidebarOpen, sidebarTab, isMinimized }
  }, [sidebarOpen, sidebarTab, isMinimized])

  useEffect(() => {
    if (isChatVisible) setUnreadChatCount(0)
  }, [isChatVisible, messages.length])

  // Возврат на вкладку при открытом чате тоже снимает отметку.
  useEffect(() => {
    const onVisibility = () => {
      if (isChatSurfaceVisible({ ...chatVisibilityRef.current, documentVisibility: document.visibilityState })) {
        setUnreadChatCount(0)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  // Серверная проверка временного окна подключения.
  // 'checking' | 'allowed' | 'denied'. Девайсные часы здесь не используются —
  // авторитет только у сервера.
  const [accessStatus, setAccessStatus] = useState('checking')
  const [accessDenyInfo, setAccessDenyInfo] = useState(null)
  // Окно комнаты по серверному времени: до какого момента доступна консультация.
  const [roomWindow, setRoomWindow] = useState(null)
  const [roomRemainingMs, setRoomRemainingMs] = useState(null)

  // Notes state
  const [notesTab, setNotesTab] = useState('diagnosis')
  const [diagnosisText, setDiagnosisText] = useState('')
  const [diagnosisFile, setDiagnosisFile] = useState(null)
  const [isSavingDiagnosis, setIsSavingDiagnosis] = useState(false)
  const [diagnosisSaved, setDiagnosisSaved] = useState(false)
  // Track existing document IDs to update instead of create duplicates
  const [existingDocIds, setExistingDocIds] = useState({ certificate: null })
  const [patientDocuments, setPatientDocuments] = useState([])
  const [isLoadingDocs, setIsLoadingDocs] = useState(false)

  // Rating state (patient)
  const [showRatingModal, setShowRatingModal] = useState(false)
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [reviewText, setReviewText] = useState('')
  const [isSubmittingRating, setIsSubmittingRating] = useState(false)

  // Chat file upload state (patient attaches docs during consultation)
  const [isUploadingChatFile, setIsUploadingChatFile] = useState(false)
  const chatFileInputRef = useRef(null)

  // Call termination state. `leave` only disconnects the current participant,
  // while `complete` also completes the appointment for both participants.
  const [isCompletingCall, setIsCompletingCall] = useState(false)
  const [pendingEndAction, setPendingEndAction] = useState(null)
  // На телефоне выход — через шторку: врачу здесь же предлагается завершить
  // приём, пациент подтверждает выход.
  const [showLeaveSheet, setShowLeaveSheet] = useState(false)

  useEffect(() => {
    if (!showLeaveSheet) return undefined
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setShowLeaveSheet(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [showLeaveSheet])

  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const localStreamRef = useRef(null)
  const remoteStreamRef = useRef(null)
  const peerConnectionRef = useRef(null)
  const socketRef = useRef(null)
  const videoContainerRef = useRef(null)
  const miniWindowRef = useRef(null)
  const miniDragRef = useRef(null)
  const activeSocketRef = useRef(null)
  const reconnectAttemptsRef = useRef(0)
  const reconnectTimerRef = useRef(null)
  const pendingIceCandidatesRef = useRef([])
  // socketId собеседника текущего раунда согласования: по нему отбрасываем
  // offer/answer/кандидаты, опоздавшие от предыдущего соединения.
  const peerSocketIdRef = useRef(null)
  const makingOfferRef = useRef(false)
  const iceServersRef = useRef(ICE_SERVERS)
  const isEndingCallRef = useRef(false)
  const [miniPosition, setMiniPosition] = useState(null)

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 640) {
      setSidebarOpen(false)
    }
  }, [])
  const chatEndRef = useRef(null)

  const isDoctor = user?.userRole === 'doctor'

  const getMiniBounds = useCallback(() => {
    const viewportWidth = window.visualViewport?.width || window.innerWidth
    const viewportHeight = window.visualViewport?.height || window.innerHeight
    const rootStyles = window.getComputedStyle(document.documentElement)
    const safeTop = parseFloat(rootStyles.getPropertyValue('--safe-top')) || 0
    const safeRight = parseFloat(rootStyles.getPropertyValue('--safe-right')) || 0
    const safeBottom = parseFloat(rootStyles.getPropertyValue('--safe-bottom')) || 0
    const safeLeft = parseFloat(rootStyles.getPropertyValue('--safe-left')) || 0
    const rect = miniWindowRef.current?.getBoundingClientRect()
    const fallbackWidth = viewportWidth < 640 ? 224 : 320
    const fallbackHeight = viewportWidth < 640 ? 238 : 292
    const width = rect?.width || fallbackWidth
    const height = rect?.height || fallbackHeight
    const edgeGap = viewportWidth < 640 ? 12 : 20
    const bottomNavigationGap = viewportWidth < 640 ? 76 : 0

    return {
      width,
      height,
      minX: edgeGap + safeLeft,
      minY: edgeGap + safeTop,
      maxX: Math.max(edgeGap + safeLeft, viewportWidth - width - edgeGap - safeRight),
      maxY: Math.max(edgeGap + safeTop, viewportHeight - height - edgeGap - safeBottom - bottomNavigationGap),
    }
  }, [])

  const clampMiniPosition = useCallback((position) => {
    const bounds = getMiniBounds()
    return {
      x: Math.min(Math.max(position.x, bounds.minX), bounds.maxX),
      y: Math.min(Math.max(position.y, bounds.minY), bounds.maxY),
    }
  }, [getMiniBounds])

  const getInitialMiniPosition = useCallback(() => {
    const bounds = getMiniBounds()
    return { x: bounds.maxX, y: bounds.maxY }
  }, [getMiniBounds])

  const snapMiniToNearestEdge = useCallback((position) => {
    const bounds = getMiniBounds()
    const centerX = position.x + bounds.width / 2
    const viewportWidth = window.visualViewport?.width || window.innerWidth
    return clampMiniPosition({
      x: centerX < viewportWidth / 2 ? bounds.minX : bounds.maxX,
      y: position.y,
    })
  }, [clampMiniPosition, getMiniBounds])

  const attachMediaStreams = useCallback(() => {
    if (localVideoRef.current && localStreamRef.current) {
      if (localVideoRef.current.srcObject !== localStreamRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current
      }
      localVideoRef.current.play()?.catch(() => {})
    }
    if (remoteVideoRef.current && remoteStreamRef.current) {
      if (remoteVideoRef.current.srcObject !== remoteStreamRef.current) {
        remoteVideoRef.current.srcObject = remoteStreamRef.current
      }
      remoteVideoRef.current.play()?.catch(() => {})
    }
  }, [])

  useEffect(() => {
    attachMediaStreams()
  }, [attachMediaStreams, isMinimized])

  useEffect(() => {
    if (!isMinimized) return
    const updatePosition = () => {
      setMiniPosition((current) => clampMiniPosition(current || getInitialMiniPosition()))
    }

    window.requestAnimationFrame(updatePosition)
    window.addEventListener('resize', updatePosition, { passive: true })
    window.addEventListener('orientationchange', updatePosition, { passive: true })
    window.visualViewport?.addEventListener('resize', updatePosition, { passive: true })
    window.visualViewport?.addEventListener('scroll', updatePosition, { passive: true })

    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('orientationchange', updatePosition)
      window.visualViewport?.removeEventListener('resize', updatePosition)
      window.visualViewport?.removeEventListener('scroll', updatePosition)
    }
  }, [clampMiniPosition, getInitialMiniPosition, isMinimized])

  const handleMiniPointerDown = (event) => {
    // Controls inside the floating window must receive the first pointer event.
    // Otherwise pointer capture for dragging can swallow the subsequent click.
    if (event.target.closest('button, a, input, textarea, select, label, [data-no-drag]')) return
    const startPosition = miniPosition || getInitialMiniPosition()
    miniDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: startPosition.x,
      originY: startPosition.y,
      hasMoved: false,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handleMiniPointerMove = (event) => {
    const drag = miniDragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const deltaX = event.clientX - drag.startX
    const deltaY = event.clientY - drag.startY
    if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
      drag.hasMoved = true
    }
    setMiniPosition(clampMiniPosition({
      x: drag.originX + deltaX,
      y: drag.originY + deltaY,
    }))
  }

  const handleMiniPointerUp = (event) => {
    const drag = miniDragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    miniDragRef.current = null
    setMiniPosition((current) => {
      const next = current || getInitialMiniPosition()
      return drag.hasMoved ? snapMiniToNearestEdge(next) : next
    })
  }

  // Track video container height for portrait rotation sizing
  useEffect(() => {
    if (!videoContainerRef.current) return
    const observer = new ResizeObserver(entries => {
      const entry = entries[0]
      if (entry) setContainerHeight(entry.contentRect.height)
    })
    observer.observe(videoContainerRef.current)
    return () => observer.disconnect()
  }, [])

  // Re-emit orientation when device rotates (mobile)
  useEffect(() => {
    const handleOrientationChange = () => {
      socketRef.current?.emit('orientation-update', {
        isPortrait: window.innerHeight > window.innerWidth,
      })
    }
    window.addEventListener('orientationchange', handleOrientationChange)
    return () => window.removeEventListener('orientationchange', handleOrientationChange)
  }, [roomId])

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Серверный gate: canJoin по серверному времени.
  useEffect(() => {
    let cancelled = false
    const check = async () => {
      if (!roomId) return
      try {
        const res = await appointmentsAPI.canJoin(roomId)
        if (cancelled) return
        const payload = res?.data?.data || res?.data || {}
        if (payload.allowed) {
          setAccessStatus('allowed')
          setRoomWindow({
            windowEnd: payload.windowEnd,
            consultationDuration: payload.consultationDuration,
          })
        } else {
          setAccessStatus('denied')
          setAccessDenyInfo({
            reason: payload.reason,
            dateTime: payload.dateTime,
            windowStart: payload.windowStart,
            windowEnd: payload.windowEnd,
            serverTime: payload.serverTime,
          })
        }
      } catch (err) {
        if (cancelled) return
        const status = err?.response?.status
        setAccessStatus('denied')
        setAccessDenyInfo({
          reason: status === 403 ? 'not_participant' : status === 404 ? 'not_found' : 'error',
        })
      }
    }
    check()
    return () => {
      cancelled = true
    }
  }, [roomId])

  // Свёрнутая комната, оказавшаяся недоступной (окно закрылось, запись
  // отменена), снимается со стора сама — иначе она висела бы невидимой до
  // перезагрузки, а раньше и вовсе перекрывала весь экран отказом.
  useEffect(() => {
    if (isMinimized && accessStatus === 'denied') onClose?.()
  }, [isMinimized, accessStatus, onClose])

  useEffect(() => {
    const fetchAppointment = async () => {
      if (!roomId) return
      try {
        const query = new URLSearchParams()
        query.append('filters[roomId][$eq]', roomId)
        query.append('populate[doctor][populate][0]', 'specialization')
        query.append('populate[doctor][populate][1]', 'photo')
        query.append('populate[patient][fields][0]', 'id')
        query.append('populate[patient][fields][1]', 'fullName')
        query.append('populate[patient][fields][2]', 'email')
        query.append('populate[patient][fields][3]', 'phone')
        query.append('populate[patient][fields][4]', 'avatar')
        query.append('populate[medical_case][fields][0]', 'id')
        query.append('populate[medical_case][fields][1]', 'documentId')
        query.append('populate[medical_case][fields][2]', 'status')

        const response = await api.get(`/api/appointments?${query}`)
        const apt = response.data?.data?.[0]
        if (apt) setAppointment(apt)
      } catch (err) {
        console.error('Error fetching appointment:', err)
      }
    }
    fetchAppointment()
  }, [roomId])

  // Fetch documents through the medical case access boundary. This keeps the
  // live consultation, case workspace and manager view on the same document set.
  // Legacy appointments without a case retain the old patient-scoped fallback.
  useEffect(() => {
    const fetchPatientDocs = async () => {
      if (!isDoctor || !appointment?.patient?.id) return
      setIsLoadingDocs(true)
      try {
        const caseId = appointment.medical_case?.documentId || appointment.medical_case?.id
        const response = caseId
          ? await documentsAPI.getByCase(caseId)
          : await documentsAPI.getAll({ userId: appointment.patient.id })
        const docs = response.data?.data || []
        setPatientDocuments(docs)

        // Pre-fill forms with existing documents for this appointment
        const aptId = appointment.documentId || appointment.id
        const aptDocs = docs.filter(d => {
          const docAptId = d.appointment?.documentId || d.appointment?.id
          return docAptId && String(docAptId) === String(aptId)
        })
        const ids = { certificate: null }
        for (const doc of aptDocs) {
          const docId = doc.documentId || doc.id
          if (doc.type === 'certificate' && !ids.certificate) {
            ids.certificate = docId
            setDiagnosisText(doc.description || '')
            if (doc.file) setDiagnosisFile(doc.file)
          }
        }
        setExistingDocIds(ids)
      } catch (err) {
        console.error('Error fetching patient documents:', err)
      } finally {
        setIsLoadingDocs(false)
      }
    }
    fetchPatientDocs()
  }, [appointment?.documentId, appointment?.id, appointment?.patient?.id, appointment?.medical_case?.documentId, appointment?.medical_case?.id, isDoctor])

  const getParticipantInfo = () => {
    if (!appointment) {
      if (remoteUser?.userName) {
        return { name: remoteUser.userName, role: remoteUser.userRole === 'doctor' ? t('video.doctor') : t('video.patient') }
      }
      return { name: t('video.waiting_label'), role: '' }
    }

    if (isDoctor) {
      const patientName = remoteUser?.userName ||
                          appointment.patient?.fullName ||
                          appointment.patient?.username ||
                          appointment.patient?.email?.split('@')[0] ||
                          t('video.patient')
      return {
        name: patientName,
        role: t('video.patient')
      }
    }

    const doctorName = appointment.doctor?.fullName ||
                       remoteUser?.userName ||
                       t('video.doctor')
    return {
      name: doctorName,
      role: getSpecName(appointment.doctor?.specialization, i18n.language) || t('video.specialist')
    }
  }

  const participant = getParticipantInfo()

  useEffect(() => {
    // Не инициализируем WebRTC/медиа до подтверждения серверного окна.
    if (accessStatus !== 'allowed') return
    let mounted = true

    const init = async () => {
      try {
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
        const media = await acquireLocalMedia({
          getUserMedia: (request) => navigator.mediaDevices.getUserMedia(request),
          videoConstraints: isMobile ? { facingMode: { ideal: 'user' } } : { width: { ideal: 1280 }, height: { ideal: 720 } },
          audioConstraints: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          isSupported: Boolean(navigator.mediaDevices?.getUserMedia),
          isSecureContext: window.isSecureContext !== false,
        })

        if (!mounted) {
          media.stream?.getTracks().forEach(track => track.stop())
          return
        }

        const outcome = describeMediaOutcome(media)
        setMediaOutcome(outcome)
        setMediaNoticeDismissed(false)

        // Ни камеры, ни микрофона: сначала объясняем, что случилось, и даём
        // выбрать между повтором и входом «только смотреть и слушать».
        if (outcome.needsConfirmation && !allowNoDevicesRef.current) {
          media.stream?.getTracks().forEach(track => track.stop())
          setConnectionState('media-blocked')
          return
        }

        const stream = media.stream
        localStreamRef.current = stream || null
        if (stream && localVideoRef.current) {
          localVideoRef.current.srcObject = stream
        }
        // Кнопки отражают реальное положение дел: без дорожки нечего включать.
        setIsVideoOn(Boolean(stream?.getVideoTracks().length))
        setIsMuted(!stream?.getAudioTracks().length)

        // Временные TURN-учётки — до первого соединения, иначе первый звонок
        // ушёл бы со статическими (или вовсе без relay).
        const ephemeralTurn = await fetchEphemeralIceServers()
        if (!mounted) {
          stream?.getTracks().forEach(track => track.stop())
          return
        }
        if (ephemeralTurn) {
          iceServersRef.current = {
            iceServers: [...ICE_SERVERS.iceServers.filter((entry) => !entry.username), ...ephemeralTurn],
          }
        }

        const socket = io(SIGNALING_SERVER, {
          transports: ['websocket', 'polling'],
          auth: { token },
        })
        socketRef.current = socket

        socket.on('connect', () => {
          socket.emit('join-room', {
            roomId,
            isPortrait: window.innerHeight > window.innerWidth,
          })
          socket.emit('orientation-update', {
            isPortrait: window.innerHeight > window.innerWidth,
          })
          setConnectionState('waiting')
        })

        socket.on('connect_error', () => {
          setError(t('video.conn_error'))
          setConnectionState('failed')
        })

        socket.on('join-room-error', ({ reason } = {}) => {
          setError(reason === 'Access denied'
            ? t('video.no_access')
            : t('video.room_error'))
          setConnectionState('failed')
        })

        socket.on('room-participants', (participants) => {
          if (participants.length > 0) {
            const peer = participants[0]
            setRemoteUser(peer)
            setRemoteIsPortrait(peer.isPortrait ?? false)
            startNegotiation(socket, peer.socketId)
          }
        })

        socket.on('user-joined', async (data) => {
          setRemoteUser(data)
          setConnectionState('connecting')
          setRemoteIsPortrait(data.isPortrait ?? false)
          // Re-send our orientation to the newly joined user
          socket.emit('orientation-update', {
            isPortrait: window.innerHeight > window.innerWidth,
          })

          startNegotiation(socket, data.socketId)
        })

        socket.on('offer', async ({ senderSocketId, offer }) => {
          setConnectionState('connecting')
          const pc = ensurePeerConnection(socket, senderSocketId)

          try {
            await pc.setRemoteDescription(new RTCSessionDescription(offer))
            await flushPendingIceCandidates(pc)
            const answer = await pc.createAnswer()
            await pc.setLocalDescription(answer)
            socket.emit('answer', { targetSocketId: senderSocketId, answer })
          } catch (err) {
            console.error('Error handling offer:', err)
          }
        })

        socket.on('answer', async ({ senderSocketId, answer }) => {
          const pc = peerConnectionRef.current
          // Ответ прошлого раунда согласования к новому соединению не применяем.
          const currentPeer = peerSocketIdRef.current
          if (!pc || (senderSocketId && currentPeer && senderSocketId !== currentPeer)) return
          if (pc.signalingState !== 'have-local-offer') {
            console.warn('[WebRTC] Ignoring answer in state', pc.signalingState)
            return
          }
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(answer))
            await flushPendingIceCandidates(pc)
          } catch (err) {
            console.error('Error setting remote description:', err)
          }
        })

        socket.on('ice-candidate', async ({ senderSocketId, candidate }) => {
          // Отбрасываем только заведомо чужие кандидаты; пока собеседник не
          // зафиксирован, кандидат уходит в очередь — терять его нельзя.
          const currentPeer = peerSocketIdRef.current
          if (senderSocketId && currentPeer && senderSocketId !== currentPeer) return
          await addIceCandidateSafely(candidate)
        })

        socket.on('user-left', () => {
          // User genuinely left — reset reconnect state
          reconnectAttemptsRef.current = 0
          clearTimeout(reconnectTimerRef.current)
          setRemoteUser(null)
          setConnectionState('waiting')
          remoteStreamRef.current = null
          if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null
          if (peerConnectionRef.current) {
            peerConnectionRef.current.close()
            peerConnectionRef.current = null
          }
          peerSocketIdRef.current = null
          pendingIceCandidatesRef.current = []
          makingOfferRef.current = false
        })

        // История чата при переподключении (восстановление после refresh)
        socket.on('chat-history', (history) => {
          const currentUserId = String(user?.id ?? '')
          setMessages(history.map(data => ({
            id: data.id,
            sender: data.userId != null && String(data.userId) === currentUserId ? 'me' : 'other',
            text: data.message,
            attachment: data.attachment || null,
            senderName: data.senderName,
            time: new Date(data.timestamp),
          })))
        })

        socket.on('chat-message', (data) => {
          const isOwn = isOwnChatMessage(data, user?.id)
          setMessages(prev => [...prev, {
            id: data.id,
            sender: isOwn ? 'me' : 'other',
            text: data.message,
            attachment: data.attachment || null,
            senderName: data.senderName,
            time: new Date(data.timestamp),
          }])

          // Глаза на видео, а не на чате: сообщение собеседника сопровождаем
          // сигналом (не чаще раза в 1,2 с) и счётчиком, пока чат не виден.
          const { playChime, countUnread, nextChimeAt } = resolveIncomingChatSignal({
            isOwnMessage: isOwn,
            chatVisible: isChatSurfaceVisible({
              ...chatVisibilityRef.current,
              documentVisibility: document.visibilityState,
            }),
            now: Date.now(),
            lastChimeAt: lastChimeAtRef.current,
          })
          lastChimeAtRef.current = nextChimeAt
          if (playChime) {
            playChatChime()
            navigator.vibrate?.([30, 60, 30])
          }
          if (countUnread) setUnreadChatCount((count) => count + 1)
        })

        socket.on('remote-orientation-update', ({ isPortrait }) => {
          setRemoteIsPortrait(isPortrait)
        })

        // Врач принудительно завершил звонок — пациент видит модалку с оценкой
        socket.on('call-force-ended', () => {
          cleanupCall()
          setShowRatingModal(true)
        })

      } catch (err) {
        console.error('Error initializing:', err)
        if (mounted) {
          setError(t('video.media_error'))
          setConnectionState('failed')
        }
      }
    }

    init()

    return () => {
      mounted = false
      localStreamRef.current?.getTracks().forEach(track => track.stop())
      peerConnectionRef.current?.close()
      socketRef.current?.emit('leave-room')
      socketRef.current?.disconnect()
    }
  }, [roomId, user?.id, user?.userRole, token, accessStatus, mediaAttempt])

  const handleReconnect = () => {
    if (reconnectAttemptsRef.current >= 3) {
      console.log('[WebRTC] Max reconnect attempts reached')
      setConnectionState('failed')
      return
    }
    reconnectAttemptsRef.current++
    console.log(`[WebRTC] ICE failure — reconnect attempt ${reconnectAttemptsRef.current}/3`)
    setConnectionState('reconnecting')

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close()
      peerConnectionRef.current = null
    }
    peerSocketIdRef.current = null
    pendingIceCandidatesRef.current = []
    makingOfferRef.current = false

    // Re-join room after random delay to avoid both sides colliding
    const delay = 1000 + Math.random() * 1500
    setTimeout(() => {
      const socket = activeSocketRef.current
      if (socket?.connected) {
        socket.emit('join-room', {
          roomId,
          isPortrait: window.innerHeight > window.innerWidth,
        })
      } else {
        setConnectionState('failed')
      }
    }, delay)
  }

  const retryConnection = () => {
    setError(null)
    reconnectAttemptsRef.current = 0
    const socket = activeSocketRef.current || socketRef.current
    if (socket?.connected) {
      setConnectionState('waiting')
      socket.emit('join-room', {
        roomId,
        isPortrait: window.innerHeight > window.innerWidth,
      })
      return
    }
    window.location.reload()
  }

  const createPeerConnection = (socket, targetSocketId) => {
    if (peerConnectionRef.current) peerConnectionRef.current.close()
    activeSocketRef.current = socket
    peerSocketIdRef.current = targetSocketId
    makingOfferRef.current = false
    pendingIceCandidatesRef.current = []

    // Учётки TURN в лог не пишем — только адреса.
    console.log('[WebRTC] ICE servers:', iceServersRef.current.iceServers.map((server) => server.urls))
    const forceRelay = shouldForceRelay()
    if (forceRelay) console.warn('[WebRTC] force-relay: only TURN, host and srflx disabled')
    const pc = new RTCPeerConnection({
      ...iceServersRef.current,
      ...(forceRelay ? { iceTransportPolicy: 'relay' } : {}),
    })
    peerConnectionRef.current = pc

    const localTracks = localStreamRef.current?.getTracks() || []
    localTracks.forEach(track => {
      pc.addTrack(track, localStreamRef.current)
    })

    // Без своей дорожки соответствующей m-линии в offer не будет, и собеседник
    // не сможет прислать звук или картинку. Участнику без камеры/микрофона
    // добавляем приёмный трансивер: отдавать нечего, но видеть и слышать он должен.
    if (!localTracks.some(track => track.kind === 'audio')) {
      pc.addTransceiver('audio', { direction: 'recvonly' })
    }
    if (!localTracks.some(track => track.kind === 'video')) {
      pc.addTransceiver('video', { direction: 'recvonly' })
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('[WebRTC] ICE candidate:', event.candidate.type, event.candidate.candidate)
        socket.emit('ice-candidate', { targetSocketId, candidate: event.candidate })
      }
    }

    pc.ontrack = (event) => {
      // Handle cases where event.streams is empty (some browsers/conditions)
      // by creating a stream from the track if needed
      let stream = event.streams?.[0]
      if (!stream && event.track) {
        stream = new MediaStream([event.track])
      }
      if (stream) {
        remoteStreamRef.current = stream
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = stream
        }
        setConnectionState('connected')
      }
    }

    pc.onicegatheringstatechange = () => {
      console.log('[WebRTC] ICE gathering state:', pc.iceGatheringState)
    }

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState
      console.log('[WebRTC] ICE connection state:', state)

      if (state === 'disconnected') {
        // Transient — often self-recovers within a few seconds
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = setTimeout(() => {
          if (peerConnectionRef.current === pc &&
              pc.iceConnectionState !== 'connected' &&
              pc.iceConnectionState !== 'completed') {
            handleReconnect()
          }
        }, 4000)
      } else if (state === 'connected' || state === 'completed') {
        clearTimeout(reconnectTimerRef.current)
        reconnectAttemptsRef.current = 0
        logSelectedCandidatePair(pc)
      } else if (state === 'failed') {
        clearTimeout(reconnectTimerRef.current)
        logIceDiagnostics(pc)
        // Провалилось прошлое соединение, а текущее уже другое — не сносим живой звонок.
        if (peerConnectionRef.current === pc) handleReconnect()
      }
    }

    // Единственный источник правды о том, почему не поднялся TURN: без него
    // неудачная аллокация (401, 403, 701) не видна нигде.
    pc.onicecandidateerror = (event) => {
      console.warn('[WebRTC] ICE candidate error:', {
        url: event.url,
        errorCode: event.errorCode,
        errorText: event.errorText,
      })
    }

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState
      console.log('[WebRTC] Connection state:', state)
      if (state === 'connected') {
        setConnectionState('connected')
        reconnectAttemptsRef.current = 0
        clearTimeout(reconnectTimerRef.current)
      }
      // 'failed' is handled via oniceconnectionstatechange
    }

    return pc
  }

  // Какая пара адресов выиграла: отличает «не хватило TURN» от «relay выбран,
  // но медиа не идёт».
  const logSelectedCandidatePair = async (pc) => {
    try {
      const stats = await pc.getStats()
      stats.forEach((report) => {
        if (report.type === 'candidate-pair' && report.state === 'succeeded' && report.nominated) {
          const local = stats.get(report.localCandidateId)
          const remote = stats.get(report.remoteCandidateId)
          console.log('[WebRTC] Selected pair:',
            `${local?.candidateType}/${local?.protocol}`, '<->', `${remote?.candidateType}/${remote?.protocol}`)
        }
      })
    } catch (err) {
      console.warn('[WebRTC] Could not read stats:', err)
    }
  }

  // Сколько своих и чужих кандидатов каждого типа дошло к моменту провала.
  const logIceDiagnostics = async (pc) => {
    try {
      const stats = await pc.getStats()
      const tally = { local: {}, remote: {} }
      stats.forEach((report) => {
        if (report.type === 'local-candidate') tally.local[report.candidateType] = (tally.local[report.candidateType] || 0) + 1
        if (report.type === 'remote-candidate') tally.remote[report.candidateType] = (tally.remote[report.candidateType] || 0) + 1
      })
      console.warn('[WebRTC] ICE failed. Candidates seen:', tally)
    } catch (err) {
      console.warn('[WebRTC] Could not read stats:', err)
    }
  }

  // Живое соединение с тем же собеседником переиспользуем; пересоздаём только
  // мёртвое — иначе встречный offer сносил соединение с собственным offer'ом.
  const ensurePeerConnection = (socket, peerSocketId) => {
    const existing = peerConnectionRef.current
    const reusable = existing &&
      peerSocketIdRef.current === peerSocketId &&
      existing.connectionState !== 'failed' &&
      existing.connectionState !== 'closed'
    if (reusable) {
      activeSocketRef.current = socket
      return existing
    }
    return createPeerConnection(socket, peerSocketId)
  }

  // Offer делает ровно одна сторона — решение по socketId, одинаковое у обоих
  // без обмена сообщениями. Раньше при одновременном переподключении offer
  // слали оба, и согласование после первого же сбоя не восстанавливалось.
  const startNegotiation = async (socket, peerSocketId) => {
    const pc = ensurePeerConnection(socket, peerSocketId)
    if (!isNegotiationInitiator(socket.id, peerSocketId)) return
    if (makingOfferRef.current) return

    makingOfferRef.current = true
    try {
      // Повторное согласование на живом соединении — ICE restart.
      const offer = await pc.createOffer(pc.localDescription ? { iceRestart: true } : undefined)
      await pc.setLocalDescription(offer)
      // Пока собирали offer, соединение могли пересоздать — старый offer не шлём.
      if (peerConnectionRef.current !== pc) return
      socket.emit('offer', { targetSocketId: peerSocketId, offer })
    } catch (err) {
      console.error('Error creating offer:', err)
    } finally {
      makingOfferRef.current = false
    }
  }

  const flushPendingIceCandidates = async (pc = peerConnectionRef.current) => {
    if (!pc?.remoteDescription) return
    const pending = pendingIceCandidatesRef.current
    pendingIceCandidatesRef.current = []
    for (const candidate of pending) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate))
      } catch (err) {
        console.error('Error adding queued ICE candidate:', err)
      }
    }
  }

  const addIceCandidateSafely = async (candidate) => {
    const pc = peerConnectionRef.current
    if (!candidate) return
    // Кандидаты обгоняют offer/answer (и даже создание соединения): копим их.
    if (!pc || !pc.remoteDescription) {
      pendingIceCandidatesRef.current.push(candidate)
      return
    }
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate))
    } catch (err) {
      console.error('Error adding ICE candidate:', err)
    }
  }

  // Счётчик считает от сохранённой отметки старта, а не от монтирования.
  useEffect(() => {
    if (connectionState !== 'connected') return undefined
    let startedAt = readCallStart(roomId)
    if (!startedAt) {
      startedAt = Date.now()
      writeCallStart(roomId, startedAt)
    }
    const tick = () => setDuration(Math.max(0, Math.round((Date.now() - startedAt) / 1000)))
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [connectionState, roomId])

  // Сколько осталось до закрытия комнаты — по серверному времени: доступ
  // решает сервер, а часы устройства могут врать.
  useEffect(() => {
    const endMs = Date.parse(roomWindow?.windowEnd || '')
    if (!Number.isFinite(endMs)) {
      setRoomRemainingMs(null)
      return undefined
    }
    const tick = () => setRoomRemainingMs(endMs - getServerNow().getTime())
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [roomWindow?.windowEnd])

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const formatAstanaClock = (iso) => {
    if (!iso) return ''
    try {
      return new Date(iso).toLocaleTimeString(timeLocale, { timeZone: 'Asia/Almaty', hour: '2-digit', minute: '2-digit' })
    } catch {
      return ''
    }
  }

  const roomTimeLeftLabel = roomRemainingMs === null
    ? null
    : formatDuration(Math.max(0, Math.floor(roomRemainingMs / 1000)))
  const isRoomTimeRunningOut = roomRemainingMs !== null && roomRemainingMs <= 5 * 60 * 1000

  // Пока устройства не запрошены, считаем их исправными: панель управления не
  // должна мигать блокировками на первой секунде звонка.
  const hasMicrophone = mediaOutcome ? mediaOutcome.devices[MEDIA_KIND.MICROPHONE].ok : true
  const hasCamera = mediaOutcome ? mediaOutcome.devices[MEDIA_KIND.CAMERA].ok : true
  const missingDevices = mediaOutcome?.missing || []
  const isMediaBlocked = connectionState === 'media-blocked'
  const showMediaNotice = missingDevices.length > 0 && !mediaNoticeDismissed && !isMediaBlocked

  const retryMediaDevices = () => {
    setMediaNoticeDismissed(false)
    setConnectionState('initializing')
    setMediaAttempt((attempt) => attempt + 1)
  }

  const joinWithoutDevices = () => {
    allowNoDevicesRef.current = true
    retryMediaDevices()
  }

  // Плашка в комнате говорит о последствиях («врач вас не увидит»), подсказка
  // под ней — о причине и способе починить.
  const mediaNotice = (() => {
    if (!showMediaNotice) return null
    if (missingDevices.length === 2) {
      return { Icon: MicOff, title: t('video.media.notice_none.title'), hint: t('video.media.notice_none.hint') }
    }
    const kind = missingDevices[0]
    const reason = mediaOutcome.devices[kind].reason
    return {
      Icon: kind === MEDIA_KIND.CAMERA ? VideoOff : MicOff,
      title: t(kind === MEDIA_KIND.CAMERA ? 'video.media.notice_no_camera.title' : 'video.media.notice_no_microphone.title'),
      hint: t(`${mediaStringKey(kind, reason)}.hint`),
    }
  })()

  const renderMediaDeviceRow = (kind) => {
    const reason = mediaOutcome?.devices?.[kind]?.reason || MEDIA_REASON.OTHER
    const Icon = kind === MEDIA_KIND.CAMERA ? VideoOff : MicOff
    return (
      <li key={kind} className="flex gap-3 rounded-xl bg-slate-900/60 p-3 text-left">
        <Icon className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-white">{t(`${mediaStringKey(kind, reason)}.title`)}</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">{t(`${mediaStringKey(kind, reason)}.hint`)}</p>
        </div>
      </li>
    )
  }

  const toggleMute = () => {
    const audioTrack = localStreamRef.current?.getAudioTracks()[0]
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled
      setIsMuted(!audioTrack.enabled)
    }
  }

  const toggleVideo = () => {
    const videoTrack = localStreamRef.current?.getVideoTracks()[0]
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled
      setIsVideoOn(videoTrack.enabled)
    }
  }

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      videoContainerRef.current?.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  const handleMinimize = async () => {
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen()
      } catch (err) {
        console.error('Error exiting fullscreen:', err)
      }
    }
    setIsFullscreen(false)
    onMinimize?.()
  }

  const copyInviteLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/consultation/${roomId}`)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }

  // Вызывается при реальном завершении звонка — только здесь сбрасываем
  // отметку старта. При обновлении страницы React cleanup не работает, и
  // отметка переживает F5, что и нужно.
  const cleanupCall = () => {
    clearCallStart(roomId)
    localStreamRef.current?.getTracks().forEach(track => track.stop())
    localStreamRef.current = null
    peerConnectionRef.current?.close()
    peerConnectionRef.current = null
    socketRef.current?.emit('leave-room')
    socketRef.current?.disconnect()
    socketRef.current = null
    activeSocketRef.current = null
    clearTimeout(reconnectTimerRef.current)
    remoteStreamRef.current = null
  }

  const handleBackToAppointments = () => {
    cleanupCall()
    onClose?.()
    navigate(isDoctor ? '/doctor/schedule' : '/patient/appointments', { replace: true })
  }

  const saveChatLog = async (chatMessages) => {
    if (!appointment?.documentId || !chatMessages?.length) return
    try {
      await appointmentsAPI.update(appointment.documentId, {
        chatLog: chatMessages.map(m => ({
          senderName: m.senderName,
          text: m.text,
          time: m.time instanceof Date ? m.time.toISOString() : m.time,
        })),
      })
    } catch (err) {
      console.error('Error saving chat log:', err)
    }
  }

  const closeConsultation = (fallbackPath) => {
    if (onClose) {
      onClose()
      return
    }
    navigate(fallbackPath, { replace: true })
  }

  const requestEndCall = async (action = 'leave') => {
    if (isEndingCallRef.current) return
    // A confirmation rendered outside the browser's fullscreen element is not
    // visible. Exit fullscreen first so the very first click always shows it.
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen()
      } catch (err) {
        console.error('Error exiting fullscreen before ending call:', err)
      }
      setIsFullscreen(false)
    }
    setPendingEndAction(action)
  }

  // requestedAction — выбор, сделанный в шторке: она сама служит подтверждением.
  const confirmEndCall = async (requestedAction) => {
    const chosen = typeof requestedAction === 'string' ? requestedAction : pendingEndAction
    if (isEndingCallRef.current || !chosen) return
    // Without a loaded appointment we cannot complete it server-side, but the
    // participant must still be able to get out of the call, so degrade to leave.
    const action = chosen === 'complete' && appointment?.documentId ? 'complete' : 'leave'

    isEndingCallRef.current = true
    setIsCompletingCall(true)
    try {
      await saveChatLog(messages)
      if (action === 'complete') {
        await appointmentsAPI.update(appointment.documentId, { status: 'completed' })
        socketRef.current?.emit('force-end-call')
      }
    } catch (err) {
      // Completing the appointment is best-effort. Leaving the call must never
      // depend on it, otherwise the button looks dead and gets clicked again.
      console.error('Error completing appointment:', err)
      const message = err?.response?.data?.error?.message
      toast.error(message || t('video.complete_error'))
    }

    // Always tear the call down and release the participant — a failed status
    // update must not trap them behind an unresponsive confirmation dialog.
    try {
      cleanupCall()
      setConnectionState('waiting')
      setPendingEndAction(null)
      setShowLeaveSheet(false)
      closeConsultation(isDoctor ? '/doctor' : '/patient/appointments')
    } finally {
      isEndingCallRef.current = false
      setIsCompletingCall(false)
    }
  }

  const submitRating = async () => {
    if (!appointment?.documentId || rating === 0) return
    setIsSubmittingRating(true)
    try {
      await appointmentsAPI.update(appointment.documentId, {
        rating,
        review: reviewText.trim() || undefined,
      })
    } catch (err) {
      console.error('Error submitting rating:', err)
    } finally {
      setIsSubmittingRating(false)
      setShowRatingModal(false)
      closeConsultation('/patient/appointments')
    }
  }

  const skipRating = () => {
    setShowRatingModal(false)
    closeConsultation('/patient/appointments')
  }

  const sendMessage = (e) => {
    e.preventDefault()
    if (!newMessage.trim() || !socketRef.current) return

    socketRef.current.emit('chat-message', {
      message: newMessage,
    })
    setNewMessage('')
  }

  // Patient attaches a file during consultation
  const handleChatFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !appointment) return
    e.target.value = '' // reset input

    // Validate file size (10 MB max)
    const MAX_SIZE = 10 * 1024 * 1024
    if (file.size > MAX_SIZE) {
      setMessages(prev => [...prev, {
        id: Date.now(),
        sender: 'system',
        senderName: t('video.system'),
        text: t('video.file_too_large', { name: file.name }),
        time: new Date(),
      }])
      return
    }

    setIsUploadingChatFile(true)
    try {
      // 1. Upload file to media library
      const uploaded = await uploadFile(file)

      // 2. Link the upload to this consultation. The server derives the
      // medical case from the appointment, so the assigned doctor receives
      // access automatically through the case.
      const aptDocId = appointment.documentId || appointment.id

      // 3. Create medical-document linked to the consultation/case
      await documentsAPI.create({
        title: file.name.replace(/\.[^/.]+$/, ''),
        type: 'other',
        description: '',
        file: uploaded.id,
        user: user.id,
        appointment: aptDocId,
      })

      // 4. Send chat message so doctor sees notification instantly
      const fileIcon = file.type?.startsWith('image/') ? '🖼' : '📎'
      const sizeKb = Math.round(file.size / 1024)
      const sizeStr = sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(1)} ${t('video.size_mb')}` : `${sizeKb} ${t('video.size_kb')}`

      socketRef.current?.emit('chat-message', {
        message: t('video.file_attached', { icon: fileIcon, name: file.name, size: sizeStr }),
        attachment: {
          id: uploaded.id,
          name: file.name,
          url: uploaded.url,
          mime: uploaded.mime || file.type,
          size: uploaded.size ? Math.round(uploaded.size * 1024) : file.size,
        },
      })

      // 5. Refresh doctor's document list if they have it open
      if (isDoctor && appointment?.patient?.id) {
        const caseId = appointment.medical_case?.documentId || appointment.medical_case?.id
        const response = caseId
          ? await documentsAPI.getByCase(caseId)
          : await documentsAPI.getAll({ userId: appointment.patient.id })
        setPatientDocuments(response.data?.data || [])
      }
    } catch (err) {
      console.error('Error uploading chat file:', err)
      setMessages(prev => [...prev, {
        id: Date.now(),
        sender: 'system',
        senderName: t('video.system'),
        text: t('video.file_upload_error', { name: file.name }),
        time: new Date(),
      }])
    } finally {
      setIsUploadingChatFile(false)
    }
  }

  const handleDiagnosisFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const uploaded = await uploadFile(file)
      setDiagnosisFile(uploaded)
    } catch (err) {
      console.error('Error uploading file:', err)
    }
  }

  const saveDiagnosis = async () => {
    if (!appointment?.id) return
    setIsSavingDiagnosis(true)
    const caseId = appointment.medical_case?.documentId || appointment.medical_case?.id
    const appointmentRef = appointment.documentId || appointment.id
    const patientRef = appointment.patient?.documentId || appointment.patient?.id
    const doctorRef = appointment.doctor?.documentId || appointment.doctor?.id
    try {
      if (existingDocIds.certificate) {
        await documentsAPI.update(existingDocIds.certificate, {
          description: diagnosisText || '',
          ...(diagnosisFile?.id && { file: diagnosisFile.id }),
        })
      } else {
        const res = await documentsAPI.create({
          title: t('video.doc_conclusion'),
          type: 'certificate',
          description: diagnosisText || '',
          file: diagnosisFile?.id,
          appointment: appointmentRef,
          ...(caseId && { medical_case: caseId }),
          user: patientRef,
          doctor: doctorRef,
        })
        const newDoc = res.data?.data
        if (newDoc) setExistingDocIds(prev => ({ ...prev, certificate: newDoc.documentId || newDoc.id }))
      }
      setDiagnosisSaved(true)
      setTimeout(() => setDiagnosisSaved(false), 2000)
    } catch (err) {
      console.error('Error saving diagnosis:', err)
    } finally {
      setIsSavingDiagnosis(false)
    }
  }

  const endConfirmationModal = pendingEndAction ? (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={() => !isCompletingCall && setPendingEndAction(null)}
      />
      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6 animate-scaleIn">
        <div className="text-center mb-5">
          <div className={cn(
            'w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3',
            pendingEndAction === 'complete' ? 'bg-amber-100' : 'bg-rose-100'
          )}>
            <PhoneOff className={cn(
              'w-7 h-7',
              pendingEndAction === 'complete' ? 'text-amber-600' : 'text-rose-600'
            )} />
          </div>
          <h2 className="text-lg font-bold text-slate-900">
            {t(pendingEndAction === 'complete' ? 'video.complete_confirm_title' : 'video.leave_confirm_title')}
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            {t(pendingEndAction === 'complete' ? 'video.complete_confirm_desc' : 'video.leave_confirm_desc')}
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => setPendingEndAction(null)}
            disabled={isCompletingCall}
          >
            {t('video.cancel')}
          </Button>
          <Button
            className={cn(
              'flex-1 text-white',
              pendingEndAction === 'complete'
                ? 'bg-emerald-500 hover:bg-emerald-600'
                : 'bg-rose-500 hover:bg-rose-600'
            )}
            onClick={confirmEndCall}
            disabled={isCompletingCall}
          >
            {isCompletingCall ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : pendingEndAction === 'complete' ? (
              <Check className="w-4 h-4 mr-2" />
            ) : (
              <PhoneOff className="w-4 h-4 mr-2" />
            )}
            {t(pendingEndAction === 'complete' ? 'video.complete' : 'video.leave')}
          </Button>
        </div>
      </div>
    </div>
  ) : null

  const ratingModal = showRatingModal ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 animate-scaleIn">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Star className="w-8 h-8 text-teal-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">{t('video.rate_title')}</h2>
          <p className="text-slate-500 text-sm mt-1">
            {t('video.rate_desc')}
          </p>
        </div>

        {/* Stars */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              title={t(`video.rating_${star}`)}
              aria-label={t(`video.rating_${star}`)}
              className="p-1 transition-transform hover:scale-110"
            >
              <Star
                className={cn(
                  'w-10 h-10 transition-colors',
                  (hoverRating || rating) >= star
                    ? 'text-amber-400 fill-amber-400'
                    : 'text-slate-300'
                )}
              />
            </button>
          ))}
        </div>

        {rating > 0 && (
          <p className="text-center text-sm font-medium text-slate-600 mb-4">
            {t(`video.rating_${rating}`)}
          </p>
        )}

        {/* Review text */}
        <div className="mb-6">
          <textarea
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
            placeholder={t('video.review_placeholder')}
            className="w-full h-28 px-4 py-3 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={skipRating}
            disabled={isSubmittingRating}
          >
            {t('common.skip')}
          </Button>
          <Button
            className="flex-1"
            onClick={submitRating}
            disabled={rating === 0 || isSubmittingRating}
          >
            {isSubmittingRating ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : null}
            {t('video.submit')}
          </Button>
        </div>
      </div>
    </div>
  ) : null

  // Фоновый (свёрнутый) звонок не имеет права занимать экран: проверка доступа
  // и отказ — полноэкранные слои, и над любой страницей они выглядели бы как
  // зависшая консультация. В фоне показываем только мини-окно или модалки.
  const surface = resolveConsultationSurface({
    isMinimized,
    accessStatus,
    hasBlockingModal: showRatingModal,
  })

  if (surface === CONSULTATION_SURFACE.HIDDEN) {
    return null
  }

  if (surface === CONSULTATION_SURFACE.MODALS) {
    return (
      <>
        {endConfirmationModal}
        {ratingModal}
      </>
    )
  }

  if (accessStatus === 'checking') {
    return (
      <div className="fixed inset-0 z-[900] bg-slate-900 flex flex-col items-center justify-center text-white px-6 pt-[var(--safe-top)]">
        <Loader2 className="w-10 h-10 animate-spin text-teal-400 mb-4" />
        <p className="text-slate-200">{t('video.checking')}</p>
      </div>
    )
  }

  if (accessStatus === 'denied') {
    const accessTimeZone = user?.userRole === 'patient' ? getDeviceTimeZone() : KAZAKHSTAN_TIME_ZONE
    const formatAccessTime = (iso) => {
      if (!iso) return ''
      try {
        return formatDateTimeInTimeZone(iso, accessTimeZone, i18n.language)
      } catch { return '' }
    }
    const reasonMap = {
      too_early: {
        title: t('video.deny_too_early_title'),
        detail: accessDenyInfo?.dateTime
          ? t('video.deny_too_early_detail_time', { windowStart: formatAccessTime(accessDenyInfo.windowStart), dateTime: formatAccessTime(accessDenyInfo.dateTime) })
          : t('video.deny_too_early_detail'),
      },
      too_late: {
        title: t('video.deny_too_late_title'),
        detail: t('video.deny_too_late_detail'),
      },
      cancelled: { title: t('video.deny_cancelled_title'), detail: t('video.deny_cancelled_detail') },
      wrong_status: { title: t('video.deny_wrong_status_title'), detail: t('video.deny_wrong_status_detail') },
      not_participant: { title: t('video.deny_not_participant_title'), detail: t('video.deny_not_participant_detail') },
      not_found: { title: t('video.deny_not_found_title'), detail: t('video.deny_not_found_detail') },
      error: { title: t('video.deny_error_title'), detail: t('video.deny_error_detail') },
    }
    const { title, detail } = reasonMap[accessDenyInfo?.reason] || reasonMap.error
    return (
      <div className="fixed inset-0 z-[900] bg-slate-900 flex flex-col items-center justify-center text-white px-6 pt-[var(--safe-top)]">
        <div className="max-w-md w-full bg-slate-800/70 rounded-2xl p-6 border border-slate-700 text-center">
          <AlertCircle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
          <h2 className="text-xl font-semibold mb-2">{title}</h2>
          <p className="text-slate-300 text-sm mb-5">{detail}</p>
          <Button
            variant="secondary"
            onClick={handleBackToAppointments}
          >
            {t('video.back_to_appointments')}
          </Button>
        </div>
      </div>
    )
  }

  if (isMinimized && !showRatingModal) {
    const position = miniPosition || getInitialMiniPosition()
    const connectionLabel = {
      initializing: t('video.init_title'),
      waiting: t('video.waiting_label'),
      connecting: t('video.connecting'),
      connected: t('video.connected'),
      reconnecting: t('video.reconnecting'),
      failed: t('video.failed_title'),
      'media-blocked': t('video.media.gate_title'),
    }[connectionState] || connectionState

    return (
      <>
        <div
        ref={miniWindowRef}
        className="fixed z-[1000] w-56 overflow-hidden rounded-2xl bg-slate-950 text-white shadow-2xl ring-1 ring-white/15 sm:w-80"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          touchAction: 'none',
          paddingBottom: 'max(0px, env(safe-area-inset-bottom))',
        }}
        onPointerDown={handleMiniPointerDown}
        onPointerMove={handleMiniPointerMove}
        onPointerUp={handleMiniPointerUp}
        onPointerCancel={handleMiniPointerUp}
      >
        <div className="cursor-grab active:cursor-grabbing">
          <div className="relative aspect-video bg-slate-900">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              onLoadedMetadata={(e) => {
                const { videoWidth, videoHeight } = e.target
                setRemoteVideoPortrait(videoHeight > videoWidth)
              }}
              onResize={(e) => {
                const { videoWidth, videoHeight } = e.target
                setRemoteVideoPortrait(videoHeight > videoWidth)
              }}
              className={cn('h-full w-full object-contain', connectionState === 'connected' ? 'block' : 'hidden')}
            />
            {connectionState !== 'connected' && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
                {connectionState === 'failed' ? (
                  <AlertCircle className="h-8 w-8 text-rose-400" />
                ) : (
                  <Loader2 className="h-8 w-8 animate-spin text-teal-400" />
                )}
              </div>
            )}
            <div className="absolute left-2 top-2 flex max-w-[calc(100%-5.5rem)] items-center gap-1.5 rounded-full bg-black/55 px-2 py-1 text-[11px] font-medium backdrop-blur">
              <span className={cn(
                'h-2 w-2 rounded-full',
                connectionState === 'connected' ? 'bg-emerald-400' : connectionState === 'failed' ? 'bg-rose-400' : 'bg-amber-400'
              )} />
              <span className="truncate">{connectionLabel}</span>
            </div>
            <div className="absolute bottom-2 right-2 w-16 overflow-hidden rounded-lg bg-slate-800 shadow-lg ring-1 ring-white/15 sm:w-24">
              <div className="relative aspect-video">
                <video ref={localVideoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
                {!isVideoOn && (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
                    <VideoOff className="h-4 w-4 text-slate-400" />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2 p-2.5 sm:p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold leading-tight">{participant.name}</p>
                <p className="hidden truncate text-xs text-slate-400 sm:block">{participant.role}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1 rounded-full bg-slate-800 px-2 py-1 text-[11px] font-medium text-slate-200">
                <Clock className="h-3 w-3 text-emerald-400" />
                {formatDuration(duration)}
              </div>
            </div>

            <div className="flex items-center justify-between gap-1.5">
              <button
                type="button"
                onClick={toggleMute}
                disabled={!hasMicrophone}
                title={hasMicrophone ? (isMuted ? t('common.mic_on') : t('common.mic_off')) : t('video.media.microphone_unavailable')}
                aria-label={hasMicrophone ? (isMuted ? t('common.mic_on') : t('common.mic_off')) : t('video.media.microphone_unavailable')}
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-xl transition-colors sm:h-10 sm:w-10 disabled:cursor-not-allowed disabled:opacity-50',
                  isMuted ? 'bg-rose-500 text-white hover:bg-rose-600' : 'bg-slate-800 text-white hover:bg-slate-700'
                )}
              >
                {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={toggleVideo}
                disabled={!hasCamera}
                title={hasCamera ? (isVideoOn ? t('common.cam_off') : t('common.cam_on')) : t('video.media.camera_unavailable')}
                aria-label={hasCamera ? (isVideoOn ? t('common.cam_off') : t('common.cam_on')) : t('video.media.camera_unavailable')}
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-xl transition-colors sm:h-10 sm:w-10 disabled:cursor-not-allowed disabled:opacity-50',
                  !isVideoOn ? 'bg-rose-500 text-white hover:bg-rose-600' : 'bg-slate-800 text-white hover:bg-slate-700'
                )}
              >
                {isVideoOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={onRestore}
                title={unreadChatCount > 0 ? t('video.unread_messages', { n: unreadChatCount }) : t('video.restore')}
                aria-label={unreadChatCount > 0 ? t('video.unread_messages', { n: unreadChatCount }) : t('video.restore')}
                className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-teal-600 text-white transition-colors hover:bg-teal-500 sm:h-10 sm:w-10"
              >
                <Maximize className="h-4 w-4" />
                {unreadChatCount > 0 && (
                  <span aria-hidden="true" className="absolute -top-1 -right-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-slate-950">
                    {unreadChatCount > 9 ? '9+' : unreadChatCount}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => requestEndCall('leave')}
                title={t('common.leave_call')}
                aria-label={t('common.leave_call')}
                className="flex h-9 w-10 items-center justify-center rounded-xl bg-rose-500 text-white transition-colors hover:bg-rose-600 sm:h-10 sm:w-12"
              >
                <PhoneOff className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
        </div>
        {endConfirmationModal}
      </>
    )
  }

  return (
    <div className="fixed inset-x-0 top-0 z-[900] h-[calc(var(--app-height)-var(--safe-top))] bg-slate-900 flex flex-col sm:flex-row overflow-hidden pt-[var(--safe-top)]">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-slate-900/40 backdrop-blur-sm sm:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      {/* Main Video Area */}
      <div className={cn(
        "flex-1 flex flex-col min-w-0 min-h-0 transition-all duration-300",
        sidebarOpen ? "mr-0" : "mr-0"
      )}>
        {/* Top Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-3 sm:px-4 py-3 bg-slate-800/50">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={handleMinimize}
              title={t('video.minimize')}
              aria-label={t('video.minimize')}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            >
              <Minimize className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative">
                <Avatar name={participant.name} size="md" />
                {connectionState === 'connected' && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full ring-2 ring-slate-800" />
                )}
              </div>
              <div className="min-w-0">
                <h2 className="text-white font-medium text-sm sm:text-base truncate">{participant.name}</h2>
                <p className="text-slate-400 text-xs truncate">{participant.role}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center flex-wrap justify-end gap-2 w-full sm:w-auto">
            {connectionState === 'connected' && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/20 rounded-full">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 text-sm font-medium">{formatDuration(duration)}</span>
              </div>
            )}
            {roomTimeLeftLabel && (
              <div
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-full',
                  isRoomTimeRunningOut ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-700/60 text-slate-300'
                )}
                title={t('video.room_time_left_hint', {
                  minutes: roomWindow?.consultationDuration || '',
                  until: formatAstanaClock(roomWindow?.windowEnd),
                })}
              >
                <Hourglass className="w-3.5 h-3.5" />
                <span className="text-sm font-medium">
                  <span className="hidden sm:inline">{t('video.room_time_left', { time: roomTimeLeftLabel })}</span>
                  <span className="sm:hidden">{roomTimeLeftLabel}</span>
                </span>
              </div>
            )}
            <button
              onClick={copyInviteLink}
              title={linkCopied ? t('video.copied') : t('video.link')}
              aria-label={linkCopied ? t('video.copied') : t('video.link')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 text-sm transition-colors"
            >
              {linkCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <LinkIcon className="w-4 h-4" />}
              <span className="hidden sm:inline">{linkCopied ? t('video.copied') : t('video.link')}</span>
            </button>
            <button
              onClick={toggleFullscreen}
              title={isFullscreen ? t('video.exit_fullscreen') : t('video.fullscreen')}
              aria-label={isFullscreen ? t('video.exit_fullscreen') : t('video.fullscreen')}
              className="p-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors"
            >
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>
            {!sidebarOpen && (
              <button
                onClick={() => {
                  setSidebarTab('chat')
                  setSidebarOpen(true)
                }}
                title={unreadChatCount > 0 ? t('video.unread_messages', { n: unreadChatCount }) : t('video.open_chat')}
                aria-label={unreadChatCount > 0 ? t('video.unread_messages', { n: unreadChatCount }) : t('video.open_chat')}
                className={cn(
                  'relative p-2 rounded-lg text-white transition-colors',
                  unreadChatCount > 0 ? 'bg-amber-500 hover:bg-amber-400 animate-pulse' : 'bg-teal-600 hover:bg-teal-500'
                )}
              >
                <MessageCircle className="w-4 h-4" />
                {unreadChatCount > 0 && (
                  <span aria-hidden="true" className="absolute -top-1 -right-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-slate-800">
                    {unreadChatCount > 9 ? '9+' : unreadChatCount}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Ограничения по устройствам: не ошибка, а предупреждение о том,
            чего собеседник не получит */}
        {mediaNotice && (
          <div className="flex items-start gap-3 border-b border-amber-400/20 bg-amber-400/10 px-3 py-2.5 sm:px-4">
            <mediaNotice.Icon className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-amber-100">{mediaNotice.title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-amber-200/70">{mediaNotice.hint}</p>
            </div>
            <button
              type="button"
              onClick={retryMediaDevices}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-amber-400/15 px-2.5 py-1.5 text-xs font-medium text-amber-100 transition-colors hover:bg-amber-400/25"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t('video.media.retry_devices')}</span>
            </button>
            <button
              type="button"
              onClick={() => setMediaNoticeDismissed(true)}
              aria-label={t('common.close')}
              title={t('common.close')}
              className="shrink-0 rounded-lg p-1.5 text-amber-200/70 transition-colors hover:bg-amber-400/15 hover:text-amber-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Video Container */}
        <div ref={videoContainerRef} className="flex-1 relative bg-slate-900">
          {/* Connection States */}
          {connectionState === 'initializing' && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-slate-800 flex items-center justify-center">
                  <Loader2 className="w-10 h-10 text-teal-500 animate-spin" />
                </div>
                <p className="text-white text-xl font-medium">{t('video.init_title')}</p>
                <p className="text-slate-400 mt-2">{t('video.init_desc')}</p>
              </div>
            </div>
          )}

          {connectionState === 'waiting' && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center max-w-md px-4">
                <div className="w-28 h-28 mx-auto mb-6 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center ring-4 ring-slate-700/50">
                  <User className="w-14 h-14 text-slate-500" />
                </div>
                <h3 className="text-white text-2xl font-semibold mb-2">{t('video.waiting_title')}</h3>
                <p className="text-slate-400 mb-8">
                  {isDoctor ? t('video.waiting_patient') : t('video.waiting_doctor')}
                </p>

                <div className="bg-slate-800/80 backdrop-blur rounded-2xl p-5 text-left">
                  <p className="text-slate-400 text-sm mb-3">{t('video.invite_link_label')}</p>
                  <div className="flex items-center gap-2 bg-slate-900/50 rounded-xl p-3">
                    <code className="flex-1 text-teal-400 text-sm truncate">{window.location.href}</code>
                    <button
                      onClick={copyInviteLink}
                      title={linkCopied ? t('video.copied') : t('video.link')}
                      aria-label={linkCopied ? t('video.copied') : t('video.link')}
                      className={cn(
                        "p-2 rounded-lg transition-colors",
                        linkCopied ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-700 hover:bg-slate-600 text-slate-400"
                      )}
                    >
                      {linkCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Animated dots */}
                <div className="flex justify-center gap-1.5 mt-8">
                  <span className="w-2 h-2 bg-teal-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-2 h-2 bg-teal-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-2 h-2 bg-teal-500 rounded-full animate-bounce" />
                </div>
              </div>
            </div>
          )}

          {connectionState === 'connecting' && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-teal-500 to-sky-500 flex items-center justify-center animate-pulse">
                  <Avatar name={participant.name} size="xl" />
                </div>
                <p className="text-white text-xl font-medium mb-2">{t('video.connecting_to', { name: participant.name })}</p>
                <div className="flex justify-center gap-1">
                  <span className="w-2 h-2 bg-teal-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-2 h-2 bg-teal-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-2 h-2 bg-teal-500 rounded-full animate-bounce" />
                </div>
              </div>
            </div>
          )}

          {connectionState === 'reconnecting' && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-amber-500/20 flex items-center justify-center">
                  <Loader2 className="w-10 h-10 text-amber-400 animate-spin" />
                </div>
                <p className="text-white text-xl font-medium mb-2">{t('video.reconnecting')}</p>
                <p className="text-slate-400 text-sm">{t('video.reconnect_attempt', { attempt: reconnectAttemptsRef.current })}</p>
              </div>
            </div>
          )}

          {connectionState === 'failed' && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center max-w-md px-4">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-rose-500/20 flex items-center justify-center">
                  <AlertCircle className="w-10 h-10 text-rose-500" />
                </div>
                <h3 className="text-white text-xl font-medium mb-2">{t('video.failed_title')}</h3>
                <p className="text-slate-400 mb-6">{error || t('video.failed_desc')}</p>
                <div className="flex flex-col sm:flex-row justify-center gap-3">
                  <Button onClick={retryConnection}>{t('video.retry')}</Button>
                  <Button variant="outline" onClick={() => navigate('/patient/chat')}>
                    {t('video.fallback_chat')}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {isMediaBlocked && (
            <div className="absolute inset-0 z-[25] flex items-start justify-center overflow-y-auto bg-slate-900 px-4 py-6 sm:items-center">
              <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-800/70 p-5 sm:p-6">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-400/15">
                  <Settings className="h-7 w-7 text-amber-300" />
                </div>
                <h3 className="text-center text-xl font-semibold text-white">{t('video.media.gate_title')}</h3>
                <p className="mt-2 text-center text-sm text-slate-300">{t('video.media.gate_desc')}</p>
                <ul className="mt-5 space-y-2">
                  {[MEDIA_KIND.MICROPHONE, MEDIA_KIND.CAMERA].map(renderMediaDeviceRow)}
                </ul>
                <div className="mt-6 space-y-2">
                  <Button className="w-full" onClick={retryMediaDevices} leftIcon={<RefreshCw className="h-4 w-4" />}>
                    {t('video.media.retry_devices')}
                  </Button>
                  <button
                    type="button"
                    onClick={joinWithoutDevices}
                    className="w-full rounded-xl border border-slate-600 px-4 py-2.5 text-sm font-medium text-slate-200 transition-colors hover:border-slate-500 hover:bg-slate-700/50"
                  >
                    {t('video.media.join_without')}
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate(isDoctor ? '/doctor/schedule' : '/patient/appointments')}
                    className="w-full px-4 py-2 text-sm text-slate-400 transition-colors hover:text-slate-200"
                  >
                    {t('video.back_to_appointments')}
                  </button>
                </div>
                <p className="mt-4 text-center text-xs leading-relaxed text-slate-500">
                  {t('video.media.join_without_hint')}
                </p>
              </div>
            </div>
          )}

          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-36 bg-gradient-to-t from-slate-950/85 via-slate-950/35 to-transparent" />

          {/* Remote Video — always preserve full frame; black side bars come from the container background */}
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            onLoadedMetadata={(e) => {
              const { videoWidth, videoHeight } = e.target
              setRemoteVideoPortrait(videoHeight > videoWidth)
            }}
            onResize={(e) => {
              const { videoWidth, videoHeight } = e.target
              setRemoteVideoPortrait(videoHeight > videoWidth)
            }}
            className={cn(connectionState === 'connected' ? 'absolute inset-0' : 'hidden')}
            style={(() => {
              const needsRotation = !isMobileDevice && remoteIsPortrait && !remoteVideoPortrait
              const h = containerHeight || 600
              if (needsRotation) {
                // iOS portrait: stream is landscape 1280×720, person's head is on LEFT.
                // rotate(90deg) = clockwise: moves LEFT edge to TOP → person upright.
                // CSS w=h, CSS h=h*(9/16) → after rotation visual w=h*(9/16), visual h=h ✓
                return {
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  width: `${h}px`,
                  height: `${Math.round(h * 9 / 16)}px`,
                  transform: 'translate(-50%, -50%) rotate(90deg)',
                  objectFit: 'contain',
                  objectPosition: 'center center',
                }
              }
              return {
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                objectPosition: 'center center',
              }
            })()}
          />

          {/* Local Video Preview */}
          <div className="absolute z-10 top-3 right-3 sm:top-4 sm:right-4 w-28 sm:w-48 aspect-video rounded-2xl overflow-hidden shadow-2xl ring-2 ring-white/10 bg-slate-800">
            <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            {!isVideoOn && (
              <div className="absolute inset-0 bg-slate-800 flex items-center justify-center">
                <VideoOff className="w-8 h-8 text-slate-500" />
              </div>
            )}
            <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/50 rounded-lg">
              <p className="text-white text-xs">{t('video.you')}</p>
            </div>
          </div>

          {/* Controls */}
          <div className="pointer-events-none absolute inset-x-0 bottom-[max(1rem,calc(env(safe-area-inset-bottom)+1rem))] z-20 flex flex-col items-center gap-2 px-3">
            <div className="pointer-events-auto flex items-center justify-center gap-1.5 rounded-3xl bg-slate-950/90 px-2 py-3 shadow-2xl ring-1 ring-white/10 backdrop-blur-xl sm:gap-2 sm:px-3">
              <button
                onClick={toggleMute}
                disabled={!hasMicrophone}
                title={hasMicrophone ? (isMuted ? t('common.mic_on') : t('common.mic_off')) : t('video.media.microphone_unavailable')}
                aria-label={hasMicrophone ? (isMuted ? t('common.mic_on') : t('common.mic_off')) : t('video.media.microphone_unavailable')}
                className={cn(
                  'h-12 w-12 rounded-2xl flex items-center justify-center transition-all disabled:cursor-not-allowed disabled:opacity-50',
                  isMuted
                    ? 'bg-rose-500 text-white hover:bg-rose-600'
                    : 'bg-slate-700 text-white hover:bg-slate-600'
                )}
              >
                {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>

              <button
                onClick={toggleVideo}
                disabled={!hasCamera}
                title={hasCamera ? (isVideoOn ? t('common.cam_off') : t('common.cam_on')) : t('video.media.camera_unavailable')}
                aria-label={hasCamera ? (isVideoOn ? t('common.cam_off') : t('common.cam_on')) : t('video.media.camera_unavailable')}
                className={cn(
                  'h-12 w-12 rounded-2xl flex items-center justify-center transition-all disabled:cursor-not-allowed disabled:opacity-50',
                  !isVideoOn
                    ? 'bg-rose-500 text-white hover:bg-rose-600'
                    : 'bg-slate-700 text-white hover:bg-slate-600'
                )}
              >
                {isVideoOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
              </button>

              <div className="mx-1 h-8 w-px bg-slate-700" />

              <button
                onClick={handleMinimize}
                title={t('video.minimize')}
                aria-label={t('video.minimize')}
                className="h-12 w-12 rounded-2xl bg-slate-700 text-white flex items-center justify-center transition-all hover:bg-slate-600"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              {/* Завершение приёма — в той же панели, отдельным цветом. На
                  телефоне места нет: врач завершает через шторку выхода. */}
              {isDoctor && (
                <button
                  onClick={() => requestEndCall('complete')}
                  disabled={isCompletingCall}
                  title={t('video.complete_btn')}
                  aria-label={t('video.complete_btn')}
                  className="hidden h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 font-semibold text-white transition-all hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-70 sm:flex"
                >
                  {isCompletingCall ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                  <span className="text-sm">{t('video.complete_btn')}</span>
                </button>
              )}

              <button
                onClick={() => requestEndCall('leave')}
                title={t('common.leave_call')}
                aria-label={t('common.leave_call')}
                className="hidden h-12 w-16 rounded-2xl bg-rose-500 text-white items-center justify-center transition-all hover:bg-rose-600 sm:flex"
              >
                <PhoneOff className="w-5 h-5" />
              </button>
              <button
                onClick={() => setShowLeaveSheet(true)}
                title={t('common.leave_call')}
                aria-label={t('common.leave_call')}
                className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500 text-white transition-all hover:bg-rose-600 sm:hidden"
              >
                <PhoneOff className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <div className={cn(
        "bg-white flex flex-col transition-all duration-300 border-l border-slate-200 fixed sm:static inset-y-0 right-0 z-30 h-[var(--app-height)] sm:h-full pt-[var(--safe-top)] sm:pt-0",
        sidebarOpen ? "translate-x-0 w-full sm:w-96" : "translate-x-full sm:translate-x-0 sm:w-0 overflow-hidden"
      )}>
        {/* Sidebar Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setSidebarTab('chat')}
              title={t('video.tab_chat')}
              aria-label={t('video.tab_chat')}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                sidebarTab === 'chat'
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              <MessageCircle className="w-4 h-4" />
              {t('video.tab_chat')}
              {unreadChatCount > 0 && sidebarTab !== 'chat' && (
                <span className="min-w-[1.25rem] rounded-full bg-rose-500 px-1.5 py-0.5 text-xs font-semibold leading-none text-white">
                  {unreadChatCount > 9 ? '9+' : unreadChatCount}
                </span>
              )}
            </button>
            {isDoctor && (
              <button
                onClick={() => setSidebarTab('notes')}
                title={t('video.tab_notes')}
                aria-label={t('video.tab_notes')}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                  sidebarTab === 'notes'
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                )}
              >
                <ClipboardList className="w-4 h-4" />
                {t('video.tab_notes')}
              </button>
            )}
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            title={t('common.close')}
            aria-label={t('common.close')}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Chat Tab */}
        {sidebarTab === 'chat' && (
          <>
            <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-12">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                    <MessageCircle className="w-8 h-8 text-slate-300" />
                  </div>
                  <p className="text-slate-500 text-sm">{t('video.no_messages')}</p>
                  <p className="text-slate-400 text-xs mt-1">{t('video.start_chat')}</p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn('flex', msg.sender === 'me' ? 'justify-end' : 'justify-start')}
                  >
                    <div className={cn(
                      'max-w-[85%] rounded-2xl px-4 py-3',
                      msg.sender === 'me'
                        ? 'bg-teal-600 text-white rounded-br-md'
                        : 'bg-slate-100 text-slate-900 rounded-bl-md'
                    )}>
                      {msg.sender !== 'me' && (
                        <p className="text-xs font-medium text-slate-500 mb-1">{msg.senderName}</p>
                      )}
                      <p className="text-sm">{msg.text}</p>
                      {msg.attachment?.url && (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await openMediaInNewTab(msg.attachment)
                            } catch (openError) {
                              console.error('Could not open chat attachment:', openError)
                              toast.error(t('video.file_open_error'))
                            }
                          }}
                          className={cn(
                            'mt-2 inline-flex max-w-full items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                            msg.sender === 'me'
                              ? 'border-teal-300/60 bg-white/10 text-white hover:bg-white/20'
                              : 'border-slate-200 bg-white text-teal-700 hover:bg-slate-50'
                          )}
                          title={msg.attachment.name || t('common.open')}
                        >
                          <ExternalLink className="h-4 w-4 shrink-0" />
                          <span className="truncate">{t('common.open')}</span>
                        </button>
                      )}
                      <p className={cn(
                        'text-xs mt-1',
                        msg.sender === 'me' ? 'text-teal-100' : 'text-slate-400'
                      )}>
                        {msg.time.toLocaleTimeString(timeLocale, { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))
              )}
              <div ref={chatEndRef} />
            </div>

            <form onSubmit={sendMessage} className="p-4 border-t border-slate-100 pb-[calc(var(--safe-bottom)+1rem)] sm:pb-4">
              <div className="flex items-center gap-2">
                {/* Paperclip — attach file */}
                <input
                  ref={chatFileInputRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.dicom"
                  onChange={handleChatFileUpload}
                />
                <button
                  type="button"
                  onClick={() => chatFileInputRef.current?.click()}
                  disabled={isUploadingChatFile}
                  className={cn(
                    "p-3 rounded-xl transition-colors shrink-0",
                    isUploadingChatFile
                      ? "bg-teal-100 text-teal-600"
                      : "bg-slate-100 text-slate-500 hover:text-teal-600 hover:bg-teal-50"
                  )}
                  title={t('video.attach_doc')}
                  aria-label={t('video.attach_doc')}
                >
                  {isUploadingChatFile
                    ? <Loader2 className="w-5 h-5 animate-spin" />
                    : <Paperclip className="w-5 h-5" />
                  }
                </button>
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder={t('video.msg_placeholder')}
                  className="flex-1 px-4 py-3 bg-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim()}
                  title={t('common.send')}
                  aria-label={t('common.send')}
                  className={cn(
                    "p-3 rounded-xl transition-colors",
                    newMessage.trim()
                      ? "bg-teal-600 text-white hover:bg-teal-700"
                      : "bg-slate-100 text-slate-400"
                  )}
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </form>
          </>
        )}

        {/* Notes Tab (Doctor only) */}
        {sidebarTab === 'notes' && isDoctor && (
          <div className="flex-1 overflow-y-auto">
            {/* Notes Sub-tabs */}
            <div className="flex items-center gap-1.5 p-4 border-b border-slate-100 overflow-x-auto">
              {[
                { id: 'diagnosis', label: t('video.conclusion_label'), icon: Stethoscope },
                { id: 'documents', label: t('video.tab_documents'), icon: FolderOpen },
              ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setNotesTab(tab.id)}
                    title={tab.label}
                    aria-label={tab.label}
                    className={cn(
                    "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    notesTab === tab.id
                      ? "bg-teal-50 text-teal-700"
                      : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                  )}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="p-4 space-y-4">
              {notesTab === 'diagnosis' && (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-sm font-medium text-slate-700">{t('video.conclusion_label')}</label>
                      <label className="flex items-center gap-1.5 text-xs text-teal-600 cursor-pointer hover:text-teal-700">
                        <Upload className="w-3.5 h-3.5" />
                        {t('video.upload_file')}
                        <input
                          type="file"
                          className="hidden"
                          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                          onChange={handleDiagnosisFile}
                        />
                      </label>
                    </div>
                    <textarea
                      value={diagnosisText}
                      onChange={(e) => setDiagnosisText(e.target.value)}
                      className="w-full h-48 px-4 py-3 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      placeholder={t('video.conclusion_placeholder')}
                    />
                    {diagnosisFile && (
                      <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg text-sm">
                        <FileText className="w-4 h-4 text-slate-400" />
                        <span className="text-slate-600 truncate">{diagnosisFile.name}</span>
                        <button
                          onClick={() => setDiagnosisFile(null)}
                          title={t('common.remove')}
                          aria-label={t('common.remove')}
                          className="ml-auto p-1 hover:bg-slate-200 rounded"
                        >
                          <X className="w-3 h-3 text-slate-400" />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      onClick={saveDiagnosis}
                      leftIcon={<Save className="w-4 h-4" />}
                      disabled={isSavingDiagnosis || (!diagnosisText && !diagnosisFile)}
                      className="flex-1"
                    >
                      {isSavingDiagnosis ? t('video.saving') : t('video.save')}
                    </Button>
                    {diagnosisSaved && (
                      <span className="flex items-center gap-1 text-sm text-emerald-600">
                        <Check className="w-4 h-4" /> {t('video.saved')}
                      </span>
                    )}
                  </div>
                </>
              )}

              {notesTab === 'documents' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-3">
                    {t('video.patient_docs')}
                  </label>
                  {isLoadingDocs ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-6 h-6 text-teal-600 animate-spin" />
                    </div>
                  ) : patientDocuments.length === 0 ? (
                    <div className="text-center py-12">
                      <FolderOpen className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                      <p className="text-slate-500 text-sm">{t('video.no_patient_docs')}</p>
                    </div>
                  ) : (() => {
                    const typeConfig = {
                      analysis: { label: t('video.doctype_analysis'), icon: 'bg-blue-100', iconColor: 'text-blue-600', folderColor: 'bg-blue-50 border-blue-100' },
                      prescription: { label: t('video.doctype_prescription'), icon: 'bg-emerald-100', iconColor: 'text-emerald-600', folderColor: 'bg-emerald-50 border-emerald-100' },
                      certificate: { label: t('video.doctype_certificate'), icon: 'bg-violet-100', iconColor: 'text-violet-600', folderColor: 'bg-violet-50 border-violet-100' },
                      mrt: { label: t('video.doctype_mrt'), icon: 'bg-purple-100', iconColor: 'text-purple-600', folderColor: 'bg-purple-50 border-purple-100' },
                      xray: { label: t('video.doctype_xray'), icon: 'bg-rose-100', iconColor: 'text-rose-600', folderColor: 'bg-rose-50 border-rose-100' },
                      ultrasound: { label: t('video.doctype_ultrasound'), icon: 'bg-cyan-100', iconColor: 'text-cyan-600', folderColor: 'bg-cyan-50 border-cyan-100' },
                      other: { label: t('video.doctype_other'), icon: 'bg-amber-100', iconColor: 'text-amber-600', folderColor: 'bg-amber-50 border-amber-100' },
                    }
                    const grouped = patientDocuments.reduce((acc, doc) => {
                      const type = doc.type || 'other'
                      if (!acc[type]) acc[type] = []
                      acc[type].push(doc)
                      return acc
                    }, {})
                    const typeOrder = ['analysis', 'mrt', 'xray', 'ultrasound', 'prescription', 'certificate', 'other']
                    const sortedTypes = typeOrder.filter(t => grouped[t]?.length > 0)

                    return (
                      <div className="space-y-2">
                        {sortedTypes.map((type) => {
                          const config = typeConfig[type] || typeConfig.other
                          const docs = grouped[type]
                          return (
                            <details key={type} className={`rounded-xl border ${config.folderColor} overflow-hidden`}>
                              <summary className="flex items-center gap-3 p-3 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden hover:bg-white/40 transition-colors">
                                <div className={`w-9 h-9 rounded-lg ${config.icon} flex items-center justify-center flex-shrink-0`}>
                                  <Folder className={`w-4 h-4 ${config.iconColor}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className="text-sm font-medium text-slate-900">{config.label}</h4>
                                  <p className="text-xs text-slate-500">{t('video.doc_count', { count: docs.length })}</p>
                                </div>
                                <ChevronDown className="w-4 h-4 text-slate-400 transition-transform [[open]>&]:rotate-180 flex-shrink-0" />
                              </summary>
                              <div className="px-3 pb-3 space-y-1.5">
                                {docs.map((doc) => {
                                  return (
                                    <div
                                      key={doc.id}
                                      className="flex items-start gap-3 p-2.5 bg-white rounded-lg hover:bg-slate-50 transition-colors"
                                    >
                                      <div className={`w-8 h-8 rounded-lg ${config.icon} flex items-center justify-center flex-shrink-0`}>
                                        <FileText className={`w-3.5 h-3.5 ${config.iconColor}`} />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <h4 className="text-sm font-medium text-slate-900 truncate">
                                          {doc.title || t('video.doc_label')}
                                        </h4>
                                        <p className="text-xs text-slate-500 mt-0.5">
                                          {doc.createdAt && new Date(doc.createdAt).toLocaleDateString(timeLocale)}
                                        </p>
                                        {doc.description && (
                                          <p className="text-xs text-slate-600 mt-1 line-clamp-2">{doc.description}</p>
                                        )}
                                      </div>
                                      {doc.file && (
                                        <button
                                          type="button"
                                          onClick={() => openMediaInNewTab(doc.file)}
                                          title={t('common.open')}
                                          aria-label={t('common.open')}
                                          className="p-1.5 rounded-lg text-teal-600 hover:bg-teal-50 transition-colors flex-shrink-0"
                                        >
                                          <ExternalLink className="w-4 h-4" />
                                        </button>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            </details>
                          )
                        })}
                      </div>
                    )
                  })()}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {endConfirmationModal}

      {showLeaveSheet && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowLeaveSheet(false)} />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="leave-sheet-title"
            className="relative w-full max-w-sm overflow-y-auto rounded-t-3xl bg-white p-5 pb-[max(1.25rem,calc(env(safe-area-inset-bottom)+1rem))] shadow-2xl animate-scaleIn sm:rounded-2xl sm:p-6"
          >
            <h2 id="leave-sheet-title" className="text-center text-lg font-bold text-slate-900">
              {isDoctor ? t('video.leave_sheet_title_doctor') : t('video.leave_sheet_title_patient')}
            </h2>
            <p className="mt-1 text-center text-sm text-slate-500">
              {isDoctor ? t('video.leave_sheet_desc_doctor') : t('video.leave_sheet_desc_patient')}
            </p>
            <div className="mt-5 space-y-2.5">
              {isDoctor && (
                <Button
                  size="lg"
                  variant="success"
                  className="w-full"
                  onClick={() => confirmEndCall('complete')}
                  disabled={isCompletingCall}
                  leftIcon={isCompletingCall ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
                >
                  {t('video.leave_sheet_complete')}
                </Button>
              )}
              <Button
                size="lg"
                variant={isDoctor ? 'secondary' : 'danger'}
                className="w-full"
                onClick={() => confirmEndCall('leave')}
                disabled={isCompletingCall}
                leftIcon={<PhoneOff className="h-5 w-5" />}
              >
                {isDoctor ? t('video.leave_sheet_leave_only') : t('video.leave_sheet_leave')}
              </Button>
              <Button size="lg" variant="ghost" className="w-full" onClick={() => setShowLeaveSheet(false)}>
                {t('video.leave_sheet_stay')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {ratingModal}
    </div>
  )
}

export default VideoConsultation
