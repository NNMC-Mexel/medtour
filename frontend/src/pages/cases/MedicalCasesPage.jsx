import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'
import CaseCreatedGuide from '../../components/cases/CaseCreatedGuide'
import {
  Activity,
  AlertCircle,
  Bell,
  CheckCircle,
  Clock,
  FileText,
  Loader2,
  Plus,
  Search,
  UserRound,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import Input from '../../components/ui/Input'
import Textarea from '../../components/ui/Textarea'
import Select from '../../components/ui/Select'
import { useToast } from '../../components/ui/Toast'
import useAuthStore from '../../stores/authStore'
import { medicalCasesAPI, normalizeResponse } from '../../services/api'
import { getCaseSla, formatCaseStatus, MEDICAL_CASE_STATUSES, normalizeCaseStatus, STATUS_VARIANTS } from '../../utils/medicalCaseWorkflow'

function roleBase(role) {
  if (role === 'admin') return '/admin'
  if (role === 'manager') return '/manager'
  if (role === 'coordinator') return '/coordinator'
  if (role === 'doctor') return '/doctor'
  return '/patient'
}

function formatStatus(status, t) {
  return formatCaseStatus(status, t)
}

function StatusBadge({ status }) {
  const { t } = useTranslation()
  const normalizedStatus = normalizeCaseStatus(status)
  return (
    <Badge variant={STATUS_VARIANTS[normalizedStatus] || 'default'}>
      {formatStatus(status, t)}
    </Badge>
  )
}

function StatCard({ icon: Icon, label, value, className }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${className}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="text-2xl font-bold text-slate-900">{value}</p>
          <p className="text-sm text-slate-500">{label}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function CreateCaseModal({ onClose, onCreated }) {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const toast = useToast()
  const [isSaving, setIsSaving] = useState(false)
  const [form, setForm] = useState({
    title: '',
    country: user?.country || '',
    diagnosis: '',
    symptoms: '',
    treatmentCategory: '',
    urgency: 'routine',
    preferredArrivalDate: '',
    budgetRange: '',
    preferredContact: user?.phone || '',
    visaSupportNeeded: 'unknown',
    currentTreatment: '',
    tourismRequested: 'false',
    leadSource: '',
    leadCampaign: '',
  })

  const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }))

  const submit = async (event) => {
    event.preventDefault()
    setIsSaving(true)
    try {
      const response = await medicalCasesAPI.create({
        title: form.title || `Medical case for ${user?.fullName || user?.email || 'patient'}`,
        country: form.country,
        diagnosis: form.diagnosis,
        symptoms: form.symptoms,
        treatmentCategory: form.treatmentCategory,
        urgency: form.urgency,
        desiredDates: {
          preferredArrivalDate: form.preferredArrivalDate || null,
        },
        budgetRange: form.budgetRange,
        preferredContact: form.preferredContact,
        leadSource: form.leadSource,
        leadCampaign: form.leadCampaign,
        leadReferrer: typeof document !== 'undefined' ? document.referrer : '',
        visaSupportNeeded: form.visaSupportNeeded === 'true',
        currentTreatment: form.currentTreatment,
        tourismRequested: form.tourismRequested === 'true',
        language: user?.language || 'en',
        timezone: user?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      })
      const { data } = normalizeResponse(response)
      toast.success(t('cases.toast_created'))
      onCreated(data)
      onClose()
    } catch (error) {
      toast.error(error?.response?.data?.error?.message || t('cases.toast_create_error'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal isOpen onClose={onClose} title={t('cases.modal_title')} size="lg">
      <form onSubmit={submit} className="space-y-4">
        <Input
          label={t('cases.case_title_label')}
          value={form.title}
          onChange={(e) => update('title', e.target.value)}
          placeholder={t('cases.case_title_placeholder')}
        />
        <div className="grid sm:grid-cols-2 gap-4">
          <Input
            label={t('cases.country_label')}
            value={form.country}
            onChange={(e) => update('country', e.target.value)}
            placeholder={t('cases.country_placeholder')}
          />
          <Input
            label={t('cases.treatment_dir_label')}
            value={form.treatmentCategory}
            onChange={(e) => update('treatmentCategory', e.target.value)}
            placeholder={t('cases.treatment_dir_placeholder')}
          />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <Select
            label={t('cases.urgency_label')}
            value={form.urgency}
            onChange={(e) => update('urgency', e.target.value)}
            options={[
              { value: 'routine', label: t('cases.urgency_routine') },
              { value: 'soon', label: t('cases.urgency_soon') },
              { value: 'urgent', label: t('cases.urgency_urgent') },
            ]}
          />
          <Input
            label={t('cases.arrival_date_label')}
            type="date"
            value={form.preferredArrivalDate}
            onChange={(e) => update('preferredArrivalDate', e.target.value)}
          />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <Input
            label={t('cases.budget_label')}
            value={form.budgetRange}
            onChange={(e) => update('budgetRange', e.target.value)}
            placeholder={t('cases.budget_placeholder')}
          />
          <Input
            label={t('cases.contact_label')}
            value={form.preferredContact}
            onChange={(e) => update('preferredContact', e.target.value)}
            placeholder={t('cases.contact_placeholder')}
          />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <Select
            label={t('cases.lead_source_label')}
            value={form.leadSource}
            onChange={(e) => update('leadSource', e.target.value)}
            placeholder={t('cases.lead_source_placeholder')}
            options={[
              { value: 'google', label: t('cases.lead_source_google') },
              { value: 'instagram', label: t('cases.lead_source_instagram') },
              { value: 'referral', label: t('cases.lead_source_referral') },
              { value: 'clinic', label: t('cases.lead_source_clinic') },
              { value: 'other', label: t('cases.lead_source_other') },
            ]}
          />
          <Input
            label={t('cases.lead_campaign_label')}
            value={form.leadCampaign}
            onChange={(e) => update('leadCampaign', e.target.value)}
            placeholder={t('cases.lead_campaign_placeholder')}
          />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <Select
            label={t('cases.visa_label')}
            value={form.visaSupportNeeded}
            onChange={(e) => update('visaSupportNeeded', e.target.value)}
            options={[
              { value: 'unknown', label: t('cases.visa_unknown') },
              { value: 'true', label: t('cases.visa_yes') },
              { value: 'false', label: t('cases.visa_no') },
            ]}
          />
          <Select
            label={t('cases.tourism_label')}
            value={form.tourismRequested}
            onChange={(e) => update('tourismRequested', e.target.value)}
            options={[
              { value: 'false', label: t('cases.tourism_no') },
              { value: 'true', label: t('cases.tourism_yes') },
            ]}
          />
        </div>
        <Textarea
          label={t('cases.diagnosis_label')}
          value={form.diagnosis}
          onChange={(e) => update('diagnosis', e.target.value)}
          rows={3}
        />
        <Textarea
          label={t('cases.treatment_label')}
          value={form.currentTreatment}
          onChange={(e) => update('currentTreatment', e.target.value)}
          rows={3}
        />
        <Textarea
          label={t('cases.symptoms_label')}
          value={form.symptoms}
          onChange={(e) => update('symptoms', e.target.value)}
          rows={4}
        />
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit" disabled={isSaving} leftIcon={isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}>
            {t('cases.create_btn')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function MedicalCasesPage() {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const role = user?.userRole || 'patient'
  const location = useLocation()
  const toast = useToast()
  const [cases, setCases] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [createdCase, setCreatedCase] = useState(null) // triggers onboarding guide

  const base = roleBase(role)
  const canCreate = role === 'patient'

  const loadCases = async () => {
    setIsLoading(true)
    try {
      const response = await medicalCasesAPI.getAll(status ? { status } : {})
      const { data } = normalizeResponse(response)
      setCases(Array.isArray(data) ? data : [])
    } catch (error) {
      toast.error(error?.response?.data?.error?.message || t('cases.toast_load_error'))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadCases()
  }, [status])

  const filteredCases = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return cases
    return cases.filter(item => [
      item.caseNumber,
      item.title,
      item.patient?.fullName,
      item.country,
      item.treatmentCategory,
      item.clinic?.name,
      item.doctor?.fullName,
    ].filter(Boolean).some(value => String(value).toLowerCase().includes(term)))
  }, [cases, search])

  const BOOKING_NEEDED_STATUSES = ['DOCTOR_ASSIGNED', 'WAITING_PATIENT_CONFIRMATION', 'UNDER_REVIEW', 'DOCUMENTS_UPLOADED']
  const needsPatientBooking = (item) => {
    const s = normalizeCaseStatus(item.status)
    return !!item.doctor && BOOKING_NEEDED_STATUSES.includes(s)
  }

  const stats = useMemo(() => ({
    total: cases.length,
    active: cases.filter(item => !['COMPLETED', 'CANCELLED'].includes(normalizeCaseStatus(item.status))).length,
    planReady: cases.filter(item => needsPatientBooking(item) || normalizeCaseStatus(item.status) === 'WAITING_PATIENT_CONFIRMATION').length,
    confirmed: cases.filter(item => ['TREATMENT_IN_KAZAKHSTAN', 'TRAVEL_PREPARATION', 'ARRIVED_TO_KAZAKHSTAN', 'IN_TREATMENT', 'RECOVERY'].includes(normalizeCaseStatus(item.status))).length,
    overdue: cases.filter(item => getCaseSla(item).overdue).length,
  }), [cases])

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('cases.page_title')}</h1>
          <p className="text-slate-600 mt-1">
            {role === 'patient' ? t('cases.page_subtitle_patient') : t('cases.page_subtitle_staff')}
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setShowCreate(true)} leftIcon={<Plus className="w-4 h-4" />}>
            {t('cases.start_case_btn')}
          </Button>
        )}
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={Activity} label={t('cases.stat_total')} value={stats.total} className="bg-teal-500" />
        <StatCard icon={Clock} label={t('cases.stat_active')} value={stats.active} className="bg-sky-500" />
        <StatCard icon={FileText} label={t('cases.stat_awaiting')} value={stats.planReady} className="bg-amber-500" />
        <StatCard icon={stats.overdue > 0 ? AlertCircle : CheckCircle} label={stats.overdue > 0 ? t('cases.stat_overdue') : t('cases.stat_treatment')} value={stats.overdue > 0 ? stats.overdue : stats.confirmed} className={stats.overdue > 0 ? 'bg-rose-500' : 'bg-emerald-500'} />
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <CardTitle>{t('cases.table_title')}</CardTitle>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('cases.search_placeholder')}
                  className="w-full sm:w-72 pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <Select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                placeholder={t('cases.all_statuses')}
                className="min-w-48"
                options={MEDICAL_CASE_STATUSES.map(value => ({ value, label: formatStatus(value, t) }))}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
            </div>
          ) : filteredCases.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="font-medium text-slate-900">{t('cases.empty_title')}</p>
              <p className="text-sm text-slate-500 mt-1">{t('cases.empty_subtitle')}</p>
            </div>
          ) : (
            <>
              {/* ── Mobile: card list ── */}
              <div className="md:hidden space-y-3">
                {filteredCases.map(item => {
                  const id = item.documentId || item.id
                  const bookingNeeded = role === 'patient' && needsPatientBooking(item)
                  const sla = getCaseSla(item)
                  return (
                    <Link
                      key={id}
                      to={`${base}/cases/${id}`}
                      state={{ from: location.pathname }}
                      className={`block rounded-xl border p-4 hover:shadow-md transition-all ${bookingNeeded ? 'border-amber-200 bg-amber-50/40' : 'border-slate-100 bg-white hover:border-teal-200'}`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 truncate">
                            {item.caseNumber || `Case #${item.id}`}
                          </p>
                          <p className="text-sm text-slate-500 line-clamp-1 mt-0.5">
                            {item.title || item.treatmentCategory || t('cases.fallback_title')}
                          </p>
                        </div>
                        <StatusBadge status={item.status} />
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                        {item.patient?.fullName && (
                          <span className="flex items-center gap-1">
                            <UserRound className="w-3.5 h-3.5" />
                            {item.patient.fullName}
                          </span>
                        )}
                        {(item.clinic?.name || item.doctor?.fullName) && (
                          <span>{item.clinic?.name || item.doctor?.fullName}</span>
                        )}
                        {sla.hours && (
                          <span className={sla.overdue ? 'font-semibold text-rose-600' : ''}>
                            {sla.overdue ? t('cases.sla_overdue') : t('cases.sla_left', { hours: sla.remainingHours })}
                          </span>
                        )}
                      </div>
                      {bookingNeeded && (
                        <div className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                          <Bell className="w-3 h-3" />
                          {t('cases.action_book_slot')}
                        </div>
                      )}
                    </Link>
                  )
                })}
              </div>

              {/* ── Desktop: table ── */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full min-w-230">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <th className="py-3 px-4">{t('cases.col_case')}</th>
                      <th className="py-3 px-4">{t('cases.col_patient')}</th>
                      <th className="py-3 px-4">{t('cases.col_status')}</th>
                      <th className="py-3 px-4">{t('cases.col_clinic_doctor')}</th>
                      <th className="py-3 px-4">{t('cases.col_manager')}</th>
                      <th className="py-3 px-4">{t('cases.col_sla')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCases.map(item => {
                      const id = item.documentId || item.id
                      const bookingNeeded = role === 'patient' && needsPatientBooking(item)
                      return (
                        <tr key={id} className={`border-b border-slate-50 hover:bg-slate-50/70 ${bookingNeeded ? 'bg-amber-50/40' : ''}`}>
                          <td className="py-4 px-4">
                            <Link to={`${base}/cases/${id}`} state={{ from: location.pathname }} className="font-semibold text-slate-900 hover:text-teal-600">
                              {item.caseNumber || `Case #${item.id}`}
                            </Link>
                            <p className="text-sm text-slate-500 line-clamp-1">{item.title || item.treatmentCategory || t('cases.fallback_title')}</p>
                            {bookingNeeded && (
                              <Link to={`${base}/cases/${id}`} state={{ from: location.pathname }} className="inline-flex items-center gap-1 mt-1 text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full hover:bg-amber-200 transition-colors">
                                <Bell className="w-3 h-3" />
                                {t('cases.action_book_slot')}
                              </Link>
                            )}
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-2">
                              <UserRound className="w-4 h-4 text-slate-400" />
                              <div>
                                <p className="text-sm font-medium text-slate-900">{item.patient?.fullName || t('cases.patient_fallback')}</p>
                                <p className="text-xs text-slate-500">{item.country || item.patient?.country || '—'}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-4"><StatusBadge status={item.status} /></td>
                          <td className="py-4 px-4">
                            <p className="text-sm text-slate-900">{item.clinic?.name || t('cases.not_assigned')}</p>
                            <p className="text-xs text-slate-500">{item.doctor?.fullName || t('cases.doctor_pending')}</p>
                          </td>
                          <td className="py-4 px-4">
                            <p className="text-sm text-slate-700">{item.manager?.fullName || t('cases.unassigned')}</p>
                          </td>
                          <td className="py-4 px-4 text-sm text-slate-500">
                            {(() => {
                              const sla = getCaseSla(item)
                              if (!sla.hours) return item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : '—'
                              return (
                                <span className={sla.overdue ? 'font-semibold text-rose-600' : 'text-slate-500'}>
                                  {sla.overdue ? t('cases.sla_overdue') : t('cases.sla_left', { hours: sla.remainingHours })}
                                </span>
                              )
                            })()}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {showCreate && (
        <CreateCaseModal
          onClose={() => setShowCreate(false)}
          onCreated={(created) => {
            setCases(prev => [created, ...prev])
            setCreatedCase(created)
          }}
        />
      )}

      {createdCase && (
        <CaseCreatedGuide
          isOpen={!!createdCase}
          onClose={() => setCreatedCase(null)}
          caseId={createdCase.documentId || createdCase.id}
          caseNumber={createdCase.caseNumber}
        />
      )}
    </div>
  )
}

export default MedicalCasesPage
