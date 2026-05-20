import { useEffect, useMemo, useState } from 'react'
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

function patientName(item) {
  return item?.patient?.fullName || item?.patient?.email || 'Patient pending'
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
  const status = normalizeCaseStatus(item.status)
  const sla = getCaseSla(item)
  const allowedTransitions = getAllowedCaseTransitions(role, status)
  const { count: unreadCount } = getUnreadByCase(conversations, item)

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-sm text-slate-900 truncate">{item.caseNumber || item.title || `Case #${item.id}`}</p>
          <p className="text-xs text-slate-500 truncate">{patientName(item)} · {item.country || 'Country pending'}</p>
        </div>
        {unreadCount > 0 && <Badge variant="danger">{unreadCount}</Badge>}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Badge variant={STATUS_VARIANTS[status] || 'default'}>{formatCaseStatus(status)}</Badge>
        <Badge variant={item.urgency === 'urgent' ? 'danger' : item.urgency === 'soon' ? 'warning' : 'default'}>
          {item.urgency || 'routine'}
        </Badge>
        {sla.hours && <Badge variant={sla.overdue ? 'danger' : 'secondary'}>{sla.overdue ? 'SLA overdue' : `${sla.remainingHours}h SLA`}</Badge>}
      </div>

      <div className="text-xs text-slate-500 space-y-1">
        <p>Manager: {item.manager?.fullName || 'Shared queue'}</p>
        <p>Doctor: {item.doctor?.fullName || 'Not assigned'}</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button size="sm" variant="secondary" onClick={() => onClaim(item)} leftIcon={<UserCheck className="w-4 h-4" />}>Claim</Button>
        <Button size="sm" variant="secondary" onClick={() => onOpenChat(item)} leftIcon={<MessageCircle className="w-4 h-4" />}>Chat</Button>
      </div>

      <div className="grid gap-2">
        <select
          className="w-full rounded-lg bg-slate-100 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
          value=""
          onChange={(event) => event.target.value && onChangeStatus(item, event.target.value)}
          disabled={allowedTransitions.length === 0}
        >
          <option value="">Change status</option>
          {allowedTransitions.map((nextStatus) => (
            <option key={nextStatus} value={nextStatus}>{formatCaseStatus(nextStatus)}</option>
          ))}
        </select>
        <select
          className="w-full rounded-lg bg-slate-100 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
          value=""
          onChange={(event) => event.target.value && onAssignDoctor(item, event.target.value)}
        >
          <option value="">Assign doctor</option>
          {doctors.map((doctor) => (
            <option key={doctor.documentId || doctor.id} value={doctor.documentId || doctor.id}>
              {doctor.fullName}
            </option>
          ))}
        </select>
        <Button size="sm" variant="outline" onClick={() => onRequestDocs(item)} leftIcon={<FileText className="w-4 h-4" />}>Request documents</Button>
      </div>
    </div>
  )
}

function StaffDashboard() {
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
      setError(err?.response?.data?.error?.message || 'Could not load manager workspace')
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
      .filter((conversation) => conversation.medical_case)
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
          <h1 className="text-2xl font-bold text-slate-900">{role === 'coordinator' ? 'Coordinator workspace' : 'Manager workspace'}</h1>
          <p className="text-slate-600 mt-1">MedicalCase board, shared chat inbox, SLA control and patient pipeline.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={loadWorkspace}>Refresh</Button>
          <Button onClick={() => navigate(`${base}/cases`)}>Open all cases</Button>
        </div>
      </div>

      {error && <Card><CardContent className="p-4 text-sm text-rose-600">{error}</CardContent></Card>}

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { icon: AlertTriangle, label: 'SLA overdue', value: summary.overdue.length, tone: 'bg-rose-500' },
          { icon: MessageCircle, label: 'Unread chats', value: summary.unread.length, tone: 'bg-teal-500' },
          { icon: ShieldCheck, label: 'Shared queue', value: summary.shared.length, tone: 'bg-amber-500' },
          { icon: Stethoscope, label: 'Medical review', value: summary.review.length, tone: 'bg-sky-500' },
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
          <CardTitle className="flex items-center gap-2"><Filter className="w-5 h-5" />Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-4 xl:grid-cols-7 gap-3">
          <select className="rounded-lg bg-slate-100 px-3 py-2 text-sm" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
            <option value="">All statuses</option>
            {MEDICAL_CASE_STATUSES.map((status) => <option key={status} value={status}>{formatCaseStatus(status)}</option>)}
          </select>
          <select className="rounded-lg bg-slate-100 px-3 py-2 text-sm" value={filters.country} onChange={(e) => setFilters({ ...filters, country: e.target.value })}>
            <option value="">All countries</option>
            {filterOptions.countries.map((country) => <option key={country} value={country}>{country}</option>)}
          </select>
          <select className="rounded-lg bg-slate-100 px-3 py-2 text-sm" value={filters.urgency} onChange={(e) => setFilters({ ...filters, urgency: e.target.value })}>
            <option value="">All urgency</option>
            <option value="routine">Routine</option>
            <option value="soon">Soon</option>
            <option value="urgent">Urgent</option>
          </select>
          <select className="rounded-lg bg-slate-100 px-3 py-2 text-sm" value={filters.manager} onChange={(e) => setFilters({ ...filters, manager: e.target.value })}>
            <option value="">All managers</option>
            {filterOptions.managers.map((manager) => <option key={manager} value={manager}>{manager}</option>)}
          </select>
          <select className="rounded-lg bg-slate-100 px-3 py-2 text-sm" value={filters.doctor} onChange={(e) => setFilters({ ...filters, doctor: e.target.value })}>
            <option value="">All doctors</option>
            {filterOptions.doctors.map((doctor) => <option key={doctor} value={doctor}>{doctor}</option>)}
          </select>
          <label className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-sm">
            <input type="checkbox" checked={filters.unread} onChange={(e) => setFilters({ ...filters, unread: e.target.checked })} />
            Unread
          </label>
          <label className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-sm">
            <input type="checkbox" checked={filters.slaOverdue} onChange={(e) => setFilters({ ...filters, slaOverdue: e.target.checked })} />
            SLA overdue
          </label>
        </CardContent>
      </Card>

      <div className="grid xl:grid-cols-[1fr_360px] gap-6">
        <Card>
          <CardHeader>
            <CardTitle>CRM board</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <div className="flex gap-4 min-w-max pb-2">
              {boardColumns.map((column) => (
                <div key={column.status} className="w-72 shrink-0">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-slate-700">{formatCaseStatus(column.status)}</p>
                    <Badge>{column.items.length}</Badge>
                  </div>
                  <div className="space-y-3">
                    {column.items.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">No cases</div>
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
              <CardTitle className="flex items-center gap-2"><MessageCircle className="w-5 h-5" />Shared chat inbox</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {inbox.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">No case chats yet</p>
              ) : inbox.map((conversation) => {
                const item = conversation.medical_case
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
                      <p className="font-medium text-sm text-slate-900 truncate">{item?.caseNumber || item?.title || 'Case chat'}</p>
                      {conversation.unreadCount > 0 && <Badge variant="danger">{conversation.unreadCount}</Badge>}
                    </div>
                    <p className="text-xs text-slate-500 truncate mt-1">{item?.patient?.fullName || 'Patient'} · {conversation.lastMessage?.content || conversation.lastMessage || 'No messages'}</p>
                  </button>
                )
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Patient pipeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {patientPipeline.map((item) => {
                const sla = getCaseSla(item)
                const unread = getUnreadByCase(conversations, item).count
                return (
                  <button key={getCaseId(item)} type="button" onClick={() => setSelectedCase(item)} className="w-full flex items-center justify-between gap-3 text-left">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{patientName(item)}</p>
                      <p className="text-xs text-slate-500 truncate">{formatCaseStatus(item.status)} · {item.treatmentCategory || 'Direction pending'}</p>
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
          <CardTitle>Productivity</CardTitle>
        </CardHeader>
        <CardContent>
          {!selectedCase ? (
            <div className="text-center py-10">
              <CheckCircle className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p className="font-medium text-slate-900">Select a case on the board</p>
              <p className="text-sm text-slate-500">Internal notes, reminders and patient timeline will appear here.</p>
            </div>
          ) : (
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2 font-semibold text-slate-900"><NotebookPen className="w-5 h-5" />Internal notes</div>
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  rows={4}
                  className="w-full rounded-lg bg-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="Add an internal note"
                />
                <Button size="sm" onClick={handleAddNote}>Save note</Button>
                {selectedCase.internalNotes && <pre className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs text-slate-600 max-h-48 overflow-auto">{selectedCase.internalNotes}</pre>}
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 font-semibold text-slate-900"><Bell className="w-5 h-5" />Reminders</div>
                <input
                  value={reminderText}
                  onChange={(e) => setReminderText(e.target.value)}
                  className="w-full rounded-lg bg-slate-100 px-3 py-2 text-sm"
                  placeholder="Reminder"
                />
                <input
                  value={reminderDueAt}
                  onChange={(e) => setReminderDueAt(e.target.value)}
                  className="w-full rounded-lg bg-slate-100 px-3 py-2 text-sm"
                  type="datetime-local"
                />
                <Button size="sm" variant="secondary" onClick={handleAddReminder}>Add reminder</Button>
              </div>

              <div>
                <div className="flex items-center gap-2 font-semibold text-slate-900 mb-3"><Clock className="w-5 h-5" />Patient timeline</div>
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
