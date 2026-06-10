import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Activity, Calendar, CheckCircle2, FileText, Loader2, Plane } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import {
  medicalCasesAPI,
  normalizeResponse,
  treatmentPlansAPI,
  tripChecklistsAPI,
  visaRequestsAPI,
} from '../../services/api'
import { formatCaseStatus, normalizeCaseStatus } from '../../utils/medicalCaseWorkflow'

function TripItem({ label, done }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
      <CheckCircle2 className={done ? 'h-4 w-4 text-emerald-600' : 'h-4 w-4 text-slate-300'} />
      <span className="text-sm text-slate-700">{label}</span>
    </div>
  )
}

function PatientPlanTrip() {
  const { t } = useTranslation()
  const [medicalCases, setMedicalCases] = useState([])
  const [plans, setPlans] = useState([])
  const [checklists, setChecklists] = useState([])
  const [visas, setVisas] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  const activeCase = useMemo(() => {
    const openCases = medicalCases.filter((item) => !['COMPLETED', 'CANCELLED'].includes(normalizeCaseStatus(item.status)))
    return openCases[0] || medicalCases[0] || null
  }, [medicalCases])

  useEffect(() => {
    let active = true

    const load = async () => {
      setIsLoading(true)
      try {
        const response = await medicalCasesAPI.getAll()
        const { data } = normalizeResponse(response)
        const cases = Array.isArray(data) ? data : []
        if (!active) return
        setMedicalCases(cases)

        const current = cases.find((item) => !['COMPLETED', 'CANCELLED'].includes(normalizeCaseStatus(item.status))) || cases[0]
        const caseId = current?.documentId || current?.id
        if (!caseId) return

        const [planRes, checklistRes, visaRes] = await Promise.all([
          treatmentPlansAPI.getByCase(caseId),
          tripChecklistsAPI.getByCase(caseId),
          visaRequestsAPI.getByCase(caseId),
        ])
        if (!active) return
        setPlans(normalizeResponse(planRes).data || [])
        setChecklists(normalizeResponse(checklistRes).data || [])
        setVisas(normalizeResponse(visaRes).data || [])
      } finally {
        if (active) setIsLoading(false)
      }
    }

    load()
    return () => { active = false }
  }, [])

  const currentPlan = plans[0] || null
  const currentChecklist = checklists[0] || null
  const currentVisa = visas[0] || null
  const checklistItems = Array.isArray(currentChecklist?.items) && currentChecklist.items.length > 0
    ? currentChecklist.items
    : [
        { label: t('plan_trip.default_visa'), done: Boolean(currentVisa && currentVisa.status !== 'NOT_STARTED') },
        { label: t('plan_trip.default_tickets'), done: false },
        { label: t('plan_trip.default_hotel'), done: false },
        { label: t('plan_trip.default_transfer'), done: false },
        { label: t('plan_trip.default_treatment'), done: false },
        { label: t('plan_trip.default_post_care'), done: false },
      ]

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center gap-2 py-12 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin text-teal-600" />
          {t('common.loading')}
        </CardContent>
      </Card>
    )
  }

  if (!activeCase) {
    return (
      <Card>
        <CardContent className="space-y-4 py-10 text-center">
          <Activity className="mx-auto h-12 w-12 text-slate-300" />
          <p className="text-slate-600">{t('plan_trip.no_case')}</p>
          <Link to="/patient/cases">
            <Button>{t('patient.case_start_btn')}</Button>
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 animate-fadeIn">
      <Card>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-teal-700">{t('patient.case_label')}</p>
            <h1 className="mt-1 text-xl font-bold text-slate-900">
              {activeCase.caseNumber || activeCase.title || t('patient.case_label')}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              {formatCaseStatus(activeCase.status, t)}
            </p>
          </div>
          <Link to={`/patient/cases/${activeCase.documentId || activeCase.id}`}>
            <Button variant="outline">{t('patient.case_open_btn')}</Button>
          </Link>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-teal-600" />
              {t('case_detail.section_treatment_plan')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {currentPlan ? (
              <>
                <Badge variant={currentPlan.status === 'ACCEPTED' ? 'success' : currentPlan.status === 'SENT' ? 'primary' : 'warning'}>
                  {t(`case_detail.plan_status_${currentPlan.status?.toLowerCase()}`, { defaultValue: currentPlan.status })}
                </Badge>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">{t('case_detail.label_plan_cost')}</p>
                    <p className="font-semibold text-slate-900">{currentPlan.totalCost ? `${currentPlan.totalCost} ${currentPlan.currency || ''}` : '-'}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">{t('case_detail.label_plan_duration')}</p>
                    <p className="font-semibold text-slate-900">{currentPlan.estimatedDurationDays || '-'}</p>
                  </div>
                </div>
                <p className="whitespace-pre-wrap text-sm text-slate-700">
                  {currentPlan.diagnosisSummary || currentPlan.recommendations || t('plan_trip.plan_pending_details')}
                </p>
              </>
            ) : (
              <p className="text-sm text-slate-500">{t('plan_trip.no_plan')}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plane className="h-5 w-5 text-teal-600" />
              {t('case_detail.section_travel')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">{t('case_detail.trip_checklist')}</p>
                <p className="font-semibold text-slate-900">{currentChecklist?.status || 'OPEN'}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">{t('case_detail.visa_request')}</p>
                <p className="font-semibold text-slate-900">{currentVisa?.status || 'NOT_STARTED'}</p>
              </div>
            </div>
            <div className="space-y-2">
              {checklistItems.map((item, index) => (
                <TripItem key={index} label={item.label || item.title || item.name || String(item)} done={Boolean(item.done || item.completed)} />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="flex items-start gap-3">
          <Calendar className="mt-0.5 h-5 w-5 text-sky-600" />
          <div>
            <p className="font-medium text-slate-900">{t('plan_trip.timeline_title')}</p>
            <p className="mt-1 text-sm text-slate-600">{t('plan_trip.timeline_hint')}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default PatientPlanTrip
