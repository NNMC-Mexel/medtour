import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import CaseCreatedGuide from '../../components/cases/CaseCreatedGuide'
import {
  Activity,
  AlertCircle,
  Bell,
  ChevronDown,
  CheckCircle,
  Clock,
  FileText,
  Loader2,
  Plus,
  Search,
  UserRound,
  Upload,
  X,
  ChevronLeft,
  ChevronRight,
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
import { documentsAPI, medicalCasesAPI, normalizeResponse, specializationsAPI, uploadFile } from '../../services/api'
import { getCaseSla, formatCaseStatus, MEDICAL_CASE_STATUSES, normalizeCaseStatus, STATUS_VARIANTS } from '../../utils/medicalCaseWorkflow'
import { cn } from '../../utils/helpers'
import { foldCountryText, getCountryOptions, normalizeCountryValue } from '../../utils/countries'

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

const MAX_CUSTOM_CONTACT_LENGTH = 80
const PREFERRED_CONTACT_METHODS = ['phone', 'whatsapp', 'telegram', 'email', 'instagram', 'other']
const BOOKING_NEEDED_STATUSES = ['DOCTOR_ASSIGNED', 'WAITING_PATIENT_CONFIRMATION', 'UNDER_REVIEW', 'DOCUMENTS_UPLOADED']

function needsPatientBooking(item) {
  const status = normalizeCaseStatus(item.status)
  return !!item.doctor && BOOKING_NEEDED_STATUSES.includes(status)
}

function isValidPreferredArrivalDate(value) {
  if (!value) return true
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
}

function serializePreferredContact(method, customValue) {
  if (method === 'other') return `other:${customValue.trim()}`
  return PREFERRED_CONTACT_METHODS.includes(method) ? method : ''
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

function SearchableFreeSelect({
  label,
  value,
  options,
  onChange,
  placeholder,
  searchPlaceholder,
  customPrefix,
  noResultsText,
}) {
  const rootRef = useRef(null)
  const searchRef = useRef(null)
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')

  const selectedOption = options.find((option) => option.value === value)
  const displayValue = selectedOption?.label || value || ''
  const normalizedQuery = foldCountryText(query)

  const filteredOptions = useMemo(() => {
    if (!normalizedQuery) return options
    return options.filter((option) => (
      foldCountryText(option.label).includes(normalizedQuery) ||
      foldCountryText(option.value).includes(normalizedQuery)
    ))
  }, [normalizedQuery, options])

  const customValue = query.trim()
  const hasExactMatch = options.some((option) => (
    foldCountryText(option.label) === foldCountryText(customValue) ||
    foldCountryText(option.value) === foldCountryText(customValue)
  ))
  const canUseCustom = Boolean(customValue && !hasExactMatch)

  useEffect(() => {
    if (!isOpen) return undefined

    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setIsOpen(false)
        setQuery('')
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [isOpen])

  useEffect(() => {
    if (isOpen) searchRef.current?.focus()
  }, [isOpen])

  const selectValue = (nextValue) => {
    onChange(nextValue)
    setIsOpen(false)
    setQuery('')
  }

  return (
    <div ref={rootRef} className="space-y-1.5">
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          className="w-full min-h-[46px] px-4 py-2.5 pr-10 rounded-xl border border-slate-200 bg-white text-left transition-all duration-200 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
        >
          <span className={cn('block truncate', !displayValue && 'text-slate-400')}>
            {displayValue || placeholder}
          </span>
        </button>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />

        {isOpen && (
          <div className="absolute z-40 mt-2 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="p-2 border-b border-slate-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  ref={searchRef}
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && canUseCustom) {
                      event.preventDefault()
                      selectValue(customValue)
                    }
                  }}
                  placeholder={searchPlaceholder}
                  className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>
            <div className="max-h-56 overflow-y-auto py-1">
              {filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => selectValue(option.value)}
                  className={cn(
                    'flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-teal-50',
                    value === option.value ? 'bg-teal-50 text-teal-700' : 'text-slate-700'
                  )}
                >
                  <span className="truncate">{option.label}</span>
                  {option.meta && <span className="shrink-0 text-xs text-slate-400">{option.meta}</span>}
                </button>
              ))}

              {canUseCustom && (
                <button
                  type="button"
                  onClick={() => selectValue(customValue)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-teal-700 hover:bg-teal-50"
                >
                  <Plus className="w-4 h-4" />
                  <span className="truncate">{customPrefix} "{customValue}"</span>
                </button>
              )}

              {filteredOptions.length === 0 && !canUseCustom && (
                <p className="px-3 py-4 text-sm text-slate-500">{noResultsText}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function getSpecializationName(item, language) {
  const lang = String(language || 'ru').split('-')[0]
  if (lang === 'en') return item.nameEn || item.name || ''
  if (lang === 'kk') return item.nameKk || item.name || ''
  return item.name || item.nameEn || item.nameKk || ''
}

function CreateCaseModal({ onClose, onCreated }) {
  const { t, i18n } = useTranslation()
  const { user } = useAuthStore()
  const toast = useToast()
  const [isSaving, setIsSaving] = useState(false)
  const [step, setStep] = useState(1)
  const [specializations, setSpecializations] = useState([])
  const [uploadedDocuments, setUploadedDocuments] = useState([])
  const [isUploading, setIsUploading] = useState(false)
  const [arrivalDateError, setArrivalDateError] = useState('')
  const fileInputRef = useRef(null)

  const [form, setForm] = useState({
    title: '',
    country: normalizeCountryValue(user?.country) || user?.country || '',
    diagnosis: '',
    symptoms: '',
    treatmentCategory: '',
    urgency: 'routine',
    preferredArrivalDate: '',
    preferredContactMethod: user?.phone ? 'phone' : user?.email ? 'email' : '',
    preferredContactOther: '',
    visaSupportNeeded: 'unknown',
    tourismRequested: 'false',
    leadSource: '',
    leadCampaign: '',
  })

  const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }))

  const language = i18n.resolvedLanguage || i18n.language || user?.language || 'ru'
  const countryOptions = useMemo(() => (
    getCountryOptions(language).map((option) => ({
      ...option,
      meta: option.value,
    }))
  ), [language])
  const specializationOptions = useMemo(() => (
    [...new Set(
      specializations
        .map((item) => getSpecializationName(item, language))
        .filter(Boolean)
    )].map((name) => ({ value: name, label: name }))
  ), [specializations, language])

  useEffect(() => {
    let ignore = false

    specializationsAPI.getAll()
      .then((response) => {
        if (ignore) return
        const { data } = normalizeResponse(response)
        setSpecializations(Array.isArray(data) ? data : [])
      })
      .catch((error) => {
        console.error('Error loading specializations:', error)
      })

    return () => {
      ignore = true
    }
  }, [])

  const handleFileSelect = async (files) => {
    if (!files.length) return

    setIsUploading(true)
    try {
      for (const file of files) {
        const uploaded = await uploadFile(file)
        if (uploaded) {
          setUploadedDocuments(prev => [...prev, uploaded])
          toast.success(`${file.name} ${t('cases.file_uploaded')}`)
        }
      }
    } catch (error) {
      toast.error(error.message || t('cases.upload_error'))
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const removeDocument = (index) => {
    setUploadedDocuments(prev => prev.filter((_, i) => i !== index))
  }

  const canProceedStep1 = form.title && form.country && form.treatmentCategory
  const hasValidContact = PREFERRED_CONTACT_METHODS.includes(form.preferredContactMethod)
    && (form.preferredContactMethod !== 'other' || Boolean(form.preferredContactOther.trim()))
  const canProceedStep2 = form.urgency
    && !arrivalDateError
    && isValidPreferredArrivalDate(form.preferredArrivalDate)
    && hasValidContact
  const canProceedStep3 = form.visaSupportNeeded && form.leadSource

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
        preferredContact: serializePreferredContact(form.preferredContactMethod, form.preferredContactOther),
        leadSource: form.leadSource,
        leadCampaign: form.leadCampaign,
        leadReferrer: typeof document !== 'undefined' ? document.referrer : '',
        visaSupportNeeded: form.visaSupportNeeded === 'true',
        tourismRequested: form.tourismRequested === 'true',
        language: user?.language || 'en',
        timezone: user?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      })
      const { data } = normalizeResponse(response)

      const caseRef = data?.documentId || data?.id
      let hasDocumentLinkError = false
      if (caseRef && uploadedDocuments.length > 0) {
        const documentResults = await Promise.allSettled(uploadedDocuments.map((doc) => documentsAPI.create({
          title: doc.name || t('cases.uploaded_document_title'),
          type: 'other',
          description: '',
          file: doc.id,
          medical_case: caseRef,
        })))
        hasDocumentLinkError = documentResults.some((result) => result.status === 'rejected')
        if (hasDocumentLinkError) {
          console.error('Some medical documents failed to link:', documentResults)
        }
      }

      let createdCase = data
      if (caseRef) {
        try {
          const updatedResponse = await medicalCasesAPI.getOne(caseRef)
          createdCase = normalizeResponse(updatedResponse)?.data || data
        } catch (refreshError) {
          console.error('Error refreshing created medical case:', refreshError)
        }
      }

      if (hasDocumentLinkError) {
        toast.warning(t('cases.toast_created_document_link_error'))
      } else {
        toast.success(t('cases.toast_created'))
      }
      onCreated(createdCase)
      onClose()
    } catch (error) {
      toast.error(error?.response?.data?.error?.message || t('cases.toast_create_error'))
    } finally {
      setIsSaving(false)
    }
  }

  const totalSteps = 3
  const stepTitles = [
    t('cases.step1_title') || 'Основная информация',
    t('cases.step2_title') || 'Сроки и госпитализация',
    t('cases.step3_title') || 'Поддержка и комментарий',
  ]

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`${t('cases.modal_title')} - ${stepTitles[step - 1]}`}
      size="lg"
      footer={
        <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-slate-500 sm:min-w-[88px]">
            {t('cases.step')} {step} {t('cases.of')} {totalSteps}
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:ml-auto">
            {step > 1 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(step - 1)}
                disabled={isSaving}
                leftIcon={<ChevronLeft className="w-4 h-4" />}
              >
                {t('common.back') || 'Назад'}
              </Button>
            )}
            {step < totalSteps && (
              <Button
                type="button"
                onClick={() => setStep(step + 1)}
                disabled={
                  isSaving ||
                  (step === 1 && !canProceedStep1) ||
                  (step === 2 && !canProceedStep2) ||
                  (step === 3 && !canProceedStep3)
                }
                rightIcon={<ChevronRight className="w-4 h-4" />}
              >
                {t('common.next') || 'Далее'}
              </Button>
            )}
            {step === totalSteps && (
              <>
                <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
                  {t('common.cancel')}
                </Button>
                <Button
                  type="submit"
                  disabled={isSaving}
                  leftIcon={isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  onClick={submit}
                >
                  {t('cases.create_btn')}
                </Button>
              </>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Step 1: Basic Info + Documents */}
        {step === 1 && (
          <div className="space-y-4">
            <Input
              label={t('cases.case_title_label')}
              value={form.title}
              onChange={(e) => update('title', e.target.value)}
              placeholder={t('cases.case_title_placeholder')}
              required
            />
            <div className="grid sm:grid-cols-2 gap-4">
              <SearchableFreeSelect
                label={t('cases.country_label')}
                value={form.country}
                options={countryOptions}
                onChange={(value) => update('country', normalizeCountryValue(value) || value)}
                placeholder={t('cases.country_placeholder')}
                searchPlaceholder={t('cases.country_search_placeholder')}
                customPrefix={t('cases.use_custom_value')}
                noResultsText={t('cases.no_options')}
              />
              <SearchableFreeSelect
                label={t('cases.treatment_dir_label')}
                value={form.treatmentCategory}
                options={specializationOptions}
                onChange={(value) => update('treatmentCategory', value)}
                placeholder={t('cases.treatment_dir_placeholder')}
                searchPlaceholder={t('cases.treatment_dir_search_placeholder')}
                customPrefix={t('cases.use_custom_value')}
                noResultsText={t('cases.no_options')}
              />
            </div>

            {/* Document Upload Section */}
            <div className="border-t pt-4">
              <h3 className="font-semibold text-slate-900 mb-3">{t('cases.upload_documents') || 'Загрузить документы'}</h3>
              <div className="space-y-3">
                <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-teal-500 transition-colors cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm font-medium text-slate-900">{t('cases.drop_files') || 'Перетащите файлы сюда'}</p>
                  <p className="text-xs text-slate-500 mt-1">{t('cases.or_click') || 'или нажмите для выбора'}</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.mp4,.webm,.mov"
                    onChange={(e) => handleFileSelect(Array.from(e.target.files))}
                    className="hidden"
                    disabled={isUploading}
                  />
                </div>

                {uploadedDocuments.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-700">{t('cases.uploaded_files') || 'Загруженные файлы'}</p>
                    <div className="space-y-2">
                      {uploadedDocuments.map((doc, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 bg-teal-50 border border-teal-200 rounded-lg">
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="w-4 h-4 text-teal-600 shrink-0" />
                            <span className="text-sm text-slate-700 truncate">{doc.name || 'File'}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeDocument(idx)}
                            className="ml-2 p-1 hover:bg-teal-200 rounded transition-colors"
                          >
                            <X className="w-4 h-4 text-teal-600" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Hospitalization urgency & contact */}
        {step === 2 && (
          <div className="space-y-4">
            <Select
              label={t('cases.urgency_label')}
              value={form.urgency}
              onChange={(e) => update('urgency', e.target.value)}
              options={[
                { value: 'routine', label: t('cases.urgency_routine') },
                { value: 'soon', label: t('cases.urgency_soon') },
                { value: 'urgent', label: t('cases.urgency_urgent') },
              ]}
              required
            />
            <Input
              label={t('cases.arrival_date_label')}
              type="date"
              value={form.preferredArrivalDate}
              max="9999-12-31"
              maxLength={10}
              error={arrivalDateError}
              onChange={(e) => {
                const value = e.target.value
                if (value.length > 10 || !isValidPreferredArrivalDate(value)) {
                  update('preferredArrivalDate', '')
                  setArrivalDateError(t('cases.arrival_date_error'))
                  return
                }
                update('preferredArrivalDate', value)
                setArrivalDateError('')
              }}
            />
            <Select
              label={t('cases.contact_label')}
              value={form.preferredContactMethod}
              onChange={(e) => {
                update('preferredContactMethod', e.target.value)
                if (e.target.value !== 'other') update('preferredContactOther', '')
              }}
              placeholder={t('cases.contact_placeholder')}
              options={PREFERRED_CONTACT_METHODS.map(method => ({
                value: method,
                label: t(`cases.contact_method_${method}`),
              }))}
              required
            />
            {form.preferredContactMethod === 'other' && (
              <Input
                label={t('cases.contact_other_label')}
                value={form.preferredContactOther}
                onChange={(e) => update('preferredContactOther', e.target.value.slice(0, MAX_CUSTOM_CONTACT_LENGTH))}
                placeholder={t('cases.contact_other_placeholder')}
                maxLength={MAX_CUSTOM_CONTACT_LENGTH}
                hint={t('cases.characters_counter', {
                  current: form.preferredContactOther.length,
                  max: MAX_CUSTOM_CONTACT_LENGTH,
                })}
                required
              />
            )}
          </div>
        )}

        {/* Step 3: Support, source and patient comment */}
        {step === 3 && (
          <div className="space-y-4">
            <Select
              label={t('cases.visa_label')}
              value={form.visaSupportNeeded}
              onChange={(e) => update('visaSupportNeeded', e.target.value)}
              options={[
                { value: 'unknown', label: t('cases.visa_unknown') },
                { value: 'true', label: t('cases.visa_yes') },
                { value: 'false', label: t('cases.visa_no') },
              ]}
              required
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
              required
            />
            <Textarea
              label={t('cases.patient_comment_label')}
              value={form.leadCampaign}
              onChange={(e) => update('leadCampaign', e.target.value)}
              rows={3}
              placeholder={t('cases.patient_comment_placeholder')}
            />
          </div>
        )}
      </div>
    </Modal>
  )
}

function MedicalCasesPage() {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const role = user?.userRole || 'patient'
  const location = useLocation()
  const navigate = useNavigate()
  const toast = useToast()
  const [cases, setCases] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [createdCase, setCreatedCase] = useState(null) // triggers onboarding guide

  const base = roleBase(role)
  const canCreate = role === 'patient'

  const loadCases = useCallback(async () => {
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
  }, [status, t, toast])

  useEffect(() => {
    loadCases()
  }, [loadCases])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const shouldOpenCreate = location.state?.openCreate || params.get('create') === '1'

    if (!canCreate || !shouldOpenCreate) return

    setShowCreate(true)
    navigate(location.pathname, { replace: true, state: {} })
  }, [canCreate, location.pathname, location.search, location.state, navigate])

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
            window.dispatchEvent(new Event('medtour:cases-changed'))
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
