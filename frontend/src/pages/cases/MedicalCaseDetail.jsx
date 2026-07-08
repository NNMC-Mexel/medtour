import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle,
  CreditCard,
  FileText,
  Upload,
  Loader2,
  Plane,
  Save,
  Stethoscope,
  UserRound,
  Info,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Select from '../../components/ui/Select'
import Textarea from '../../components/ui/Textarea'
import Input from '../../components/ui/Input'
import { useToast } from '../../components/ui/Toast'
import useAuthStore from '../../stores/authStore'
import CaseSlotPicker from '../../components/cases/CaseSlotPicker'
import {
  documentsAPI,
  clinicsAPI,
  doctorsAPI,
  medicalCasesAPI,
  normalizeResponse,
  openMediaInNewTab,
  treatmentPlansAPI,
  tripChecklistsAPI,
  usersAPI,
  visaRequestsAPI,
  tourismPackagesAPI,
  caseEventsAPI,
  financeLedgerAPI,
  uploadFile,
} from '../../services/api'
import {
  formatCaseStatus,
  getAllowedCaseTransitions,
  getCaseSla,
  normalizeCaseStatus,
  STATUS_VARIANTS,
} from '../../utils/medicalCaseWorkflow'

function formatStatus(status, t) {
  return formatCaseStatus(status, t)
}

function roleBase(role) {
  if (role === 'admin') return '/admin'
  if (role === 'manager') return '/manager'
  if (role === 'coordinator') return '/coordinator'
  if (role === 'doctor') return '/doctor'
  return '/patient'
}

function getRef(value) {
  return value?.documentId || value?.id || ''
}

function formatDesiredDate(value) {
  if (!value) return ''
  if (typeof value === 'string') return value
  return value.preferredArrivalDate || value.arrivalDate || value.from || ''
}

function formatFallbackEventType(type) {
  return type ? type.replaceAll('_', ' ') : 'Event'
}

function formatEventTitle(event, t) {
  const type = event?.eventType || 'EVENT'
  return t(`case_detail.event_type.${type}`, { defaultValue: formatFallbackEventType(type) })
}

function formatEventMessage(event, t) {
  const type = event?.eventType
  if (type === 'STATUS_CHANGED') {
    return t('case_detail.event_message.STATUS_CHANGED', {
      from: formatStatus(event.fromStatus, t),
      to: formatStatus(event.toStatus, t),
    })
  }
  if (type === 'DOCTOR_DECISION') {
    const decision = event?.metadata?.decision || 'unknown'
    return t(`case_detail.event_message.DOCTOR_DECISION.${decision}`, {
      defaultValue: event.message || event.createdAt,
    })
  }
  const translated = t(`case_detail.event_message.${type}`, { defaultValue: '' })
  return translated || event?.message || event?.createdAt || ''
}

function DetailRow({ label, value }) {
  return (
    <div className="flex justify-between gap-4 py-2 border-b border-slate-100 last:border-b-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-medium text-slate-900 text-right">{value || '—'}</span>
    </div>
  )
}

function TimelineItem({ icon: Icon, title, value, muted }) {
  const { t } = useTranslation()
  return (
    <div className="flex items-start gap-3">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${muted ? 'bg-slate-100 text-slate-400' : 'bg-teal-100 text-teal-600'}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-sm font-medium text-slate-900">{title}</p>
        <p className="text-sm text-slate-500">{value || t('case_detail.not_assigned_placeholder')}</p>
      </div>
    </div>
  )
}

const NEXT_STEP_STYLES = {
  NEW_LEAD: 'bg-sky-50 border-sky-200 text-sky-800',
  REGISTERED: 'bg-amber-50 border-amber-200 text-amber-800',
  WAITING_FOR_DOCUMENTS: 'bg-amber-50 border-amber-200 text-amber-800',
  DOCUMENTS_UPLOADED: 'bg-sky-50 border-sky-200 text-sky-800',
  UNDER_REVIEW: 'bg-sky-50 border-sky-200 text-sky-800',
  DOCTOR_ASSIGNED: 'bg-sky-50 border-sky-200 text-sky-800',
  WAITING_PATIENT_CONFIRMATION: 'bg-violet-50 border-violet-200 text-violet-800',
  WAITING_PAYMENT: 'bg-amber-50 border-amber-200 text-amber-800',
  CONSULTATION_BOOKED: 'bg-teal-50 border-teal-200 text-teal-800',
  CONSULTATION_COMPLETED: 'bg-sky-50 border-sky-200 text-sky-800',
  LOCAL_TREATMENT: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  TREATMENT_IN_KAZAKHSTAN: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  TRAVEL_PREPARATION: 'bg-sky-50 border-sky-200 text-sky-800',
  ARRIVED_TO_KAZAKHSTAN: 'bg-teal-50 border-teal-200 text-teal-800',
  IN_TREATMENT: 'bg-teal-50 border-teal-200 text-teal-800',
  RECOVERY: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  COMPLETED: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  CANCELLED: 'bg-slate-50 border-slate-200 text-slate-600',
}

const DOCUMENT_REVIEW_STATUSES = [
  'REQUESTED',
  'UPLOADED',
  'IN_REVIEW',
  'APPROVED',
  'REJECTED',
  'TRANSLATION_NEEDED',
  'TRANSLATED',
]

const DOCUMENT_STATUS_VARIANTS = {
  REQUESTED: 'warning',
  UPLOADED: 'primary',
  IN_REVIEW: 'secondary',
  APPROVED: 'success',
  REJECTED: 'danger',
  TRANSLATION_NEEDED: 'warning',
  TRANSLATED: 'success',
}

function PatientNextStep({ status }) {
  const { t } = useTranslation()
  const normalized = normalizeCaseStatus(status)
  const message = t(`case_next_step.${normalized}`, { defaultValue: '' })
  if (!message) return null
  const style = NEXT_STEP_STYLES[normalized] || 'bg-sky-50 border-sky-200 text-sky-800'
  return (
    <div className={`flex items-start gap-3 rounded-xl border p-4 ${style}`}>
      <Info className="w-5 h-5 mt-0.5 shrink-0" />
      <p className="text-sm leading-relaxed">{message}</p>
    </div>
  )
}

function CaseDocumentsPanel({ medicalCase, onUploaded }) {
  const { t } = useTranslation()
  const toast = useToast()
  const { user } = useAuthStore()
  const role = user?.userRole || 'patient'
  const canReview = ['admin', 'manager', 'coordinator', 'doctor'].includes(role)
  const [file, setFile] = useState(null)
  const [title, setTitle] = useState('')
  const [type, setType] = useState('other')
  const [description, setDescription] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [savingDocId, setSavingDocId] = useState(null)
  // Synchronous guard against double-submit (the isUploading state disables the
  // button only after a re-render, leaving a fast double-click window).
  const uploadingRef = useRef(false)

  const docs = medicalCase.medical_documents || []

  const submit = async (event) => {
    event.preventDefault()
    if (!file) {
      toast.warning(t('case_detail.toast_doc_choose'))
      return
    }
    if (uploadingRef.current) return
    uploadingRef.current = true
    setIsUploading(true)
    try {
      const uploaded = await uploadFile(file)
      await documentsAPI.create({
        title: title || file.name.replace(/\.[^/.]+$/, ''),
        type,
        description,
        file: uploaded.id,
        user: medicalCase.patient?.documentId || medicalCase.patient?.id || user?.documentId || user?.id,
        medical_case: medicalCase.documentId || medicalCase.id,
      })
      toast.success(t('case_detail.toast_doc_uploaded'))
      setFile(null)
      setTitle('')
      setDescription('')
      setType('other')
      onUploaded?.()
    } catch (error) {
      toast.error(error?.response?.data?.error?.message || error.message || t('case_detail.toast_doc_error'))
      // Clear file on error to prevent double-upload if user retries
      setFile(null)
    } finally {
      setIsUploading(false)
      uploadingRef.current = false
    }
  }

  const updateDocumentReview = async (doc, patch) => {
    const docId = doc.documentId || doc.id
    setSavingDocId(docId)
    try {
      await documentsAPI.update(docId, patch)
      toast.success(t('case_detail.toast_doc_review_saved'))
      onUploaded?.()
    } catch (error) {
      toast.error(error?.response?.data?.error?.message || t('case_detail.toast_doc_review_error'))
    } finally {
      setSavingDocId(null)
    }
  }

  const openDocument = async (doc) => {
    try {
      await openMediaInNewTab(doc.file)
    } catch (error) {
      toast.error(error?.response?.data?.error?.message || t('documents.preview_unavailable'))
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('case_detail.section_docs')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <form onSubmit={submit} className="grid lg:grid-cols-4 gap-3 items-end">
          <Input
            label={t('documents.doc_name_label')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('case_detail.doc_name_placeholder')}
          />
          <Select
            label={t('documents.doc_type_label')}
            value={type}
            onChange={(e) => setType(e.target.value)}
            options={[
              { value: 'analysis', label: t('documents.type_analysis') },
              { value: 'certificate', label: t('documents.type_certificate') },
              { value: 'mrt', label: t('documents.type_mrt') },
              { value: 'xray', label: t('documents.type_xray') },
              { value: 'ultrasound', label: t('documents.type_ultrasound') },
              { value: 'other', label: t('documents.type_other') },
            ]}
          />
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('documents.file_label')}</label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={(e) => {
                const nextFile = e.target.files?.[0] || null
                setFile(nextFile)
                if (nextFile && !title) setTitle(nextFile.name.replace(/\.[^/.]+$/, ''))
              }}
              className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-teal-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-teal-700 hover:file:bg-teal-100"
            />
          </div>
          <Button type="submit" disabled={isUploading} leftIcon={isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}>
            {t('documents.upload_action')}
          </Button>
          <Textarea
            containerClassName="lg:col-span-4"
            label={t('documents.description')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
        </form>

        {docs.length === 0 ? (
          <div className="text-sm text-slate-500 bg-slate-50 rounded-xl p-4">
            {t('documents.empty_all')}
          </div>
        ) : (
          <div className="divide-y divide-slate-100 rounded-xl border border-slate-100 overflow-hidden">
            {docs.map(doc => {
              const reviewStatus = doc.reviewStatus || 'UPLOADED'
              const docId = doc.documentId || doc.id
              return (
                <div key={docId} className="flex flex-col gap-3 p-4">
                  <div className="flex items-start gap-3">
                    <FileText className="w-5 h-5 text-teal-600 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-slate-900">{doc.title}</p>
                        <Badge variant={DOCUMENT_STATUS_VARIANTS[reviewStatus] || 'default'}>
                          {t(`case_detail.doc_status_${reviewStatus.toLowerCase()}`, { defaultValue: reviewStatus })}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-500">{doc.type || 'other'}{doc.description ? ` · ${doc.description}` : ''}</p>
                      {doc.reviewNotes && <p className="text-xs text-slate-600 mt-1">{doc.reviewNotes}</p>}
                      {doc.dueDate && <p className="text-xs text-amber-700 mt-1">{t('case_detail.doc_due_date')}: {doc.dueDate}</p>}
                    </div>
                    {doc.file && (
                      <Button size="sm" variant="outline" className="shrink-0" onClick={() => openDocument(doc)}>
                        {t('case_detail.doc_open_btn')}
                      </Button>
                    )}
                  </div>
                  {canReview && (
                    <div className="grid md:grid-cols-[220px_1fr_160px_auto] gap-3 items-end">
                      <Select
                        label={t('case_detail.doc_review_status')}
                        value={reviewStatus}
                        onChange={(e) => updateDocumentReview(doc, { reviewStatus: e.target.value })}
                        options={DOCUMENT_REVIEW_STATUSES.map(value => ({
                          value,
                          label: t(`case_detail.doc_status_${value.toLowerCase()}`, { defaultValue: value }),
                        }))}
                      />
                      <Input
                        label={t('case_detail.doc_review_notes')}
                        defaultValue={doc.reviewNotes || ''}
                        onBlur={(e) => e.target.value !== (doc.reviewNotes || '') && updateDocumentReview(doc, { reviewNotes: e.target.value })}
                        placeholder={t('case_detail.doc_review_notes_placeholder')}
                      />
                      <Input
                        label={t('case_detail.doc_due_date')}
                        type="date"
                        defaultValue={doc.dueDate || ''}
                        onBlur={(e) => e.target.value !== (doc.dueDate || '') && updateDocumentReview(doc, { dueDate: e.target.value || null })}
                      />
                      {savingDocId === docId && <Loader2 className="w-5 h-5 animate-spin text-teal-600 mb-3" />}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function TreatmentPlanPanel({ medicalCase, plans, canEdit, canApprove, onChanged }) {
  const { t } = useTranslation()
  const toast = useToast()
  const currentPlan = plans[0] || null
  const [isSaving, setIsSaving] = useState(false)
  const [saveState, setSaveState] = useState('idle')
  const [form, setForm] = useState({
    status: currentPlan?.status || 'DRAFT',
    treatmentNeeded: currentPlan?.treatmentNeeded ?? true,
    diagnosisSummary: currentPlan?.diagnosisSummary || '',
    doctorDecisionNotes: currentPlan?.doctorDecisionNotes || '',
    proceduresText: Array.isArray(currentPlan?.procedures)
      ? currentPlan.procedures.map(item => item?.name || item?.procedure || String(item)).join('\n')
      : '',
    estimatedDurationDays: currentPlan?.estimatedDurationDays || '',
    totalCost: currentPlan?.totalCost || '',
    currency: currentPlan?.currency || 'USD',
    recommendations: currentPlan?.recommendations || '',
  })

  useEffect(() => {
    setForm({
      status: currentPlan?.status || 'DRAFT',
      treatmentNeeded: currentPlan?.treatmentNeeded ?? true,
      diagnosisSummary: currentPlan?.diagnosisSummary || '',
      doctorDecisionNotes: currentPlan?.doctorDecisionNotes || '',
      proceduresText: Array.isArray(currentPlan?.procedures)
        ? currentPlan.procedures.map(item => item?.name || item?.procedure || String(item)).join('\n')
        : '',
      estimatedDurationDays: currentPlan?.estimatedDurationDays || '',
      totalCost: currentPlan?.totalCost || '',
      currency: currentPlan?.currency || 'USD',
      recommendations: currentPlan?.recommendations || '',
    })
  }, [currentPlan?.documentId, currentPlan?.id])

  const update = (key, value) => {
    setSaveState('idle')
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const save = async () => {
    setIsSaving(true)
    try {
      const procedures = form.proceduresText
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .map(name => ({ name }))

      const payload = {
        title: `Treatment plan for ${medicalCase.caseNumber || medicalCase.title || 'case'}`,
        medical_case: medicalCase.documentId || medicalCase.id,
        clinic: medicalCase.clinic?.documentId || medicalCase.clinic?.id || null,
        doctor: medicalCase.doctor?.documentId || medicalCase.doctor?.id || null,
        status: form.status,
        treatmentNeeded: Boolean(form.treatmentNeeded),
        diagnosisSummary: form.diagnosisSummary,
        doctorDecisionNotes: form.doctorDecisionNotes,
        procedures,
        estimatedDurationDays: form.estimatedDurationDays ? Number(form.estimatedDurationDays) : null,
        totalCost: form.totalCost ? Number(form.totalCost) : null,
        currency: form.currency,
        recommendations: form.recommendations,
        ...(form.status === 'SENT' && !currentPlan?.sentAt ? { sentAt: new Date().toISOString() } : {}),
        ...(form.status === 'ACCEPTED' && !currentPlan?.acceptedAt ? { acceptedAt: new Date().toISOString() } : {}),
      }

      if (currentPlan) {
        await treatmentPlansAPI.update(currentPlan.documentId || currentPlan.id, payload)
      } else {
        await treatmentPlansAPI.create(payload)
      }

      if (form.status === 'ACCEPTED' && normalizeCaseStatus(medicalCase.status) === 'TREATMENT_IN_KAZAKHSTAN') {
        await medicalCasesAPI.update(medicalCase.documentId || medicalCase.id, {
          status: 'TRAVEL_PREPARATION',
        })
      }

      toast.success(t('case_detail.toast_plan_saved'))
      setSaveState('saved')
      onChanged?.()
    } catch (error) {
      toast.error(error?.response?.data?.error?.message || t('case_detail.toast_plan_error'))
    } finally {
      setIsSaving(false)
    }
  }

  const patientDecision = async (planStatus) => {
    if (!currentPlan) return
    setIsSaving(true)
    try {
      await treatmentPlansAPI.update(currentPlan.documentId || currentPlan.id, { status: planStatus })

      const caseId = medicalCase.documentId || medicalCase.id
      const currentCaseStatus = normalizeCaseStatus(medicalCase.status)

      if (planStatus === 'ACCEPTED' && currentCaseStatus === 'WAITING_PATIENT_CONFIRMATION') {
        await medicalCasesAPI.update(caseId, { status: 'WAITING_PAYMENT' })
        await caseEventsAPI.create({
          medical_case: caseId,
          eventType: 'PLAN_ACCEPTED',
          fromStatus: medicalCase.status,
          toStatus: 'WAITING_PAYMENT',
          message: 'Patient accepted the treatment plan.',
          metadata: { planId: currentPlan.documentId || currentPlan.id },
        })
      } else if (planStatus === 'DECLINED' && currentCaseStatus === 'WAITING_PATIENT_CONFIRMATION') {
        await medicalCasesAPI.update(caseId, { status: 'DOCTOR_ASSIGNED' })
        await caseEventsAPI.create({
          medical_case: caseId,
          eventType: 'PLAN_DECLINED',
          fromStatus: medicalCase.status,
          toStatus: 'DOCTOR_ASSIGNED',
          message: 'Patient declined the treatment plan.',
          metadata: { planId: currentPlan.documentId || currentPlan.id },
        })
      }

      toast.success(planStatus === 'ACCEPTED' ? t('case_detail.toast_plan_accepted') : t('case_detail.toast_plan_declined'))
      onChanged?.()
    } catch (error) {
      toast.error(error?.response?.data?.error?.message || t('case_detail.toast_plan_decision_error'))
    } finally {
      setIsSaving(false)
    }
  }

  if (!canEdit && !currentPlan) {
    return (
      <Card>
        <CardHeader><CardTitle>{t('case_detail.section_treatment_plan')}</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500">{t('appointment_detail.no_docs')}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>{t('case_detail.section_treatment_plan')}</CardTitle>
          {currentPlan && <Badge variant={currentPlan.status === 'ACCEPTED' ? 'success' : currentPlan.status === 'SENT' ? 'primary' : 'warning'}>{t(`case_detail.plan_status_${currentPlan.status.toLowerCase()}`, { defaultValue: currentPlan.status })}</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {canEdit ? (
          <>
            <div className="grid md:grid-cols-3 gap-4">
              <Select
                label={t('case_detail.plan_status_label')}
                value={form.status}
                onChange={(e) => update('status', e.target.value)}
                options={[form.status, 'DRAFT', 'SENT', 'EXPIRED']
                  .filter((value, index, values) => values.indexOf(value) === index)
                  .map(value => ({ value, label: t(`case_detail.plan_status_${value.toLowerCase()}`, { defaultValue: value }) }))}
              />
              <Input
                label={t('case_detail.plan_duration_label')}
                type="number"
                value={form.estimatedDurationDays}
                onChange={(e) => update('estimatedDurationDays', e.target.value)}
              />
              <div className="grid grid-cols-2 gap-3">
                <Input label={t('case_detail.plan_cost_label')} type="number" value={form.totalCost} onChange={(e) => update('totalCost', e.target.value)} />
                <Select label={t('case_detail.plan_currency_label')} value={form.currency} onChange={(e) => update('currency', e.target.value)} options={['USD', 'EUR', 'GBP', 'KZT'].map(value => ({ value, label: value }))} />
              </div>
            </div>
            <Textarea label={t('case_detail.plan_diagnosis_summary')} value={form.diagnosisSummary} onChange={(e) => update('diagnosisSummary', e.target.value)} rows={3} />
            <Textarea label={t('case_detail.plan_doctor_notes')} value={form.doctorDecisionNotes} onChange={(e) => update('doctorDecisionNotes', e.target.value)} rows={3} />
            <Textarea label={t('case_detail.plan_procedures')} value={form.proceduresText} onChange={(e) => update('proceduresText', e.target.value)} rows={4} />
            <Textarea label={t('case_detail.plan_recommendations')} value={form.recommendations} onChange={(e) => update('recommendations', e.target.value)} rows={3} />
            <div className="flex justify-end">
              <Button
                onClick={save}
                disabled={isSaving}
                variant={saveState === 'saved' ? 'success' : 'primary'}
                leftIcon={isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : saveState === 'saved' ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              >
                {saveState === 'saved' ? t('common.saved') : t('common.save')}
              </Button>
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <DetailRow label={t('case_detail.label_plan_status')} value={t(`case_detail.plan_status_${currentPlan.status?.toLowerCase()}`, { defaultValue: currentPlan.status })} />
            <DetailRow label={t('case_detail.label_plan_cost')} value={currentPlan.totalCost ? `${currentPlan.totalCost} ${currentPlan.currency || ''}` : '—'} />
            <DetailRow label={t('case_detail.label_plan_duration')} value={currentPlan.estimatedDurationDays ? t('case_detail.label_plan_days', { days: currentPlan.estimatedDurationDays }) : '—'} />
            <div>
              <p className="text-sm font-medium text-slate-900 mb-1">{t('case_detail.plan_diagnosis_summary')}</p>
              <p className="text-sm text-slate-600 whitespace-pre-wrap">{currentPlan.diagnosisSummary || '—'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900 mb-1">{t('case_detail.section_procedures')}</p>
              {Array.isArray(currentPlan.procedures) && currentPlan.procedures.length > 0 ? (
                <ul className="list-disc pl-5 text-sm text-slate-600 space-y-1">
                  {currentPlan.procedures.map((item, index) => <li key={index}>{item?.name || item?.procedure || String(item)}</li>)}
                </ul>
              ) : <p className="text-sm text-slate-500">—</p>}
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900 mb-1">{t('case_detail.plan_recommendations')}</p>
              <p className="text-sm text-slate-600 whitespace-pre-wrap">{currentPlan.recommendations || '—'}</p>
            </div>
            {canApprove && currentPlan.status === 'SENT' && (
              <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2">
                <Button variant="outline" onClick={() => patientDecision('DECLINED')} disabled={isSaving}>
                  {t('case_detail.plan_decline_btn')}
                </Button>
                <Button onClick={() => patientDecision('ACCEPTED')} disabled={isSaving}>
                  {t('case_detail.plan_accept_btn')}
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function DoctorFeedbackSummary({ medicalCase, plans }) {
  const { t } = useTranslation()
  const doctorDocs = (medicalCase.medical_documents || []).filter(doc => {
    const hasDoctor = !!doc.doctor
    const hasAppointment = !!doc.appointment
    const hasClinicalType = ['certificate', 'prescription', 'other'].includes(doc.type)
    return (hasDoctor || hasAppointment) && hasClinicalType && (doc.description || doc.file)
  })
  const planNotes = (plans || []).filter(plan => plan.doctorDecisionNotes || plan.diagnosisSummary || plan.recommendations)
  const hasCaseNotes = !!medicalCase.doctorDecisionNotes?.trim()

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('case_detail.doctor_feedback_section')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasCaseNotes && doctorDocs.length === 0 && planNotes.length === 0 ? (
          <p className="text-sm text-slate-500">{t('case_detail.doctor_feedback_empty')}</p>
        ) : (
          <>
            {hasCaseNotes && (
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-900 mb-1">{t('case_detail.label_doctor_decision_notes')}</p>
                <p className="text-sm text-slate-600 whitespace-pre-wrap">{medicalCase.doctorDecisionNotes}</p>
              </div>
            )}
            {planNotes.map(plan => (
              <div key={plan.documentId || plan.id} className="rounded-xl bg-slate-50 p-4 space-y-2">
                <p className="text-sm font-medium text-slate-900">{plan.title || t('case_detail.section_treatment_plan')}</p>
                {plan.doctorDecisionNotes && <p className="text-sm text-slate-600 whitespace-pre-wrap">{plan.doctorDecisionNotes}</p>}
                {plan.diagnosisSummary && <p className="text-xs text-slate-500 whitespace-pre-wrap">{plan.diagnosisSummary}</p>}
                {plan.recommendations && <p className="text-xs text-slate-500 whitespace-pre-wrap">{plan.recommendations}</p>}
              </div>
            ))}
            {doctorDocs.map(doc => (
              <div key={doc.documentId || doc.id} className="flex items-start gap-3 rounded-xl border border-slate-100 p-4">
                <FileText className="w-5 h-5 text-teal-600 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">{doc.title || t('documents.type_other')}</p>
                  {doc.description && <p className="text-sm text-slate-600 whitespace-pre-wrap mt-1">{doc.description}</p>}
                  {doc.file && <p className="text-xs text-slate-500 mt-1">{doc.file.name || t('documents.file_label')}</p>}
                </div>
              </div>
            ))}
          </>
        )}
      </CardContent>
    </Card>
  )
}

function jsonArrayToLines(value, key = 'label') {
  if (!Array.isArray(value)) return ''
  return value.map(item => {
    if (typeof item === 'string') return item
    return item?.[key] || item?.title || item?.name || ''
  }).filter(Boolean).join('\n')
}

function linesToChecklist(value) {
  return String(value || '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(label => ({ label, done: false }))
}

function linesToRequiredDocs(value) {
  return String(value || '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
}

function LogisticsWorkspace({ medicalCase, checklists, visas, tourism, canEdit, onChanged }) {
  const { t } = useTranslation()
  const toast = useToast()
  const [isSaving, setIsSaving] = useState(false)
  const [savedAction, setSavedAction] = useState('')
  const currentChecklist = checklists[0] || null
  const currentVisa = visas[0] || null
  const currentTourism = tourism[0] || null

  const [tripForm, setTripForm] = useState({
    status: currentChecklist?.status || 'OPEN',
    itemsText: jsonArrayToLines(currentChecklist?.items),
    managerNotes: currentChecklist?.managerNotes || '',
  })
  const [visaForm, setVisaForm] = useState({
    country: currentVisa?.country || medicalCase.country || '',
    visaType: currentVisa?.visaType || '',
    status: currentVisa?.status || 'NOT_STARTED',
    requiredDocsText: Array.isArray(currentVisa?.requiredDocs) ? currentVisa.requiredDocs.join('\n') : '',
    notes: currentVisa?.notes || '',
  })
  const [tourismForm, setTourismForm] = useState({
    title: currentTourism?.title || '',
    city: currentTourism?.city || 'Astana',
    status: currentTourism?.status || 'DRAFT',
    totalCost: currentTourism?.totalCost || '',
    currency: currentTourism?.currency || 'USD',
    description: currentTourism?.description || '',
    notes: currentTourism?.notes || '',
  })

  useEffect(() => {
    setTripForm({
      status: currentChecklist?.status || 'OPEN',
      itemsText: jsonArrayToLines(currentChecklist?.items),
      managerNotes: currentChecklist?.managerNotes || '',
    })
  }, [currentChecklist?.documentId, currentChecklist?.id])

  useEffect(() => {
    setVisaForm({
      country: currentVisa?.country || medicalCase.country || '',
      visaType: currentVisa?.visaType || '',
      status: currentVisa?.status || 'NOT_STARTED',
      requiredDocsText: Array.isArray(currentVisa?.requiredDocs) ? currentVisa.requiredDocs.join('\n') : '',
      notes: currentVisa?.notes || '',
    })
  }, [currentVisa?.documentId, currentVisa?.id, medicalCase.country])

  useEffect(() => {
    setTourismForm({
      title: currentTourism?.title || '',
      city: currentTourism?.city || 'Astana',
      status: currentTourism?.status || 'DRAFT',
      totalCost: currentTourism?.totalCost || '',
      currency: currentTourism?.currency || 'USD',
      description: currentTourism?.description || '',
      notes: currentTourism?.notes || '',
    })
  }, [currentTourism?.documentId, currentTourism?.id])

  const caseId = medicalCase.documentId || medicalCase.id

  const saveTrip = async () => {
    setIsSaving(true)
    try {
      const payload = {
        medical_case: caseId,
        status: tripForm.status,
        items: linesToChecklist(tripForm.itemsText),
        managerNotes: tripForm.managerNotes,
      }
      if (currentChecklist) {
        await tripChecklistsAPI.update(currentChecklist.documentId || currentChecklist.id, payload)
      } else {
        await tripChecklistsAPI.create(payload)
      }
      toast.success(t('case_detail.toast_logistics_saved'))
      setSavedAction('trip')
      onChanged?.()
    } catch (error) {
      toast.error(error?.response?.data?.error?.message || t('case_detail.toast_logistics_error'))
    } finally {
      setIsSaving(false)
    }
  }

  const saveVisa = async () => {
    setIsSaving(true)
    try {
      const payload = {
        medical_case: caseId,
        country: visaForm.country,
        visaType: visaForm.visaType,
        status: visaForm.status,
        requiredDocs: linesToRequiredDocs(visaForm.requiredDocsText),
        notes: visaForm.notes,
      }
      if (currentVisa) {
        await visaRequestsAPI.update(currentVisa.documentId || currentVisa.id, payload)
      } else {
        await visaRequestsAPI.create(payload)
      }
      toast.success(t('case_detail.toast_logistics_saved'))
      setSavedAction('visa')
      onChanged?.()
    } catch (error) {
      toast.error(error?.response?.data?.error?.message || t('case_detail.toast_logistics_error'))
    } finally {
      setIsSaving(false)
    }
  }

  const saveTourism = async () => {
    setIsSaving(true)
    try {
      const payload = {
        medical_case: caseId,
        title: tourismForm.title,
        city: tourismForm.city,
        status: tourismForm.status,
        totalCost: tourismForm.totalCost ? Number(tourismForm.totalCost) : null,
        currency: tourismForm.currency,
        description: tourismForm.description,
        notes: tourismForm.notes,
      }
      if (currentTourism) {
        await tourismPackagesAPI.update(currentTourism.documentId || currentTourism.id, payload)
      } else {
        await tourismPackagesAPI.create(payload)
      }
      toast.success(t('case_detail.toast_logistics_saved'))
      setSavedAction('tourism')
      onChanged?.()
    } catch (error) {
      toast.error(error?.response?.data?.error?.message || t('case_detail.toast_logistics_error'))
    } finally {
      setIsSaving(false)
    }
  }

  if (!canEdit) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('case_detail.section_travel')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <TimelineItem icon={FileText} title={t('case_detail.trip_checklist')} value={currentChecklist?.status ? t(`case_detail.logistics_${currentChecklist.status.toLowerCase()}`, { defaultValue: currentChecklist.status }) : undefined} muted={!currentChecklist} />
          <TimelineItem icon={Plane} title={t('case_detail.visa_request')} value={currentVisa?.status ? t(`case_detail.logistics_${currentVisa.status.toLowerCase()}`, { defaultValue: currentVisa.status }) : undefined} muted={!currentVisa} />
          <TimelineItem icon={Calendar} title={t('case_detail.tourism_package')} value={currentTourism?.status ? t(`case_detail.logistics_${currentTourism.status.toLowerCase()}`, { defaultValue: currentTourism.status }) : undefined} muted={!currentTourism} />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('case_detail.section_travel')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <div className="flex items-center gap-2 font-semibold text-slate-900">
            <FileText className="w-4 h-4 text-teal-600" />
            {t('case_detail.trip_checklist')}
          </div>
          <Select
            label={t('case_detail.logistics_status_label')}
            value={tripForm.status}
            onChange={(e) => { setSavedAction(''); setTripForm(prev => ({ ...prev, status: e.target.value })) }}
            options={['OPEN', 'IN_PROGRESS', 'COMPLETED'].map(value => ({ value, label: t(`case_detail.logistics_${value.toLowerCase()}`, { defaultValue: value }) }))}
          />
          <Textarea
            label={t('case_detail.trip_items_label')}
            value={tripForm.itemsText}
            onChange={(e) => { setSavedAction(''); setTripForm(prev => ({ ...prev, itemsText: e.target.value })) }}
            rows={4}
            placeholder={t('case_detail.trip_items_placeholder')}
          />
          <Textarea
            label={t('case_detail.logistics_notes_label')}
            value={tripForm.managerNotes}
            onChange={(e) => { setSavedAction(''); setTripForm(prev => ({ ...prev, managerNotes: e.target.value })) }}
            rows={2}
          />
          <Button
            size="sm"
            onClick={saveTrip}
            disabled={isSaving}
            variant={savedAction === 'trip' ? 'success' : 'primary'}
            leftIcon={isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : savedAction === 'trip' ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          >
            {savedAction === 'trip' ? t('common.saved') : t('case_detail.save_trip_btn')}
          </Button>
        </div>

        <div className="border-t border-slate-100 pt-5 space-y-3">
          <div className="flex items-center gap-2 font-semibold text-slate-900">
            <Plane className="w-4 h-4 text-teal-600" />
            {t('case_detail.visa_request')}
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Input label={t('case_detail.visa_country_label')} value={visaForm.country} onChange={(e) => { setSavedAction(''); setVisaForm(prev => ({ ...prev, country: e.target.value })) }} />
            <Input label={t('case_detail.visa_type_label')} value={visaForm.visaType} onChange={(e) => { setSavedAction(''); setVisaForm(prev => ({ ...prev, visaType: e.target.value })) }} />
          </div>
          <Select
            label={t('case_detail.logistics_status_label')}
            value={visaForm.status}
            onChange={(e) => { setSavedAction(''); setVisaForm(prev => ({ ...prev, status: e.target.value })) }}
            options={['NOT_STARTED', 'DOCS_REQUESTED', 'DOCS_RECEIVED', 'INVITATION_PREPARING', 'INVITATION_SENT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'NOT_REQUIRED'].map(value => ({ value, label: t(`case_detail.visa_status_${value.toLowerCase()}`, { defaultValue: value }) }))}
          />
          <Textarea
            label={t('case_detail.visa_required_docs_label')}
            value={visaForm.requiredDocsText}
            onChange={(e) => { setSavedAction(''); setVisaForm(prev => ({ ...prev, requiredDocsText: e.target.value })) }}
            rows={3}
            placeholder={t('case_detail.visa_required_docs_placeholder')}
          />
          <Textarea label={t('case_detail.logistics_notes_label')} value={visaForm.notes} onChange={(e) => { setSavedAction(''); setVisaForm(prev => ({ ...prev, notes: e.target.value })) }} rows={2} />
          <Button
            size="sm"
            onClick={saveVisa}
            disabled={isSaving}
            variant={savedAction === 'visa' ? 'success' : 'primary'}
            leftIcon={isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : savedAction === 'visa' ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          >
            {savedAction === 'visa' ? t('common.saved') : t('case_detail.save_visa_btn')}
          </Button>
        </div>

        <div className="border-t border-slate-100 pt-5 space-y-3">
          <div className="flex items-center gap-2 font-semibold text-slate-900">
            <Calendar className="w-4 h-4 text-teal-600" />
            {t('case_detail.tourism_package')}
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Input label={t('case_detail.tourism_title_label')} value={tourismForm.title} onChange={(e) => { setSavedAction(''); setTourismForm(prev => ({ ...prev, title: e.target.value })) }} />
            <Input label={t('case_detail.tourism_city_label')} value={tourismForm.city} onChange={(e) => { setSavedAction(''); setTourismForm(prev => ({ ...prev, city: e.target.value })) }} />
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <Select
              label={t('case_detail.logistics_status_label')}
              value={tourismForm.status}
              onChange={(e) => { setSavedAction(''); setTourismForm(prev => ({ ...prev, status: e.target.value })) }}
              options={['DRAFT', 'OFFERED', 'ACCEPTED', 'DECLINED', 'BOOKED', 'COMPLETED', 'CANCELLED'].map(value => ({ value, label: t(`case_detail.tourism_status_${value.toLowerCase()}`, { defaultValue: value }) }))}
            />
            <Input label={t('case_detail.plan_cost_label')} type="number" value={tourismForm.totalCost} onChange={(e) => { setSavedAction(''); setTourismForm(prev => ({ ...prev, totalCost: e.target.value })) }} />
            <Select label={t('case_detail.plan_currency_label')} value={tourismForm.currency} onChange={(e) => { setSavedAction(''); setTourismForm(prev => ({ ...prev, currency: e.target.value })) }} options={['USD', 'EUR', 'GBP', 'KZT'].map(value => ({ value, label: value }))} />
          </div>
          <Textarea label={t('case_detail.tourism_desc_label')} value={tourismForm.description} onChange={(e) => { setSavedAction(''); setTourismForm(prev => ({ ...prev, description: e.target.value })) }} rows={3} />
          <Textarea label={t('case_detail.logistics_notes_label')} value={tourismForm.notes} onChange={(e) => { setSavedAction(''); setTourismForm(prev => ({ ...prev, notes: e.target.value })) }} rows={2} />
          <Button
            size="sm"
            onClick={saveTourism}
            disabled={isSaving}
            variant={savedAction === 'tourism' ? 'success' : 'primary'}
            leftIcon={isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : savedAction === 'tourism' ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          >
            {savedAction === 'tourism' ? t('common.saved') : t('case_detail.save_tourism_btn')}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function MedicalCaseDetail() {
  const { t } = useTranslation()
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { user } = useAuthStore()
  const role = user?.userRole || 'patient'
  const base = roleBase(role)
  const canManage = ['admin', 'manager', 'coordinator'].includes(role)
  const isDoctorRole = role === 'doctor'
  const canViewPatientContact = ['admin', 'manager', 'coordinator', 'patient'].includes(role)
  const canViewBusinessFields = ['admin', 'manager'].includes(role)
  const canViewTravel = ['admin', 'manager', 'patient'].includes(role)

  const [medicalCase, setMedicalCase] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [clinics, setClinics] = useState([])
  const [doctors, setDoctors] = useState([])
  const [managers, setManagers] = useState([])
  const [_coordinators, setCoordinators] = useState([])
  const [plans, setPlans] = useState([])
  const [checklists, setChecklists] = useState([])
  const [visas, setVisas] = useState([])
  const [tourism, setTourism] = useState([])
  const [events, setEvents] = useState([])
  const [ledger, setLedger] = useState([])
  const [form, setForm] = useState({})
  const [showSlotPicker, setShowSlotPicker] = useState(false)
  const [caseSaveState, setCaseSaveState] = useState('idle')

  const loadCase = async () => {
    setIsLoading(true)
    try {
      const response = await medicalCasesAPI.getOne(id)
      const { data } = normalizeResponse(response)
      setMedicalCase(data)
      setForm({
        status: normalizeCaseStatus(data?.status) || 'NEW_LEAD',
        manager: getRef(data?.manager),
        coordinator: getRef(data?.coordinator),
        clinic: getRef(data?.clinic),
        doctor: getRef(data?.doctor),
        internalNotes: data?.internalNotes || '',
        doctorDecisionNotes: data?.doctorDecisionNotes || '',
        tourismNotes: data?.tourismNotes || '',
      })
    } catch (error) {
      toast.error(error?.response?.data?.error?.message || t('case_detail.toast_load_error'))
    } finally {
      setIsLoading(false)
    }
  }

  const loadReferenceData = async () => {
    try {
      if (isDoctorRole) {
        const [plansRes, eventsRes] = await Promise.all([
          treatmentPlansAPI.getByCase(id),
          caseEventsAPI.getByCase(id),
        ])
        setPlans(normalizeResponse(plansRes).data || [])
        setEvents(normalizeResponse(eventsRes).data || [])
        setClinics([])
        setDoctors([])
        setChecklists([])
        setVisas([])
        setTourism([])
        setLedger([])
        return
      }

      const requests = [
        clinicsAPI.getAll(),
        doctorsAPI.getAll({ includeInactive: true }),
        treatmentPlansAPI.getByCase(id),
        canViewTravel ? tripChecklistsAPI.getByCase(id) : Promise.resolve({ data: { data: [] } }),
        canViewTravel ? visaRequestsAPI.getByCase(id) : Promise.resolve({ data: { data: [] } }),
        canViewTravel ? tourismPackagesAPI.getByCase(id) : Promise.resolve({ data: { data: [] } }),
        caseEventsAPI.getByCase(id),
        canManage ? financeLedgerAPI.getAll({ caseId: id }) : Promise.resolve({ data: { data: [] } }),
      ]

      if (role === 'admin') {
        requests.push(usersAPI.getAll({ role: 'manager' }))
        requests.push(usersAPI.getAll({ role: 'coordinator' }))
      }

      const responses = await Promise.all(requests)
      setClinics(normalizeResponse(responses[0]).data || [])
      setDoctors(normalizeResponse(responses[1]).data || [])
      setPlans(normalizeResponse(responses[2]).data || [])
      setChecklists(normalizeResponse(responses[3]).data || [])
      setVisas(normalizeResponse(responses[4]).data || [])
      setTourism(normalizeResponse(responses[5]).data || [])
      setEvents(normalizeResponse(responses[6]).data || [])
      setLedger(normalizeResponse(responses[7]).data || [])
      if (role === 'admin') {
        setManagers(normalizeResponse(responses[8]).data || [])
        setCoordinators(normalizeResponse(responses[9]).data || [])
      }
    } catch (error) {
      console.warn('Reference data load failed', error)
    }
  }

  useEffect(() => {
    loadCase()
    loadReferenceData()
  }, [id])

  const update = (key, value) => {
    setCaseSaveState('idle')
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const save = async () => {
    setIsSaving(true)
    try {
      const payload = {
        status: form.status,
        clinic: form.clinic || null,
        doctor: form.doctor || null,
        internalNotes: form.internalNotes,
        tourismNotes: form.tourismNotes,
      }

      if (role === 'admin') {
        payload.manager = form.manager || null
        payload.coordinator = form.coordinator || null
      }

      // Auto-advance to DOCTOR_ASSIGNED when a doctor is first assigned
      const prevDoctorRef = getRef(medicalCase?.doctor)
      const PRE_ASSIGNMENT_STATUSES = ['WAITING_FOR_DOCUMENTS', 'DOCUMENTS_UPLOADED', 'UNDER_REVIEW']
      if (form.doctor && !prevDoctorRef && PRE_ASSIGNMENT_STATUSES.includes(normalizeCaseStatus(form.status))) {
        payload.status = 'DOCTOR_ASSIGNED'
      }

      await medicalCasesAPI.update(id, payload)
      toast.success(t('case_detail.toast_case_updated'))
      setCaseSaveState('saved')
      await loadCase()
    } catch (error) {
      toast.error(error?.response?.data?.error?.message || t('case_detail.toast_case_error'))
    } finally {
      setIsSaving(false)
    }
  }

  const claimCase = async () => {
    setIsSaving(true)
    try {
      const normalizedStatus = normalizeCaseStatus(medicalCase.status)
      const nextStatus = normalizedStatus === 'NEW_LEAD' ? 'REGISTERED' : medicalCase.status
      const payload = role === 'manager'
        ? { manager: user?.documentId || user?.id, status: nextStatus }
        : { coordinator: user?.documentId || user?.id, status: nextStatus }
      await medicalCasesAPI.update(id, payload)
      toast.success(role === 'manager' ? t('case_detail.toast_claimed_manager') : t('case_detail.toast_claimed_coordinator'))
      await loadCase()
      await loadReferenceData()
    } catch (error) {
      toast.error(error?.response?.data?.error?.message || t('case_detail.toast_claim_error'))
    } finally {
      setIsSaving(false)
    }
  }

  const submitDoctorDecision = async (decision) => {
    if (!form.doctorDecisionNotes?.trim()) {
      toast.warning(t('case_detail.toast_notes_required'))
      return
    }

    const nextStatus = decision === 'treatment_in_kazakhstan'
      ? 'TREATMENT_IN_KAZAKHSTAN'
      : decision === 'local_treatment'
        ? 'LOCAL_TREATMENT'
        : 'WAITING_FOR_DOCUMENTS'

    const message = decision === 'treatment_in_kazakhstan'
      ? t('case_detail.event_message.DOCTOR_DECISION.treatment_in_kazakhstan')
      : decision === 'local_treatment'
        ? t('case_detail.event_message.DOCTOR_DECISION.local_treatment')
        : t('case_detail.event_message.DOCTOR_DECISION.needs_more_documents')

    setIsSaving(true)
    try {
      await medicalCasesAPI.update(id, {
        status: nextStatus,
        doctorDecisionNotes: form.doctorDecisionNotes,
      })
      await caseEventsAPI.create({
        medical_case: medicalCase.documentId || medicalCase.id,
        actor: user?.documentId || user?.id,
        eventType: 'DOCTOR_DECISION',
        fromStatus: medicalCase.status,
        toStatus: nextStatus,
        message,
        metadata: { decision },
      })
      toast.success(t('case_detail.toast_doctor_saved'))
      await loadCase()
      await loadReferenceData()
    } catch (error) {
      toast.error(error?.response?.data?.error?.message || t('case_detail.toast_doctor_error'))
    } finally {
      setIsSaving(false)
    }
  }

  const openSlotPicker = async () => {
    if (canManage && form.doctor && form.doctor !== getRef(medicalCase?.doctor)) {
      setIsSaving(true)
      try {
        await medicalCasesAPI.update(id, {
          doctor: form.doctor,
          clinic: form.clinic || null,
        })
        toast.success(t('case_detail.toast_case_updated'))
        await loadCase()
      } catch (error) {
        toast.error(error?.response?.data?.error?.message || t('case_detail.toast_case_error'))
        setIsSaving(false)
        return
      } finally {
        setIsSaving(false)
      }
    }
    setShowSlotPicker(true)
  }

  const selectedClinicDoctors = useMemo(() => {
    if (!['admin', 'manager'].includes(role)) return doctors
    if (!form.clinic) return doctors
    const linked = doctors.filter(doctor => getRef(doctor.clinic) === form.clinic)
    return linked.length > 0 ? linked : doctors
  }, [doctors, form.clinic, role])

  const canDoctorDecide = ['doctor', 'admin', 'coordinator'].includes(role)
  const canEditTreatmentPlan = ['doctor', 'admin', 'coordinator'].includes(role)
  const canApproveTreatmentPlan = role === 'patient'
  const canManageClinic = ['admin', 'manager'].includes(role)
  const allowedStatusOptions = useMemo(() => {
    const current = normalizeCaseStatus(medicalCase?.status) || 'NEW_LEAD'
    return [current, ...getAllowedCaseTransitions(role, current)]
      .filter((value, index, values) => values.indexOf(value) === index)
  }, [medicalCase?.status, role])
  const caseSla = getCaseSla(medicalCase)

  const assignedDoctor = useMemo(() => {
    const docRef = getRef(medicalCase?.doctor)
    if (!docRef) return null
    return doctors.find(d => getRef(d) === docRef) || medicalCase?.doctor || null
  }, [doctors, medicalCase?.doctor])
  const bookingDoctor = useMemo(() => {
    if (canManage && form.doctor) {
      return doctors.find(d => getRef(d) === form.doctor) || assignedDoctor
    }
    return assignedDoctor
  }, [assignedDoctor, canManage, doctors, form.doctor])

  const caseStatus = normalizeCaseStatus(medicalCase?.status)
  const BOOKING_STATUSES = ['DOCTOR_ASSIGNED', 'WAITING_PATIENT_CONFIRMATION', 'UNDER_REVIEW', 'DOCUMENTS_UPLOADED', 'CONSULTATION_COMPLETED']
  const isFollowUpBooking = caseStatus === 'CONSULTATION_COMPLETED'
  const canBookSlot = bookingDoctor && BOOKING_STATUSES.includes(caseStatus)
  const canBookAsStaff = canManage && canBookSlot
  const canBookAsPatient = role === 'patient' && !!assignedDoctor && BOOKING_STATUSES.includes(caseStatus)

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-9 h-9 animate-spin text-teal-600" />
      </div>
    )
  }

  if (!medicalCase) {
    return (
      <Card>
        <CardContent className="p-10 text-center">
          <p className="font-medium text-slate-900">{t('case_detail.not_found')}</p>
          <Button className="mt-4" onClick={() => navigate(`${base}/cases`)}>{t('case_detail.back_to_cases')}</Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div>
          <Link to={`${base}/cases`} className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 mb-3">
            <ArrowLeft className="w-4 h-4" />
            {t('case_detail.back_to_cases')}
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{medicalCase.caseNumber || `Case #${medicalCase.id}`}</h1>
            <Badge variant={STATUS_VARIANTS[normalizeCaseStatus(medicalCase.status)] || 'default'}>{formatStatus(medicalCase.status, t)}</Badge>
            {caseSla.hours && (
              <Badge variant={caseSla.overdue ? 'danger' : 'secondary'}>
                {caseSla.overdue ? t('case_detail.sla_overdue_badge') : t('case_detail.sla_left_badge', { hours: caseSla.remainingHours })}
              </Badge>
            )}
          </div>
          <p className="text-slate-600 mt-1">{medicalCase.title || medicalCase.treatmentCategory || t('cases.fallback_title')}</p>
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-3">
            {role === 'manager' && !medicalCase.manager && (
              <Button variant="outline" onClick={claimCase} disabled={isSaving}>
                {t('case_detail.claim_manager')}
              </Button>
            )}
            {canBookAsStaff && (
              <Button variant="outline" onClick={openSlotPicker} disabled={isSaving} leftIcon={<Calendar className="w-4 h-4" />}>
                {isFollowUpBooking ? t('case_detail.book_follow_up_btn') : t('case_detail.book_consultation_btn')}
              </Button>
            )}
            <Button
              onClick={save}
              disabled={isSaving}
              variant={caseSaveState === 'saved' ? 'success' : 'primary'}
              leftIcon={isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : caseSaveState === 'saved' ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            >
              {caseSaveState === 'saved' ? t('common.saved') : t('case_detail.save_changes')}
            </Button>
          </div>
        )}
      </div>

      {role === 'patient' && (
        <PatientNextStep status={medicalCase.status} />
      )}

      {canBookAsPatient && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-teal-50 border border-teal-200 rounded-xl">
          <p className="text-sm text-teal-800">
            {isFollowUpBooking ? t('case_detail.patient_follow_up_prompt') : t('case_detail.patient_book_prompt')}
          </p>
          <Button onClick={openSlotPicker} leftIcon={<Calendar className="w-4 h-4" />} className="shrink-0 w-full sm:w-auto">
            {isFollowUpBooking ? t('case_detail.book_follow_up_btn') : t('case_detail.book_consultation_btn')}
          </Button>
        </div>
      )}

      <div className="grid xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('case_detail.section_patient_request')}</CardTitle>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-slate-900 mb-3">{t('cases.patient_fallback')}</h3>
                <DetailRow label={t('case_detail.label_name')} value={medicalCase.patient?.fullName} />
                {canViewPatientContact && (
                  <>
                    <DetailRow label={t('case_detail.label_email')} value={medicalCase.patient?.email} />
                    <DetailRow label={t('case_detail.label_phone')} value={medicalCase.patient?.phone} />
                    <DetailRow label={t('case_detail.label_country')} value={medicalCase.country || medicalCase.patient?.country} />
                    <DetailRow label={t('case_detail.label_language')} value={medicalCase.language || medicalCase.patient?.language} />
                    <DetailRow label={t('case_detail.label_timezone')} value={medicalCase.timezone || medicalCase.patient?.timezone} />
                    <DetailRow label={t('case_detail.label_contact')} value={medicalCase.preferredContact} />
                  </>
                )}
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 mb-3">{t('cases.treatment_dir_label')}</h3>
                <DetailRow label={t('case_detail.label_direction')} value={medicalCase.treatmentCategory} />
                <DetailRow label={t('case_detail.label_urgency')} value={medicalCase.urgency ? t(`urgency.${medicalCase.urgency}`) : '—'} />
                {!isDoctorRole && <DetailRow label={t('case_detail.label_arrival')} value={formatDesiredDate(medicalCase.desiredDates)} />}
                {canViewBusinessFields && (
                  <>
                    <DetailRow label={t('case_detail.label_budget')} value={medicalCase.budgetRange} />
                    <DetailRow label={t('case_detail.label_lead_source')} value={medicalCase.leadSource} />
                    <DetailRow label={t('case_detail.label_lead_campaign')} value={medicalCase.leadCampaign} />
                    <DetailRow label={t('case_detail.label_visa')} value={medicalCase.visaSupportNeeded ? t('case_detail.label_visa_needed') : t('case_detail.label_visa_not')} />
                  </>
                )}
                <DetailRow label={t('case_detail.label_diagnosis')} value={medicalCase.diagnosis} />
                <DetailRow label={t('case_detail.label_symptoms')} value={medicalCase.symptoms} />
                <DetailRow label={t('case_detail.label_current_treatment')} value={medicalCase.currentTreatment} />
                {canViewBusinessFields && <DetailRow label={t('case_detail.label_tourism')} value={medicalCase.tourismRequested ? t('case_detail.label_tourism_requested') : t('case_detail.label_tourism_not')} />}
              </div>
            </CardContent>
          </Card>

          {canManage && (
            <Card>
              <CardHeader>
                <CardTitle>{t('case_detail.section_case_mgmt')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid md:grid-cols-2 gap-4">
                  <Select
                    label={t('cases.col_status')}
                    value={form.status}
                    onChange={(e) => update('status', e.target.value)}
                    options={allowedStatusOptions.map(value => ({ value, label: formatStatus(value, t) }))}
                  />
                  {canManageClinic && (
                    <Select
                      label={t('common.clinic')}
                      value={form.clinic}
                      onChange={(e) => {
                        update('clinic', e.target.value)
                        update('doctor', '')
                      }}
                      placeholder={t('case_detail.not_assigned_placeholder')}
                      options={clinics.map(clinic => ({ value: getRef(clinic), label: clinic.name }))}
                    />
                  )}
                  <Select
                    label={t('admin_apt.col_doctor')}
                    value={form.doctor}
                    onChange={(e) => update('doctor', e.target.value)}
                    placeholder={t('case_detail.not_assigned_placeholder')}
                    options={selectedClinicDoctors.map(doctor => ({ value: getRef(doctor), label: doctor.fullName }))}
                  />
                  {role === 'admin' && (
                    <Select
                      label={t('cases.col_manager')}
                      value={form.manager}
                      onChange={(e) => update('manager', e.target.value)}
                      placeholder={t('case_detail.not_assigned_placeholder')}
                      options={managers.map(manager => ({ value: getRef(manager), label: manager.fullName || manager.email }))}
                    />
                  )}
                </div>
                <Textarea
                  label={t('case_detail.label_internal_notes')}
                  value={form.internalNotes}
                  onChange={(e) => update('internalNotes', e.target.value)}
                  rows={4}
                />
                <Textarea
                  label={t('case_detail.label_tourism_notes')}
                  value={form.tourismNotes}
                  onChange={(e) => update('tourismNotes', e.target.value)}
                  rows={3}
                />
              </CardContent>
            </Card>
          )}

          {canDoctorDecide && (
            <Card>
              <CardHeader>
                <CardTitle>{t('case_detail.section_doctor_decision')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-slate-600">
                  {t('case_detail.doctor_decision_help')}
                </p>
                <Textarea
                  label={t('case_detail.label_doctor_decision_notes')}
                  value={form.doctorDecisionNotes}
                  onChange={(e) => update('doctorDecisionNotes', e.target.value)}
                  rows={3}
                />
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    onClick={() => submitDoctorDecision('treatment_in_kazakhstan')}
                    disabled={isSaving}
                    leftIcon={<CheckCircle className="w-4 h-4" />}
                  >
                    {t('case_detail.decision_treatment_kz')}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => submitDoctorDecision('local_treatment')}
                    disabled={isSaving}
                  >
                    {t('case_detail.decision_local_treatment')}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => submitDoctorDecision('needs_more_documents')}
                    disabled={isSaving}
                    leftIcon={<FileText className="w-4 h-4" />}
                  >
                    {t('case_detail.need_more_docs')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <CaseDocumentsPanel medicalCase={medicalCase} onUploaded={loadCase} />

          {canManage && (
            <DoctorFeedbackSummary medicalCase={medicalCase} plans={plans} />
          )}

          <TreatmentPlanPanel
            medicalCase={medicalCase}
            plans={plans}
            canEdit={canEditTreatmentPlan}
            canApprove={canApproveTreatmentPlan}
            onChanged={async () => {
              await loadCase()
              await loadReferenceData()
            }}
          />

          <Card>
            <CardHeader>
              <CardTitle>{t('case_detail.docs_and_plans')}</CardTitle>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-50">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 text-teal-600" />
                  <p className="font-medium text-slate-900">{t('case_detail.medical_docs_count')}</p>
                </div>
                <p className="text-2xl font-bold text-slate-900">{medicalCase.medical_documents?.length || 0}</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-50">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <p className="font-medium text-slate-900">{t('case_detail.treatment_plans_count')}</p>
                </div>
                <p className="text-2xl font-bold text-slate-900">{plans.length}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {!isDoctorRole && (
            <Card>
            <CardHeader>
              <CardTitle>{t('case_detail.section_assignments')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <TimelineItem icon={UserRound} title={t('case_detail.manager_label')} value={medicalCase.manager?.fullName} muted={!medicalCase.manager} />
              {canManageClinic && (
                <TimelineItem icon={Building2} title={t('case_detail.clinic_label')} value={medicalCase.clinic?.name} muted={!medicalCase.clinic} />
              )}
              <TimelineItem icon={Stethoscope} title={t('case_detail.doctor_label')} value={medicalCase.doctor?.fullName} muted={!medicalCase.doctor} />
            </CardContent>
            </Card>
          )}

          {canViewTravel && (
            <LogisticsWorkspace
              medicalCase={medicalCase}
              checklists={checklists}
              visas={visas}
              tourism={tourism}
              canEdit={['admin', 'manager'].includes(role)}
              onChanged={async () => {
                await loadCase()
                await loadReferenceData()
              }}
            />
          )}

          {canManage && (
            <Card>
              <CardHeader>
                <CardTitle>{t('case_detail.section_finance')}</CardTitle>
              </CardHeader>
              <CardContent>
                {ledger.length === 0 ? (
                  <p className="text-sm text-slate-500">{t('case_detail.no_finance_entries')}</p>
                ) : (
                  <div className="space-y-3">
                    {ledger.slice(0, 6).map(entry => (
                      <div key={entry.documentId || entry.id} className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                          <CreditCard className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900">{entry.entryType?.replaceAll('_', ' ')}</p>
                          <p className="text-xs text-slate-500">
                            {entry.amount} {entry.currency || 'KZT'} · {entry.reconciliationStatus || 'PENDING'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>{t('case_detail.section_activity')}</CardTitle>
            </CardHeader>
            <CardContent>
              {events.length === 0 ? (
                <p className="text-sm text-slate-500">{t('case_detail.no_activity')}</p>
              ) : (
                <div className="space-y-3">
                  {events.slice(-6).map(event => (
                    <div key={event.id || event.documentId} className="border-l-2 border-teal-200 pl-3">
                      <p className="text-sm font-medium text-slate-900">{formatEventTitle(event, t)}</p>
                      <p className="text-xs text-slate-500">{formatEventMessage(event, t)}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <CaseSlotPicker
        isOpen={showSlotPicker}
        onClose={() => setShowSlotPicker(false)}
        doctor={bookingDoctor}
        caseDocId={medicalCase?.documentId || medicalCase?.id}
        patientId={medicalCase?.patient?.id}
        role={role}
        consultationPurpose={isFollowUpBooking ? 'follow_up' : 'initial_case_review'}
        onBooked={() => { loadCase(); loadReferenceData() }}
      />
    </div>
  )
}

export default MedicalCaseDetail
