import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Calendar,
  Clock,
  Video,
  FileText,
  ChevronRight,
  Activity,
  Bell,
  Loader2,
  MessageCircle,
  ChevronDown,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Avatar from '../../components/ui/Avatar'
import Badge from '../../components/ui/Badge'
import useAuthStore from '../../stores/authStore'
import useAppointmentStore from '../../stores/appointmentStore'
import useDocumentStore from '../../stores/documentStore'
import useChatStore from '../../stores/chatStore'
import { getMediaUrl, getServerNow, medicalCasesAPI, normalizeResponse } from '../../services/api'
import { formatCaseStatus, normalizeCaseStatus } from '../../utils/medicalCaseWorkflow'
import CaseSlotPicker from '../../components/cases/CaseSlotPicker'
import { formatDateTimeInTimeZone, getDeviceTimeZone } from '../../utils/kazakhstanTime'

// The compact quick-action counters below replace the larger duplicated block.
// Keep the accordion implementation available so it can be restored if needed.
const SHOW_STATS_ACCORDION = false

function PatientDashboard() {
  const { t, i18n } = useTranslation()
  const viewerTimeZone = getDeviceTimeZone()
  const { user } = useAuthStore()
  const { appointments, fetchAppointments, isLoading: appointmentsLoading } = useAppointmentStore()
  const { documents, fetchDocuments, isLoading: documentsLoading } = useDocumentStore()
  const { conversations, fetchConversations, isLoading: chatsLoading } = useChatStore()
  const [medicalCases, setMedicalCases] = useState([])
  const [casesLoading, setCasesLoading] = useState(false)
  const [slotPickerCase, setSlotPickerCase] = useState(null)
  const [statsExpandedOverride, setStatsExpandedOverride] = useState(null)

  const [stats, setStats] = useState({
    totalConsultations: 0,
    upcomingCount: 0,
    documentsCount: 0,
    unreadMessages: 0,
  })

  useEffect(() => {
    if (user?.id) {
      fetchAppointments()
      fetchDocuments({ user: user.id })
      fetchConversations()
      setCasesLoading(true)
      medicalCasesAPI.getAll()
        .then((response) => {
          const { data } = normalizeResponse(response)
          setMedicalCases(Array.isArray(data) ? data : [])
        })
        .catch((error) => console.error('Error fetching medical cases:', error))
        .finally(() => setCasesLoading(false))
    }
  }, [user?.id])

  const isAppointmentPast = (appointment) => {
    const appointmentDate = new Date(appointment.dateTime)
    const consultationDuration = appointment.doctor?.consultationDuration || 30
    const bufferMinutes = 5
    const consultationEnd = new Date(appointmentDate.getTime() + (consultationDuration + bufferMinutes) * 60 * 1000)
    return getServerNow() > consultationEnd || appointment.status === 'completed'
  }

  useEffect(() => {
    const completed = appointments.filter(a =>
      a.status === 'completed' ||
      (['pending', 'confirmed'].includes(a.status) && isAppointmentPast(a))
    ).length
    const upcoming = appointments.filter(a =>
      ['pending', 'confirmed'].includes(a.status) && !isAppointmentPast(a)
    ).length
    const unread = conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0)

    setStats({
      totalConsultations: completed,
      upcomingCount: upcoming,
      documentsCount: documents.length,
      unreadMessages: unread,
    })
  }, [appointments, documents, conversations])

  const upcomingAppointments = appointments
    .filter(a => ['pending', 'confirmed'].includes(a.status) && !isAppointmentPast(a))
    .sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime))
    .slice(0, 3)

  const recentConversations = conversations.slice(0, 3)

  const hasMedicalCase = medicalCases.length > 0
  const CONSULTATION_AVAILABLE_STATUSES = [
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
    'COMPLETED',
  ]
  const hasConsultationAccess = medicalCases.some(item =>
    !!item.doctor || CONSULTATION_AVAILABLE_STATUSES.includes(normalizeCaseStatus(item.status))
  )

  const quickActions = [
    {
      label: t('patient.quick_book'),
      icon: Activity,
      to: '/patient/cases?create=1',
      color: 'bg-teal-500',
      primary: true,
      metric: casesLoading ? t('common.loading') : t('patient.quick_cases_metric', { count: medicalCases.length }),
    },
    ...(hasConsultationAccess
      ? [{
          label: t('patient.quick_appointments'),
          icon: Clock,
          to: '/patient/appointments',
          color: 'bg-sky-500',
          surface: 'border-sky-200/70 bg-gradient-to-br from-sky-50 to-cyan-50/80 group-hover:border-sky-300',
          metric: appointmentsLoading
            ? t('common.loading')
            : t('patient.quick_consultations_metric', {
                total: stats.totalConsultations,
                upcoming: stats.upcomingCount,
              }),
        }]
      : []),
    ...(hasMedicalCase
      ? [
          {
            label: t('patient.quick_messages'),
            icon: MessageCircle,
            to: '/patient/chat',
            color: 'bg-violet-500',
            surface: 'border-violet-200/70 bg-gradient-to-br from-violet-50 to-purple-50/80 group-hover:border-violet-300',
            metric: chatsLoading
              ? t('common.loading')
              : t('patient.quick_messages_metric', { count: stats.unreadMessages }),
          },
          {
            label: t('patient.quick_documents'),
            icon: FileText,
            to: '/patient/documents',
            color: 'bg-amber-500',
            surface: 'border-amber-200/70 bg-gradient-to-br from-amber-50 to-orange-50/80 group-hover:border-amber-300',
            metric: documentsLoading
              ? t('common.loading')
              : t('patient.quick_documents_metric', { count: stats.documentsCount }),
          },
        ]
      : []),
  ]

  const isLoading = appointmentsLoading || documentsLoading
  const statsLoading = appointmentsLoading || documentsLoading || chatsLoading
  const hasStatsActivity = Object.values(stats).some(value => value > 0)
  const statsExpanded = statsExpandedOverride ?? (!statsLoading && hasStatsActivity)

  const BOOKING_NEEDED_STATUSES = ['DOCTOR_ASSIGNED', 'WAITING_PATIENT_CONFIRMATION', 'UNDER_REVIEW', 'DOCUMENTS_UPLOADED']
  const casesNeedingBooking = medicalCases.filter(item =>
    !!item.doctor && BOOKING_NEEDED_STATUSES.includes(normalizeCaseStatus(item.status))
  )

  const displayName = user?.fullName?.split(' ')[1] || user?.fullName?.split(' ')[0] || user?.username

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Welcome Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
            {t('patient.greeting', { name: displayName })} 👋
          </h1>
          <p className="text-sm sm:text-base text-slate-600 mt-1">
            {t('patient.health_overview')}
          </p>
        </div>
        <Link to="/patient/cases?create=1" className="hidden sm:block">
          <Button rightIcon={<ChevronRight className="w-4 h-4" />}>
            {t('patient.book_appointment')}
          </Button>
        </Link>
      </div>

      {casesNeedingBooking.length > 0 && (
        <div className="space-y-2">
          {casesNeedingBooking.map(item => (
            <div
              key={item.documentId || item.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl"
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-amber-900">
                    {t('patient.book_slot_notice')}
                  </p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    {item.caseNumber} · {t('patient.doctor_label')}: {item.doctor?.fullName}
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => setSlotPickerCase(item)}
                leftIcon={<Calendar className="w-4 h-4" />}
              >
                {t('case_detail.book_consultation_btn')}
              </Button>
            </div>
          ))}
        </div>
      )}

      <Card className="border-teal-100">
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-teal-100 flex items-center justify-center shrink-0">
                <Activity className="w-6 h-6 text-teal-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-teal-700">{t('patient.case_label')}</p>
                {casesLoading ? (
                  <div className="flex items-center gap-2 mt-1 text-slate-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">{t('patient.case_loading')}</span>
                  </div>
                ) : medicalCases.length > 0 ? (
                  <>
                    <h2 className="text-lg font-bold text-slate-900 mt-1">
                      {medicalCases[0].caseNumber || medicalCases[0].title || t('patient.case_label')}
                    </h2>
                    <p className="text-sm text-slate-600 mt-1">
                      {t('cases.col_status')}: {formatCaseStatus(medicalCases[0].status, t)}
                      {medicalCases[0].manager?.fullName ? ` · ${t('cases.col_manager')}: ${medicalCases[0].manager.fullName}` : ''}
                    </p>
                  </>
                ) : (
                  <>
                    <h2 className="text-lg font-bold text-slate-900 mt-1">{t('patient.case_start_title')}</h2>
                    <p className="text-sm text-slate-600 mt-1">
                      {t('patient.case_start_desc')}
                    </p>
                  </>
                )}
              </div>
            </div>
            <Link to={medicalCases.length > 0 ? '/patient/cases' : '/patient/cases?create=1'}>
              <Button rightIcon={<ChevronRight className="w-4 h-4" />}>
                {medicalCases.length > 0 ? t('patient.case_open_btn') : t('patient.case_start_btn')}
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Temporarily hidden: these metrics are now shown compactly in Quick Actions. */}
      {SHOW_STATS_ACCORDION && <div>
        <button
          type="button"
          className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-white border border-slate-200 rounded-xl text-left hover:border-slate-300 transition-colors"
          aria-expanded={statsExpanded}
          aria-controls="patient-dashboard-stats"
          onClick={() => setStatsExpandedOverride(!statsExpanded)}
        >
          <div>
            <p className="font-semibold text-slate-900">{t('patient.stats_title')}</p>
            {!statsLoading && !hasStatsActivity && (
              <p className="text-sm text-slate-500 mt-0.5">{t('patient.stats_empty')}</p>
            )}
          </div>
          {statsLoading ? (
            <Loader2 className="w-5 h-5 text-slate-400 animate-spin shrink-0" />
          ) : (
            <ChevronDown className={`w-5 h-5 text-slate-500 shrink-0 transition-transform duration-300 ease-in-out motion-reduce:transition-none ${statsExpanded ? 'rotate-180' : ''}`} />
          )}
        </button>

        <div
          id="patient-dashboard-stats"
          aria-hidden={!statsExpanded}
          className={`grid transition-[grid-template-rows,opacity,margin] duration-300 ease-in-out motion-reduce:transition-none ${
            statsExpanded
              ? 'grid-rows-[1fr] opacity-100 mt-3'
              : 'grid-rows-[0fr] opacity-0 mt-0 pointer-events-none'
          }`}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 sm:gap-4">
            <Card>
              <CardContent className="flex items-center gap-4 p-4 sm:p-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-sky-500 flex items-center justify-center shrink-0">
                  <Video className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{stats.totalConsultations}</p>
                  <p className="text-sm text-slate-500">{t('patient.stat_consultations')}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-4 p-4 sm:p-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-500 flex items-center justify-center shrink-0">
                  <Calendar className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{stats.upcomingCount}</p>
                  <p className="text-sm text-slate-500">{t('patient.stat_upcoming')}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-4 p-4 sm:p-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shrink-0">
                  <FileText className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{stats.documentsCount}</p>
                  <p className="text-sm text-slate-500">{t('patient.stat_documents')}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-4 p-4 sm:p-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center shrink-0">
                  <MessageCircle className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{stats.unreadMessages}</p>
                  <p className="text-sm text-slate-500">{t('patient.stat_messages')}</p>
                </div>
              </CardContent>
            </Card>
            </div>
          </div>
        </div>
      </div>}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {quickActions.map((action) => (
          <Link
            key={action.to}
            to={action.to}
            className={`group block h-full rounded-2xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-500/30 ${
              action.primary ? 'col-span-2 md:col-span-1' : ''
            }`}
          >
            <Card
              hover={!action.primary}
              className={action.primary
                ? 'relative isolate h-full cursor-pointer overflow-hidden border-teal-400/60 bg-gradient-to-br from-teal-600 via-teal-500 to-cyan-500 text-center shadow-lg shadow-teal-600/20 transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-xl group-hover:shadow-teal-600/30'
                : `h-full cursor-pointer text-center transition-colors duration-300 ${action.surface || 'border-slate-200 bg-slate-50'}`}
            >
              {action.primary && (
                <>
                  <div className="pointer-events-none absolute -right-10 -top-12 -z-10 h-36 w-36 rounded-full bg-white/10" />
                  <div className="pointer-events-none absolute -bottom-16 -left-10 -z-10 h-40 w-40 rounded-full bg-cyan-200/10" />
                  <div className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white ring-1 ring-white/20 transition-transform duration-300 group-hover:translate-x-1">
                    <ChevronRight className="h-4 w-4" />
                  </div>
                </>
              )}
              <CardContent className={action.primary ? 'p-5 sm:p-6' : 'p-4 sm:p-6'}>
                <div className={`mx-auto flex items-center justify-center rounded-xl ${
                  action.primary
                    ? 'mb-3 h-14 w-14 bg-white/20 shadow-inner ring-1 ring-white/30'
                    : `mb-2 h-10 w-10 sm:mb-3 sm:h-12 sm:w-12 ${action.color}`
                }`}>
                  <action.icon className={action.primary ? 'h-7 w-7 text-white' : 'h-5 w-5 text-white sm:h-6 sm:w-6'} />
                </div>
                <p className={action.primary
                  ? 'text-sm font-bold text-white sm:text-base'
                  : 'font-medium text-slate-900 text-xs sm:text-sm'}>
                  {action.label}
                </p>
                <p className={`mt-1 text-[11px] leading-tight sm:text-xs ${
                  action.primary ? 'font-medium text-white/80' : 'text-slate-500'
                }`}>
                  {action.metric}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Upcoming Appointments */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{t('patient.upcoming_appointments')}</CardTitle>
              <Link to="/patient/appointments" className="text-sm text-teal-600 hover:text-teal-700">
                {t('patient.all_appointments')}
              </Link>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />
                </div>
              ) : upcomingAppointments.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                  <p className="text-slate-600">{t('patient.no_appointments')}</p>
                </div>
              ) : (
                upcomingAppointments.map((appointment) => {
                  const doctorName = appointment.doctor?.fullName || t('patient.doctor_label')
                  const specName = typeof appointment.doctor?.specialization === 'object'
                    ? appointment.doctor?.specialization?.name
                    : appointment.doctor?.specialization || ''

                  const appointmentDate = new Date(appointment.dateTime)
                  const now = getServerNow()

                  const consultationDuration = appointment.doctor?.consultationDuration || 30
                  const bufferMinutes = 5

                  const fifteenMinBefore = new Date(appointmentDate.getTime() - 15 * 60 * 1000)
                  const consultationEnd = new Date(appointmentDate.getTime() + (consultationDuration + bufferMinutes) * 60 * 1000)
                  // in_progress: doctor already joined — patient must be able to rejoin
                  const canJoin = ['confirmed', 'pending', 'in_progress'].includes(appointment.status) &&
                                  now >= fifteenMinBefore &&
                                  now <= consultationEnd

                  return (
                    <div
                      key={appointment.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-50 rounded-xl"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar
                          src={getMediaUrl(appointment.doctor?.photo)}
                          name={doctorName}
                          size="lg"
                        />
                        <div className="min-w-0">
                          <h4 className="font-medium text-slate-900 truncate">{doctorName}</h4>
                          <p className="text-sm text-slate-500 truncate">{specName}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span className="text-xs text-slate-600">
                              {formatDateTimeInTimeZone(appointment.dateTime, viewerTimeZone, i18n.language)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant={appointment.status === 'confirmed' ? 'primary' : 'default'}>
                          {appointment.type === 'video' ? t('patient.type_video') : t('patient.type_chat')}
                        </Badge>
                        {appointment.roomId && (
                          <Link to={`/consultation/${appointment.roomId}`}>
                            <Button size="sm" variant={canJoin ? 'primary' : 'secondary'} leftIcon={<Video className="w-4 h-4" />}>
                              {t('patient.join')}
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Recent Chats */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5" />
                {t('patient.recent_chats')}
              </CardTitle>
              <Link to="/patient/chat" className="text-sm text-teal-600 hover:text-teal-700">
                {t('patient.all_chats')}
              </Link>
            </CardHeader>
            <CardContent className="space-y-3">
              {chatsLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-6 h-6 text-teal-600 animate-spin" />
                </div>
              ) : recentConversations.length === 0 ? (
                <p className="text-center text-slate-500 py-4 text-sm">
                  {t('patient.no_messages')}
                </p>
              ) : (
                recentConversations.map((conv) => {
                  const participant = conv.participants?.find(p => p.id !== user?.id) || {}
                  const participantName = participant.fullName || participant.username || t('patient.interlocutor')

                  return (
                    <Link
                      key={conv.id}
                      to="/patient/chat"
                      className="block p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar name={participantName} size="sm" />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-slate-900 text-sm truncate">
                            {participantName}
                          </h4>
                          <p className="text-xs text-slate-500 truncate">
                            {conv.lastMessage?.content || t('patient.no_conv_messages')}
                          </p>
                        </div>
                        {conv.unreadCount > 0 && (
                          <span className="w-5 h-5 bg-teal-600 text-white text-xs font-medium rounded-full flex items-center justify-center">
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                    </Link>
                  )
                })
              )}
            </CardContent>
          </Card>

          {/* Health Tips */}
          <Card>
            <CardContent>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0">
                  <Activity className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h4 className="font-medium text-slate-900">{t('patient.health_tip_title')}</h4>
                  <p className="text-sm text-slate-600 mt-1">
                    {t('patient.health_tip_text')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {slotPickerCase && (
        <CaseSlotPicker
          isOpen={!!slotPickerCase}
          onClose={() => setSlotPickerCase(null)}
          doctor={slotPickerCase.doctor}
          caseDocId={slotPickerCase.documentId || slotPickerCase.id}
          patientId={user?.id}
          role="patient"
          onBooked={() => {
            setSlotPickerCase(null)
            medicalCasesAPI.getAll()
              .then(r => { const { data } = normalizeResponse(r); setMedicalCases(Array.isArray(data) ? data : []) })
              .catch(() => {})
          }}
        />
      )}
    </div>
  )
}

export default PatientDashboard
