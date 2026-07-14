import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Calendar,
  Check,
  Clock,
  FileText,
  Loader2,
  MessageSquare,
  Paperclip,
  Stethoscope,
  Upload,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import Select from '../ui/Select'
import Textarea from '../ui/Textarea'
import { useToast } from '../ui/Toast'
import useAuthStore from '../../stores/authStore'
import { appointmentsAPI, openMediaInNewTab, uploadFile } from '../../services/api'
import { cn } from '../../utils/helpers'

const WINDOW_HOURS = 48

function getRef(value) {
  return value?.documentId || value?.id || ''
}

function appointmentStatus(appointment) {
  return appointment?.statuse || appointment?.status || 'pending'
}

function statusVariant(status) {
  if (status === 'completed') return 'success'
  if (status === 'cancelled' || status === 'no_show') return 'danger'
  return 'primary'
}

function CaseConsultationsPanel({ medicalCase, selectedAppointmentId, onSelectAppointment, onChanged }) {
  const { t, i18n } = useTranslation()
  const toast = useToast()
  const { user } = useAuthStore()
  const role = user?.userRole || user?.role?.type || 'patient'
  const isDoctor = role === 'doctor'
  const canSeeInternalFeedback = ['doctor', 'manager', 'coordinator', 'admin'].includes(role)
  const dateLocale = i18n.language === 'kk' ? 'kk-KZ' : i18n.language === 'en' ? 'en-US' : 'ru-RU'

  const appointments = useMemo(() => (
    [...(medicalCase?.appointments || [])]
      .filter(item => item?.dateTime)
      .sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime())
  ), [medicalCase?.appointments])

  const selectedAppointment = useMemo(() => {
    const requested = appointments.find(item => String(getRef(item)) === String(selectedAppointmentId || ''))
    return requested || appointments[0] || null
  }, [appointments, selectedAppointmentId])

  const appointmentDocuments = useMemo(() => {
    if (!selectedAppointment) return []
    const appointmentId = getRef(selectedAppointment)
    return (medicalCase?.medical_documents || []).filter(doc => (
      String(getRef(doc.appointment)) === String(appointmentId)
    ))
  }, [medicalCase?.medical_documents, selectedAppointment])

  const conclusionDocument = useMemo(() => (
    appointmentDocuments.find(doc => doc.type === 'certificate') || null
  ), [appointmentDocuments])

  const [conclusionText, setConclusionText] = useState('')
  const [conclusionFile, setConclusionFile] = useState(null)
  const [doctorDecision, setDoctorDecision] = useState('')
  const [doctorDecisionNotes, setDoctorDecisionNotes] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!selectedAppointment) return
    setConclusionText(conclusionDocument?.description || '')
    setConclusionFile(conclusionDocument?.file || null)
    setDoctorDecision(selectedAppointment.doctorDecision || '')
    setDoctorDecisionNotes(selectedAppointment.doctorDecisionNotes || '')
    setSaved(false)
  }, [selectedAppointment, conclusionDocument])

  useEffect(() => {
    if (selectedAppointment && !selectedAppointmentId) {
      onSelectAppointment?.(getRef(selectedAppointment))
    }
  }, [onSelectAppointment, selectedAppointment, selectedAppointmentId])

  const status = appointmentStatus(selectedAppointment)
  const consultationDuration = Number(selectedAppointment?.doctor?.consultationDuration) || 30
  const consultationEnd = selectedAppointment?.dateTime
    ? new Date(new Date(selectedAppointment.dateTime).getTime() + (consultationDuration + 5) * 60 * 1000)
    : null
  const editWindowEnd = consultationEnd
    ? new Date(consultationEnd.getTime() + WINDOW_HOURS * 60 * 60 * 1000)
    : null
  const canEdit = isDoctor
    && !['cancelled', 'no_show'].includes(status)
    && (!consultationEnd || new Date() >= consultationEnd)
    && (!editWindowEnd || new Date() < editWindowEnd)

  const handleFile = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setIsUploading(true)
    try {
      const uploaded = await uploadFile(file)
      setConclusionFile(uploaded)
      setSaved(false)
    } catch (error) {
      toast.error(error?.response?.data?.error?.message || t('case_consultations.upload_error'))
    } finally {
      setIsUploading(false)
      event.target.value = ''
    }
  }

  const saveConsultationOutput = async () => {
    if (!selectedAppointment || !canEdit) return
    setIsSaving(true)
    try {
      const appointmentId = getRef(selectedAppointment)
      await appointmentsAPI.saveOutput(appointmentId, {
        conclusionTitle: t('case_consultations.conclusion_document_title'),
        conclusionText,
        ...(conclusionFile?.id && getRef(conclusionFile) !== getRef(conclusionDocument?.file)
          ? { conclusionFileId: conclusionFile.id }
          : {}),
        doctorDecision: doctorDecision || null,
        doctorDecisionNotes,
      })

      setSaved(true)
      toast.success(t('case_consultations.saved'))
      await onChanged?.()
    } catch (error) {
      toast.error(error?.response?.data?.error?.message || t('case_consultations.save_error'))
    } finally {
      setIsSaving(false)
    }
  }

  if (appointments.length === 0) {
    return (
      <Card>
        <CardContent className="py-14 text-center">
          <Calendar className="mx-auto mb-3 h-12 w-12 text-slate-300" />
          <p className="font-medium text-slate-800">{t('case_consultations.empty_title')}</p>
          <p className="mt-1 text-sm text-slate-500">{t('case_consultations.empty_description')}</p>
        </CardContent>
      </Card>
    )
  }

  const decisionOptions = [
    { value: 'treatment_required', label: t('case_consultations.decision_treatment') },
    { value: 'no_treatment_needed', label: t('case_consultations.decision_local') },
    { value: 'needs_more_documents', label: t('case_consultations.decision_more_documents') },
  ]

  return (
    <div className="grid gap-6 xl:grid-cols-[20rem_minmax(0,1fr)]">
      <Card className="h-fit">
        <CardHeader>
          <CardTitle>{t('case_consultations.list_title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {appointments.map(appointment => {
            const id = getRef(appointment)
            const currentStatus = appointmentStatus(appointment)
            const active = String(id) === String(getRef(selectedAppointment))
            return (
              <button
                type="button"
                key={id}
                onClick={() => onSelectAppointment?.(id)}
                className={cn(
                  'w-full rounded-xl border p-3 text-left transition-colors',
                  active
                    ? 'border-teal-300 bg-teal-50'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {new Date(appointment.dateTime).toLocaleDateString(dateLocale, {
                        day: '2-digit', month: 'short', year: 'numeric',
                      })}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                      <Clock className="h-3.5 w-3.5" />
                      {new Date(appointment.dateTime).toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <Badge variant={statusVariant(currentStatus)}>
                    {t(`appointment.status_${currentStatus}`, { defaultValue: currentStatus })}
                  </Badge>
                </div>
              </button>
            )
          })}
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Stethoscope className="h-5 w-5 text-teal-600" />
              {t('case_consultations.workspace_title')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs text-slate-500">{t('case_consultations.date')}</p>
                <p className="mt-1 text-sm font-medium text-slate-900">
                  {new Date(selectedAppointment.dateTime).toLocaleString(dateLocale, {
                    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
                  })}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs text-slate-500">{t('case_consultations.purpose')}</p>
                <p className="mt-1 text-sm font-medium text-slate-900">
                  {t(`case_consultations.purpose_${selectedAppointment.consultationPurpose || 'initial_case_review'}`)}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs text-slate-500">{t('case_consultations.status')}</p>
                <Badge className="mt-1" variant={statusVariant(status)}>
                  {t(`appointment.status_${status}`, { defaultValue: status })}
                </Badge>
              </div>
            </div>

            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <label className="text-sm font-medium text-slate-700">{t('case_consultations.conclusion')}</label>
                {canEdit && (
                  <label className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-medium text-teal-600 hover:text-teal-700">
                    {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    {t('case_consultations.attach_conclusion')}
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                      onChange={handleFile}
                      disabled={isUploading}
                    />
                  </label>
                )}
              </div>
              <Textarea
                value={conclusionText}
                onChange={(event) => { setConclusionText(event.target.value); setSaved(false) }}
                rows={6}
                disabled={!canEdit}
                placeholder={t('case_consultations.conclusion_placeholder')}
              />
              {conclusionFile && (
                <button
                  type="button"
                  onClick={() => openMediaInNewTab(conclusionFile)}
                  className="mt-2 flex max-w-full items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
                >
                  <Paperclip className="h-4 w-4 shrink-0" />
                  <span className="truncate">{conclusionFile.name || t('case_consultations.conclusion_file')}</span>
                </button>
              )}
            </div>

            {canSeeInternalFeedback && (
              <div className="space-y-3 border-t border-slate-100 pt-5">
                <div>
                  <p className="text-sm font-medium text-slate-800">{t('case_consultations.internal_feedback')}</p>
                  <p className="mt-1 text-xs text-slate-500">{t('case_consultations.internal_feedback_help')}</p>
                </div>
                <Select
                  label={t('case_consultations.decision')}
                  value={doctorDecision}
                  onChange={(event) => { setDoctorDecision(event.target.value); setSaved(false) }}
                  options={decisionOptions}
                  placeholder={t('case_consultations.decision_placeholder')}
                  disabled={!canEdit}
                />
                <Textarea
                  label={t('case_consultations.feedback_notes')}
                  value={doctorDecisionNotes}
                  onChange={(event) => { setDoctorDecisionNotes(event.target.value); setSaved(false) }}
                  rows={4}
                  disabled={!canEdit}
                  placeholder={t('case_consultations.feedback_placeholder')}
                />
              </div>
            )}

            {isDoctor && !canEdit && (
              <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500">
                {consultationEnd && new Date() < consultationEnd
                  ? t('case_consultations.not_ended')
                  : t('case_consultations.read_only')}
              </p>
            )}

            {canEdit && (
              <div className="flex justify-end">
                <Button
                  onClick={saveConsultationOutput}
                  disabled={isSaving || isUploading}
                  leftIcon={isSaving
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : saved
                      ? <Check className="h-4 w-4" />
                      : <Stethoscope className="h-4 w-4" />}
                  variant={saved ? 'success' : 'primary'}
                >
                  {saved ? t('case_consultations.saved') : t('case_consultations.save_output')}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-teal-600" />
              {t('case_consultations.chat_history')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedAppointment.chatLog?.length > 0 ? (
              <div className="max-h-96 space-y-3 overflow-y-auto pr-1">
                {selectedAppointment.chatLog.map((message, index) => (
                  <div key={`${message.time || 'message'}-${index}`} className="rounded-xl bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-medium text-slate-600">{message.senderName || t('case_consultations.participant')}</p>
                      {message.time && (
                        <time className="text-xs text-slate-400">
                          {new Date(message.time).toLocaleString(dateLocale, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </time>
                      )}
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{message.text}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center">
                <MessageSquare className="mx-auto mb-2 h-10 w-10 text-slate-300" />
                <p className="text-sm text-slate-500">{t('case_consultations.no_chat_history')}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {appointmentDocuments.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-teal-600" />
                {t('case_consultations.consultation_documents')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {appointmentDocuments.map(doc => (
                <button
                  type="button"
                  key={getRef(doc)}
                  onClick={() => doc.file && openMediaInNewTab(doc.file)}
                  disabled={!doc.file}
                  className="flex w-full items-center gap-3 rounded-xl border border-slate-100 p-3 text-left hover:bg-slate-50 disabled:cursor-default"
                >
                  <FileText className="h-5 w-5 shrink-0 text-teal-600" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{doc.title}</p>
                    {doc.description && <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{doc.description}</p>}
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

export default CaseConsultationsPanel
