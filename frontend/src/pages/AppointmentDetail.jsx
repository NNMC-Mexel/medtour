import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Calendar,
  Clock,
  Video,
  MessageCircle,
  User,
  FileText,
  ExternalLink,
  Loader2,
  Stethoscope,
  Phone,
  Mail,
  FolderOpen,
  Lock,
  Check,
  Paperclip,
  X,
  MessageSquare,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card'
import Button from '../components/ui/Button'
import Avatar from '../components/ui/Avatar'
import Badge from '../components/ui/Badge'
import useAuthStore from '../stores/authStore'
import { useTranslation } from 'react-i18next'
import { appointmentsAPI, documentsAPI, uploadFile, getMediaUrl, openMediaInNewTab } from '../services/api'
import { getSpecName } from '../utils/helpers'

// 48-hour window for post-consultation notes
const WINDOW_HOURS = 48

function AppointmentDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const dateLocale = i18n.language === 'kk' ? 'kk-KZ' : i18n.language === 'en' ? 'en-US' : 'ru-RU'
  const { user } = useAuthStore()
  const userRole = user?.userRole || 'patient'
  const isDoctor = userRole === 'doctor'

  const [appointment, setAppointment] = useState(null)
  const [documents, setDocuments] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  // Post-consultation notes state (doctors only)
  const [diagnosisText, setDiagnosisText] = useState('')
  const [diagnosisFile, setDiagnosisFile] = useState(null)
  const [existingDocIds, setExistingDocIds] = useState({ certificate: null })
  const [isSavingDiagnosis, setIsSavingDiagnosis] = useState(false)
  const [diagnosisSaved, setDiagnosisSaved] = useState(false)
  const [isUploadingFile, setIsUploadingFile] = useState(false)
  const [doctorDecision, setDoctorDecision] = useState('')
  const [doctorDecisionNotes, setDoctorDecisionNotes] = useState('')
  const [isSavingDoctorDecision, setIsSavingDoctorDecision] = useState(false)
  const [doctorDecisionSaved, setDoctorDecisionSaved] = useState(false)

  useEffect(() => {
    const fetchAppointment = async () => {
      setIsLoading(true)
      try {
        const response = await appointmentsAPI.getOne(id)
        const apt = response.data?.data || response.data
        setAppointment(apt)
      } catch (err) {
        console.error('Error fetching appointment:', err)
      } finally {
        setIsLoading(false)
      }
    }
    if (id) fetchAppointment()
  }, [id])

  useEffect(() => {
    if (!appointment) return
    const aptDocs = appointment.medical_documents || []
    setDocuments(aptDocs)
    setDoctorDecision(appointment.doctorDecision || '')
    setDoctorDecisionNotes(appointment.doctorDecisionNotes || '')
  }, [appointment])

  // Preload existing documents into notes fields
  useEffect(() => {
    if (!documents.length) return
    const cert = documents.find(d => d.type === 'certificate')

    if (cert) {
      setDiagnosisText(cert.description || '')
      setExistingDocIds(prev => ({ ...prev, certificate: cert.documentId || cert.id }))
      if (cert.file) setDiagnosisFile(cert.file)
    }
  }, [documents])

  const backPath = isDoctor ? '/doctor' : '/patient/appointments'

  const openAttachment = async (media) => {
    try {
      await openMediaInNewTab(media)
    } catch (error) {
      console.error('Could not open attachment:', error)
    }
  }

  // ── Save functions ──────────────────────────────────────────────

  const handleDiagnosisFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsUploadingFile(true)
    try {
      const uploaded = await uploadFile(file)
      setDiagnosisFile(uploaded)
    } catch (err) {
      console.error('Error uploading file:', err)
    } finally {
      setIsUploadingFile(false)
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
          ...(diagnosisFile?.id && { file: diagnosisFile.id }),
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

  const saveDoctorDecision = async () => {
    if (!appointment?.documentId) return
    setIsSavingDoctorDecision(true)
    try {
      const response = await appointmentsAPI.update(appointment.documentId, {
        doctorDecision: doctorDecision || null,
        doctorDecisionNotes,
      })
      const updated = response.data?.data || response.data
      setAppointment(prev => ({
        ...prev,
        doctorDecision: updated?.doctorDecision ?? doctorDecision,
        doctorDecisionNotes: updated?.doctorDecisionNotes ?? doctorDecisionNotes,
      }))
      setDoctorDecisionSaved(true)
      setTimeout(() => setDoctorDecisionSaved(false), 2000)
    } catch (err) {
      console.error('Error saving doctor decision:', err)
    } finally {
      setIsSavingDoctorDecision(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />
      </div>
    )
  }

  if (!appointment) {
    return (
      <div className="p-6">
        <div className="text-center py-16">
          <p className="text-slate-500 mb-4">{t('appointment_detail.not_found')}</p>
          <Button onClick={() => navigate(backPath)}>{t('appointment_detail.back')}</Button>
        </div>
      </div>
    )
  }

  const doctorName = appointment.doctor?.fullName || t('video.doctor')
  const specName = getSpecName(appointment.doctor?.specialization, i18n.language)
  const patientName =
    appointment.patient?.fullName ||
    appointment.patient?.username ||
    appointment.patient?.email?.split('@')[0] ||
    t('video.patient')

  const appointmentDate = new Date(appointment.dateTime)
  const formattedDate = appointmentDate.toLocaleDateString(dateLocale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const formattedTime = appointmentDate.toLocaleTimeString(dateLocale, {
    hour: '2-digit',
    minute: '2-digit',
  })

  const statusMap = {
    confirmed: { label: t('appointment_detail.status_confirmed'), variant: 'success' },
    pending: { label: t('appointment_detail.status_pending'), variant: 'default' },
    cancelled: { label: t('appointment_detail.status_cancelled'), variant: 'danger' },
    completed: { label: t('appointment_detail.status_completed'), variant: 'success' },
  }

  const status = statusMap[appointment.status || appointment.statuse] || statusMap.pending

  const consultationDuration = appointment.doctor?.consultationDuration || 30
  const bufferMinutes = 5
  const consultationEnd = new Date(
    appointmentDate.getTime() + (consultationDuration + bufferMinutes) * 60 * 1000
  )
  const isPast = new Date() > consultationEnd || (appointment.statuse || appointment.status) === 'completed'

  // 48-hour post-consultation window
  const windowEnd = new Date(consultationEnd.getTime() + WINDOW_HOURS * 60 * 60 * 1000)
  const now = new Date()
  const isWithinWindow = now < windowEnd
  const hoursRemaining = Math.max(0, Math.floor((windowEnd - now) / (1000 * 60 * 60)))
  const isCompleted = isPast && (appointment.statuse || appointment.status) !== 'cancelled'

  const typeLabels = {
    analysis: t('appointment_detail.doctype_analysis'),
    prescription: t('appointment_detail.doctype_prescription'),
    certificate: t('appointment_detail.doctype_certificate'),
    other: t('appointment_detail.doctype_other'),
  }

  const doctorDecisionOptions = [
    { value: '', label: t('appointment_detail.private_decision_placeholder') },
    { value: 'treatment_required', label: t('appointment_detail.private_decision_treatment_kz') },
    { value: 'no_treatment_needed', label: t('appointment_detail.private_decision_local') },
    { value: 'needs_more_documents', label: t('appointment_detail.private_decision_more_docs') },
  ]
  const visibleDocuments = documents.filter(doc => !['other', 'prescription'].includes(doc.type))

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Back button */}
      <Link
        to={backPath}
        className="inline-flex items-center gap-2 text-slate-600 hover:text-teal-600 transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="text-sm font-medium">{t('appointment_detail.back')}</span>
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">{t('appointment_detail.title')}</h1>
        <div className="flex items-center gap-2">
          {isPast && (appointment.status || appointment.statuse) !== 'cancelled' ? (
            <Badge variant="success">{t('appointment_detail.status_completed')}</Badge>
          ) : (
            <Badge variant={status.variant}>{status.label}</Badge>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Appointment Info Card */}
          <Card>
            <CardContent>
              <div className="flex items-start gap-5">
                <Avatar
                  src={getMediaUrl(isDoctor ? appointment.patient?.avatar : appointment.doctor?.photo)}
                  name={isDoctor ? patientName : doctorName}
                  size="lg"
                />
                <div className="flex-1">
                  <h2 className="text-xl font-semibold text-slate-900">
                    {isDoctor ? patientName : doctorName}
                  </h2>
                  {!isDoctor && specName && (
                    <p className="text-teal-600 font-medium mt-0.5">{specName}</p>
                  )}

                  <div className="flex flex-wrap gap-4 mt-4">
                    <div className="flex items-center gap-2 text-slate-600">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      <span className="text-sm">{formattedDate}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600">
                      <Clock className="w-4 h-4 text-slate-400" />
                      <span className="text-sm">{formattedTime}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600">
                      {appointment.type === 'video' ? (
                        <Video className="w-4 h-4 text-slate-400" />
                      ) : (
                        <MessageCircle className="w-4 h-4 text-slate-400" />
                      )}
                      <span className="text-sm">
                        {appointment.type === 'video' ? t('appointment_detail.type_video') : t('appointment_detail.type_chat')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Post-Consultation Notes (Doctor only, completed appointments) */}
          {isDoctor && isCompleted && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Stethoscope className="w-5 h-5 text-teal-600" />
                    {t('appointment_detail.notes_title')}
                  </div>
                  {isWithinWindow ? (
                    <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg">
                      {t('appointment_detail.hours_left', { hours: hoursRemaining })}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
                      <Lock className="w-3 h-3" />
                      {t('appointment_detail.locked')}
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Lock banner */}
                {!isWithinWindow && (
                  <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200 mb-4">
                    <Lock className="w-5 h-5 text-slate-400 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-slate-700">{t('appointment_detail.window_expired_title')}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {t('appointment_detail.window_info', { hours: WINDOW_HOURS })}
                      </p>
                    </div>
                  </div>
                )}

                <div className="mb-4">
                  <p className="text-sm font-medium text-slate-700">
                    {t('appointment_detail.conclusion_label')}
                  </p>
                </div>

                <div className="space-y-3">
                  <textarea
                    value={diagnosisText}
                    onChange={e => setDiagnosisText(e.target.value)}
                    disabled={!isWithinWindow}
                    placeholder={t('appointment_detail.conclusion_placeholder')}
                    rows={5}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
                  />
                  {isWithinWindow && (
                    <div className="flex items-center gap-3 flex-wrap">
                      <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-teal-500 hover:bg-teal-50 transition-colors text-sm text-slate-600">
                        <Paperclip className="w-4 h-4" />
                        {isUploadingFile
                          ? t('appointment_detail.uploading')
                          : diagnosisFile
                          ? (diagnosisFile.name || t('appointment_detail.file_attached'))
                          : t('appointment_detail.attach_file')}
                        <input
                          type="file"
                          className="hidden"
                          onChange={handleDiagnosisFile}
                          disabled={isUploadingFile}
                        />
                      </label>
                      {diagnosisFile && (
                        <button
                          onClick={() => setDiagnosisFile(null)}
                          className="p-1 text-slate-400 hover:text-rose-500 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}
                  {!isWithinWindow && diagnosisFile && (
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Paperclip className="w-4 h-4 text-slate-400" />
                      <span>{diagnosisFile.name || t('appointment_detail.file_attached')}</span>
                      {diagnosisFile.url && (
                        <button
                          type="button"
                          onClick={() => openAttachment(diagnosisFile)}
                          className="text-teal-600 hover:underline"
                        >
                          {t('appointment_detail.open')}
                        </button>
                      )}
                    </div>
                  )}
                  {isWithinWindow && (
                    <Button
                      size="sm"
                      onClick={saveDiagnosis}
                      isLoading={isSavingDiagnosis}
                      leftIcon={diagnosisSaved ? <Check className="w-4 h-4" /> : null}
                      className={diagnosisSaved ? 'bg-green-600! hover:bg-green-700!' : ''}
                    >
                      {diagnosisSaved ? t('appointment_detail.saved') : t('appointment_detail.save')}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Internal doctor opinion (staff only, never shown to patient) */}
          {isDoctor && isCompleted && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-teal-600" />
                    {t('appointment_detail.private_notes_title')}
                  </div>
                  <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
                    {t('appointment_detail.staff_only')}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-slate-500">
                  {t('appointment_detail.private_notes_help')}
                </p>
                <select
                  value={doctorDecision}
                  onChange={e => setDoctorDecision(e.target.value)}
                  disabled={!isWithinWindow}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
                >
                  {doctorDecisionOptions.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <textarea
                  value={doctorDecisionNotes}
                  onChange={e => setDoctorDecisionNotes(e.target.value)}
                  disabled={!isWithinWindow}
                  placeholder={t('appointment_detail.private_notes_placeholder')}
                  rows={5}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
                />
                {isWithinWindow && (
                  <Button
                    size="sm"
                    onClick={saveDoctorDecision}
                    isLoading={isSavingDoctorDecision}
                    leftIcon={doctorDecisionSaved ? <Check className="w-4 h-4" /> : null}
                    className={doctorDecisionSaved ? 'bg-green-600! hover:bg-green-700!' : ''}
                  >
                    {doctorDecisionSaved ? t('appointment_detail.saved') : t('appointment_detail.save')}
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* Chat History Card */}
          {appointment.chatLog?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-teal-600" />
                  {t('appointment_detail.chat_history')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                  {appointment.chatLog.map((msg, idx) => {
                    const currentUserName = user?.fullName || user?.username || ''
                    const isMe = msg.senderName === currentUserName
                    return (
                      <div
                        key={idx}
                        className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                      >
                        <span className="text-xs text-slate-400 mb-1 px-1">{msg.senderName}</span>
                        <div
                          className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm ${
                            isMe
                              ? 'bg-teal-600 text-white rounded-br-sm'
                              : 'bg-slate-100 text-slate-900 rounded-bl-sm'
                          }`}
                        >
                          <p className="whitespace-pre-wrap wrap-break-word">{msg.text}</p>
                          {msg.time && (
                            <p className={`text-xs mt-1 ${isMe ? 'text-teal-100' : 'text-slate-400'}`}>
                              {new Date(msg.time).toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Documents Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-teal-600" />
                {t('appointment_detail.medical_docs')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {visibleDocuments.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                  <p className="text-slate-500 text-sm">{t('appointment_detail.no_docs')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {visibleDocuments.map((doc) => {
                    return (
                      <div
                        key={doc.id}
                        className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors"
                      >
                        <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                          <FileText className="w-5 h-5 text-amber-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium text-slate-900">
                            {doc.title || t('appointment_detail.doc_label')}
                          </h4>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {typeLabels[doc.type] || doc.type}
                            {doc.createdAt && (
                              <> &middot; {new Date(doc.createdAt).toLocaleDateString(dateLocale)}</>
                            )}
                          </p>
                          {doc.description && (
                            <p className="text-sm text-slate-600 mt-2 whitespace-pre-wrap">
                              {doc.description}
                            </p>
                          )}
                        </div>
                        {doc.file?.url && (
                          <button
                            type="button"
                            onClick={() => openAttachment(doc.file)}
                            className="p-2 rounded-lg text-teal-600 hover:bg-teal-50 transition-colors shrink-0"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Contact Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {isDoctor ? t('video.patient') : t('video.doctor')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <User className="w-4 h-4 text-slate-400" />
                  <span className="text-sm text-slate-700">
                    {isDoctor ? patientName : doctorName}
                  </span>
                </div>
                {!isDoctor && specName && (
                  <div className="flex items-center gap-3">
                    <Stethoscope className="w-4 h-4 text-slate-400" />
                    <span className="text-sm text-slate-700">{specName}</span>
                  </div>
                )}
                {!isDoctor && appointment.doctor?.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-slate-400" />
                    <span className="text-sm text-slate-700">
                      {appointment.doctor.phone}
                    </span>
                  </div>
                )}
                {!isDoctor && appointment.doctor?.email && (
                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4 text-slate-400" />
                    <span className="text-sm text-slate-700">
                      {appointment.doctor.email}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Window info card (doctor only, completed) */}
          {isDoctor && isCompleted && (
            <Card>
              <CardContent>
                <div className="flex items-center gap-2 mb-2">
                  {isWithinWindow ? (
                    <div className="w-2 h-2 rounded-full bg-amber-400" />
                  ) : (
                    <Lock className="w-4 h-4 text-slate-400" />
                  )}
                  <p className="text-sm font-medium text-slate-700">
                    {isWithinWindow ? t('appointment_detail.window_open') : t('appointment_detail.window_closed')}
                  </p>
                </div>
                <p className="text-xs text-slate-500">
                  {isWithinWindow
                    ? t('appointment_detail.window_available', { hours: hoursRemaining })
                    : t('appointment_detail.window_expired_detail', { hours: WINDOW_HOURS })}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

export default AppointmentDetail
