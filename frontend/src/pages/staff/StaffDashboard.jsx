import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  Bell,
  CheckCircle,
  Clock,
  FileText,
  Filter,
  Loader2,
  MessageCircle,
  NotebookPen,
  ShieldCheck,
  Stethoscope,
  UserCheck,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import useAuthStore from '../../stores/authStore'
import useChatStore from '../../stores/chatStore'
import { caseEventsAPI, doctorsAPI, medicalCasesAPI, normalizeResponse } from '../../services/api'
import {
  MEDICAL_CASE_STATUSES,
  STATUS_VARIANTS,
  formatCaseStatus,
  getAllowedCaseTransitions,
  getCaseSla,
  normalizeCaseStatus,
} from '../../utils/medicalCaseWorkflow'
import { cn } from '../../utils/helpers'

function roleBase(role) {
  if (role === 'admin') return '/admin'
  if (role === 'coordinator') return '/coordinator'
  return '/manager'
}

function getCaseId(item) {
  return item?.documentId || item?.id
}

function patientName(item, t) {
  return item?.patient?.fullName || item?.patient?.email || (t ? t('staff.patient_pending') : 'Patient pending')
}

function getUnreadByCase(conversations, item) {
  const caseId = getCaseId(item)
  const conversation = conversations.find((conv) => {
    const convCase = conv.medical_case
    return String(convCase?.documentId || convCase?.id) === String(caseId)
  })
  return { conversation, count: conversation?.unreadCount || 0 }
}

function CaseCard({ item, role, doctors, conversations, onClaim, onAssignDoctor, onChangeStatus, onOpenChat, onRequestDocs }) {
  const { t } = useTranslation()
  const status = normalizeCaseStatus(item.status)
  const sla = getCaseSla(item)
  const allowedTransitions = getAllowedCaseTransitions(role, status)
  const { count: unreadCount } = getUnreadByCase(conversations, item)

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-sm text-slate-900 truncate">{item.caseNumber || item.title || `Case #${item.id}`}</p>
          <p className="text-xs text-slate-500 truncate">{patientName(item, t)} · {item.country || t('staff.country_pending')}</p>
        </div>
        {unreadCount > 0 && <Badge variant="danger">{unreadCount}</Badge>}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Badge variant={STATUS_VARIANTS[status] || 'default'}>{formatCaseStatus(status, t)}</Badge>
        <Badge variant={item.urgency === 'urgent' ? 'danger' : item.urgency === 'soon' ? 'warning' : 'default'}>
          {t(`urgency.${item.urgency || 'routine'}`)}
        </Badge>
        {sla.hours && <Badge variant={sla.overdue ? 'danger' : 'secondary'}>{sla.overdue ? t('staff.sla_overdue_badge') : t('staff.sla_hours', { hours: sla.remainingHours })}</Badge>}
      </div>

      <div className="text-xs text-slate-500 space-y-1">
        <p>{t('staff.manager_label')}: {item.manager?.fullName || t('staff.shared_queue')}</p>
        <p>{t('staff.doctor_label')}: {item.doctor?.fullName || t('staff.not_assigned')}</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button size="sm" variant="secondary" onClick={() => onClaim(item)} leftIcon={<UserCheck className="w-4 h-4" />}>{t('staff.claim')}</Button>
        <Button size="sm" variant="secondary" onClick={() => onOpenChat(item)} leftIcon={<MessageCircle className="w-4 h-4" />}>{t('nav.chat')}</Button>
      </div>

      <div className="grid gap-2">
        <select
          className="w-full rounded-lg bg-slate-100 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
          value=""
          onChange={(event) => event.target.value && onChangeStatus(item, event.target.value)}
          disabled={allowedTransitions.length === 0}
        >
          <option value="">{t('staff.change_status')}</option>
          {allowedTransitions.map((nextStatus) => (
            <option key={nextStatus} value={nextStatus}>{formatCaseStatus(nextStatus, t)}</option>
          ))}
        </select>
        <select
          className="w-full rounded-lg bg-slate-100 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
          value=""
          onChange={(event) => event.target.value && onAssignDoctor(item, event.target.value)}
        >
          <option value="">{t('staff.assign_doctor')}</option>
          {doctors.map((doctor) => (
            <option key={doctor.documentId || doctor.id} value={doctor.documentId || doctor.id}>
              {doctor.fullName}
            </option>
          ))}
        </select>
        <Button size="sm" variant="outline" onClick={() => onRequestDocs(item)} leftIcon={<FileText className="w-4 h-4" />}>{t('staff.request_docs')}</Button>
      </div>
    </div>
  )
}

function StaffDashboard() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const role = user?.userRole || 'manager'
  const base = roleBase(role)
  const {
    conversations,
    fetchConversations,
    joinStaffQueue,
    getOrCreateCaseConversation,
    setCurrentConversation,
  } = useChatStore()
  const [cases, setCases] = useState([])
  const [doctors, setDoctors] = useState([])
  const [selectedCase, setSelectedCase] = useState(null)
  const [noteText, setNoteText] = useState('')
  const [reminderText, setReminderText] = useState('')
  const [reminderDueAt, setReminderDueAt] = useState('')
  const [filters, setFilters] = useState({
    status: '',
    country: '',
    urgency: '',
    manager: '',
    doctor: '',
    unread: false,
    slaOverdue: false,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const loadWorkspace = async () => {
    setIsLoading(true)
    setError('')
    try {
      const [casesResponse, doctorsResponse] = await Promise.all([
        medicalCasesAPI.getAll({ sort: 'updatedAt:desc' }),
        doctorsAPI.getAll({ includeInactive: true }),
        fetchConversations(),
      ])
      const casesData = normalizeResponse(casesResponse).data
      const doctorsData = normalizeResponse(doctorsResponse).data
      setCases(Array.isArray(casesData) ? casesData : [])
      setDoctors(Array.isArray(doctorsData) ? doctorsData : [])
      joinStaffQueue()
    } catch (err) {
      setError(err?.response?.data?.error?.message || t('staff.load_error'))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadWorkspace()
  }, [])

  const filterOptions = useMemo(() => ({
    countries: [...new Set(cases.map((item) => item.country).filter(Boolean))],
    managers: [...new Set(cases.map((item) => item.manager?.fullName).filter(Boolean))],
    doctors: [...new Set(cases.map((item) => item.doctor?.fullName).filter(Boolean))],
  }), [cases])

  const filteredCases = useMemo(() => {
    return cases.filter((item) => {
      const status = normalizeCaseStatus(item.status)
      const sla = getCaseSla(item)
      const unread = getUnreadByCase(conversations, item).count
      if (filters.status && status !== filters.status) return false
      if (filters.country && item.country !== filters.country) return false
      if (filters.urgency && item.urgency !== filters.urgency) return false
      if (filters.manager && item.manager?.fullName !== filters.manager) return false
      if (filters.doctor && item.doctor?.fullName !== filters.doctor) return false
      if (filters.unread && unread === 0) return false
      if (filters.slaOverdue && !sla.overdue) return false
      return true
    })
  }, [cases, conversations, filters])

  const summary = useMemo(() => {
    const unread = filteredCases.filter((item) => getUnreadByCase(conversations, item).count > 0)
    const overdue = filteredCases.filter((item) => getCaseSla(item).overdue)
    const shared = filteredCases.filter((item) => !item.manager)
    const review = filteredCases.filter((item) => ['DOCUMENTS_UPLOADED', 'UNDER_REVIEW', 'DOCTOR_ASSIGNED'].includes(normalizeCaseStatus(item.status)))
    return { unread, overdue, shared, review }
  }, [filteredCases, conversations])

  const boardColumns = useMemo(() => {
    return MEDICAL_CASE_STATUSES
      .map((status) => ({
        status,
        items: filteredCases.filter((item) => normalizeCaseStatus(item.status) === status),
      }))
      .filter((column) => column.items.length > 0 || ['NEW_LEAD', 'WAITING_FOR_DOCUMENTS', 'UNDER_REVIEW', 'DOCTOR_ASSIGNED', 'TRAVEL_PREPARATION'].includes(column.status))
  }, [filteredCases])

  const inbox = useMemo(() => (
    [...conversations]
      .filter((conversation) => conversation.medical_case || conversation.channel === 'support')
      .sort((a, b) => (b.unreadCount || 0) - (a.unreadCount || 0) || new Date(b.lastMessageAt || b.updatedAt) - new Date(a.lastMessageAt || a.updatedAt))
      .slice(0, 12)
  ), [conversations])

  const patientPipeline = useMemo(() => (
    [...filteredCases]
      .sort((a, b) => {
        const aSla = getCaseSla(a)
        const bSla = getCaseSla(b)
        if (aSla.overdue !== bSla.overdue) return aSla.overdue ? -1 : 1
        return (getUnreadByCase(conversations, b).count || 0) - (getUnreadByCase(conversations, a).count || 0)
      })
      .slice(0, 10)
  ), [filteredCases, conversations])

  const updateCaseLocal = (updated) => {
    setCases((items) => items.map((item) => (String(getCaseId(item)) === String(getCaseId(updated)) ? updated : item)))
    setSelectedCase((current) => (current && String(getCaseId(current)) === String(getCaseId(updated)) ? updated : current))
  }

  const handleCaseUpdate = async (item, data) => {
    const response = await medicalCasesAPI.update(getCaseId(item), data)
    const updated = normalizeResponse(response).data
    updateCaseLocal(updated)
    return updated
  }

  const handleClaim = async (item) => {
    await handleCaseUpdate(item, role === 'coordinator' ? { coordinator: user.documentId || user.id } : { manager: user.documentId || user.id })
  }

  const handleAssignDoctor = async (item, doctorId) => {
    const payload = { doctor: doctorId }
    if (normalizeCaseStatus(item.status) === 'UNDER_REVIEW') payload.status = 'DOCTOR_ASSIGNED'
    await handleCaseUpdate(item, payload)
  }

  const handleChangeStatus = async (item, status) => {
    await handleCaseUpdate(item, { status })
  }

  const handleOpenChat = async (item) => {
    const conversation = item.conversation || await getOrCreateCaseConversation(getCaseId(item))
    if (conversation) setCurrentConversation(conversation)
    navigate(`${base}/chat`)
  }

  const handleRequestDocs = async (item) => {
    const updated = await handleCaseUpdate(item, { status: 'WAITING_FOR_DOCUMENTS' })
    await caseEventsAPI.create({
      medical_case: getCaseId(updated),
      eventType: 'DOCUMENT_REQUESTED',
      message: 'Documents requested from patient',
      metadata: { source: 'manager_workspace' },
    })
  }

  const handleAddNote = async () => {
    if (!selectedCase || !noteText.trim()) return
    const existing = selectedCase.internalNotes ? `${selectedCase.internalNotes}\n` : ''
    const updated = await handleCaseUpdate(selectedCase, { internalNotes: `${existing}${new Date().toISOString()} - ${noteText.trim()}` })
    await caseEventsAPI.create({
      medical_case: getCaseId(updated),
      eventType: 'NOTE',
      message: noteText.trim(),
      metadata: { source: 'manager_workspace' },
    })
    setNoteText('')
  }

  const handleAddReminder = async () => {
    if (!selectedCase || !reminderText.trim()) return
    await caseEventsAPI.create({
      medical_case: getCaseId(selectedCase),
      eventType: 'REMINDER_CREATED',
      message: reminderText.trim(),
      metadata: { dueAt: reminderDueAt || null, source: 'manager_workspace' },
    })
    setSelectedCase({
      ...selectedCase,
      case_events: [
        ...(selectedCase.case_events || []),
        {
          id: `local-${Date.now()}`,
          eventType: 'REMINDER_CREATED',
          message: reminderText.trim(),
          metadata: { dueAt: reminderDueAt || null },
          createdAt: new Date().toISOString(),
        },
      ],
    })
    setReminderText('')
    setReminderDueAt('')
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-9 h-9 animate-spin text-teal-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{role === 'coordinator' ? t('staff.coordinator_title') : t('staff.manager_title')}</h1>
          <p className="text-slate-600 mt-1">{t('staff.subtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={loadWorkspace}>{t('staff.refresh')}</Button>
          <Button onClick={() => navigate(`${base}/cases`)}>{t('staff.open_all_cases')}</Button>
        </div>
      </div>

      {error && <Card><CardContent className="p-4 text-sm text-rose-600">{error}</CardContent></Card>}

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { icon: AlertTriangle, label: t('staff.stat_sla_overdue'), value: summary.overdue.length, tone: 'bg-rose-500' },
          { icon: MessageCircle, label: t('staff.stat_unread_chats'), value: summary.unread.length, tone: 'bg-teal-500' },
          { icon: ShieldCheck, label: t('staff.stat_shared_queue'), value: summary.shared.length, tone: 'bg-amber-500' },
          { icon: Stethoscope, label: t('staff.stat_medical_review'), value: summary.review.length, tone: 'bg-sky-500' },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className={cn('w-11 h-11 rounded-lg flex items-center justify-center', stat.tone)}>
                <stat.icon className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
                <p className="text-sm text-slate-500">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Filter className="w-5 h-5" />{t('staff.filters_title')}</CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-4 xl:grid-cols-7 gap-3">
          <select className="rounded-lg bg-slate-100 px-3 py-2 text-sm" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
            <option value="">{t('staff.all_statuses')}</option>
            {MEDICAL_CASE_STATUSES.map((status) => <option key={status} value={status}>{formatCaseStatus(status, t)}</option>)}
          </select>
          <select className="rounded-lg bg-slate-100 px-3 py-2 text-sm" value={filters.country} onChange={(e) => setFilters({ ...filters, country: e.target.value })}>
            <option value="">{t('staff.all_countries')}</option>
            {filterOptions.countries.map((country) => <option key={country} value={country}>{country}</option>)}
          </select>
          <select className="rounded-lg bg-slate-100 px-3 py-2 text-sm" value={filters.urgency} onChange={(e) => setFilters({ ...filters, urgency: e.target.value })}>
            <option value="">{t('staff.all_urgency')}</option>
            <option value="routine">{t('urgency.routine')}</option>
            <option value="soon">{t('urgency.soon')}</option>
            <option value="urgent">{t('urgency.urgent')}</option>
          </select>
          <select className="rounded-lg bg-slate-100 px-3 py-2 text-sm" value={filters.manager} onChange={(e) => setFilters({ ...filters, manager: e.target.value })}>
            <option value="">{t('staff.all_managers')}</option>
            {filterOptions.managers.map((manager) => <option key={manager} value={manager}>{manager}</option>)}
          </select>
          <select className="rounded-lg bg-slate-100 px-3 py-2 text-sm" value={filters.doctor} onChange={(e) => setFilters({ ...filters, doctor: e.target.value })}>
            <option value="">{t('staff.all_doctors')}</option>
            {filterOptions.doctors.map((doctor) => <option key={doctor} value={doctor}>{doctor}</option>)}
          </select>
          <label className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-sm">
            <input type="checkbox" checked={filters.unread} onChange={(e) => setFilters({ ...filters, unread: e.target.checked })} />
            {t('staff.filter_unread')}
          </label>
          <label className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-sm">
            <input type="checkbox" checked={filters.slaOverdue} onChange={(e) => setFilters({ ...filters, slaOverdue: e.target.checked })} />
            {t('staff.filter_sla_overdue')}
          </label>
        </CardContent>
      </Card>

      <div className="grid xl:grid-cols-[1fr_360px] gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('staff.crm_board')}</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <div className="flex gap-4 min-w-max pb-2">
              {boardColumns.map((column) => (
                <div key={column.status} className="w-72 shrink-0">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-slate-700">{formatCaseStatus(column.status, t)}</p>
                    <Badge>{column.items.length}</Badge>
                  </div>
                  <div className="space-y-3">
                    {column.items.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">{t('staff.no_cases')}</div>
                    ) : (
                      column.items.map((item) => (
                        <div key={getCaseId(item)} onClick={() => setSelectedCase(item)} className="block w-full text-left">
                          <CaseCard
                            item={item}
                            role={role}
                            doctors={doctors}
                            conversations={conversations}
                            onClaim={handleClaim}
                            onAssignDoctor={handleAssignDoctor}
                            onChangeStatus={handleChangeStatus}
                            onOpenChat={handleOpenChat}
                            onRequestDocs={handleRequestDocs}
                          />
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><MessageCircle className="w-5 h-5" />{t('staff.shared_chat_inbox')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {inbox.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">{t('staff.no_case_chats')}</p>
              ) : inbox.map((conversation) => {
                const item = conversation.medical_case
                const isSupportChat = conversation.channel === 'support'
                const supportPatient = conversation.participants?.find((person) => !['manager', 'coordinator', 'admin'].includes(person?.userRole))
                const supportName = conversation.guestName || supportPatient?.fullName || supportPatient?.username || conversation.guestContact
                const title = isSupportChat
                  ? t('staff.support_chat_fallback')
                  : item?.caseNumber || item?.title || t('staff.case_chat_fallback')
                const subtitle = isSupportChat
                  ? supportName || t('staff.support_guest_fallback')
                  : item?.patient?.fullName || t('cases.patient_fallback')
                return (
                  <button
                    key={conversation.documentId || conversation.id}
                    type="button"
                    onClick={() => {
                      setCurrentConversation(conversation)
                      navigate(`${base}/chat`)
                    }}
                    className="w-full rounded-lg border border-slate-100 p-3 text-left hover:bg-slate-50"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-sm text-slate-900 truncate">{title}</p>
                      {conversation.unreadCount > 0 && <Badge variant="danger">{conversation.unreadCount}</Badge>}
                    </div>
                    <p className="text-xs text-slate-500 truncate mt-1">{subtitle} · {conversation.lastMessage?.content || conversation.lastMessage || t('staff.no_messages')}</p>
                  </button>
                )
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('staff.patient_pipeline')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {patientPipeline.map((item) => {
                const sla = getCaseSla(item)
                const unread = getUnreadByCase(conversations, item).count
                return (
                  <button key={getCaseId(item)} type="button" onClick={() => setSelectedCase(item)} className="w-full flex items-center justify-between gap-3 text-left">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{patientName(item)}</p>
                      <p className="text-xs text-slate-500 truncate">{formatCaseStatus(item.status, t)} · {item.treatmentCategory || t('staff.direction_pending')}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {unread > 0 && <Badge variant="danger">{unread}</Badge>}
                      {sla.overdue && <AlertTriangle className="w-4 h-4 text-rose-500" />}
                    </div>
                  </button>
                )
              })}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('staff.productivity')}</CardTitle>
        </CardHeader>
        <CardContent>
          {!selectedCase ? (
            <div className="text-center py-10">
              <CheckCircle className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p className="font-medium text-slate-900">{t('staff.select_case_hint')}</p>
              <p className="text-sm text-slate-500">{t('staff.select_case_desc')}</p>
            </div>
          ) : (
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2 font-semibold text-slate-900"><NotebookPen className="w-5 h-5" />{t('staff.internal_notes')}</div>
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  rows={4}
                  className="w-full rounded-lg bg-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder={t('staff.note_placeholder')}
                />
                <Button size="sm" onClick={handleAddNote}>{t('staff.save_note')}</Button>
                {selectedCase.internalNotes && <pre className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs text-slate-600 max-h-48 overflow-auto">{selectedCase.internalNotes}</pre>}
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 font-semibold text-slate-900"><Bell className="w-5 h-5" />{t('staff.reminders')}</div>
                <input
                  value={reminderText}
                  onChange={(e) => setReminderText(e.target.value)}
                  className="w-full rounded-lg bg-slate-100 px-3 py-2 text-sm"
                  placeholder={t('staff.reminder_placeholder')}
                />
                <input
                  value={reminderDueAt}
                  onChange={(e) => setReminderDueAt(e.target.value)}
                  className="w-full rounded-lg bg-slate-100 px-3 py-2 text-sm"
                  type="datetime-local"
                />
                <Button size="sm" variant="secondary" onClick={handleAddReminder}>{t('staff.add_reminder')}</Button>
              </div>

              <div>
                <div className="flex items-center gap-2 font-semibold text-slate-900 mb-3"><Clock className="w-5 h-5" />{t('staff.patient_timeline')}</div>
                <div className="space-y-3 max-h-72 overflow-auto">
                  {[...(selectedCase.case_events || [])]
                    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
                    .map((event) => (
                      <div key={event.documentId || event.id} className="border-l-2 border-teal-200 pl-3">
                        <p className="text-xs font-semibold text-slate-700">{event.eventType || 'EVENT'}</p>
                        <p className="text-sm text-slate-600">{event.message || 'Case event'}</p>
                        <p className="text-xs text-slate-400">{event.createdAt ? new Date(event.createdAt).toLocaleString() : ''}</p>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default StaffDashboard
