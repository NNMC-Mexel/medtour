import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Activity, AlertCircle, CheckCircle, Clock, FileText, Loader2, Plane, Stethoscope } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import useAuthStore from '../../stores/authStore'
import { medicalCasesAPI, normalizeResponse } from '../../services/api'
import { formatCaseStatus, getCaseSla, normalizeCaseStatus, STATUS_VARIANTS } from '../../utils/medicalCaseWorkflow'

function roleBase(role) {
  if (role === 'admin') return '/admin'
  if (role === 'coordinator') return '/coordinator'
  return '/manager'
}

function StatCard({ icon: Icon, label, value, tone }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${tone}`}>
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

function StaffDashboard() {
  const { user } = useAuthStore()
  const role = user?.userRole || 'manager'
  const base = roleBase(role)
  const [cases, setCases] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    medicalCasesAPI.getAll()
      .then((response) => {
        if (cancelled) return
        const { data } = normalizeResponse(response)
        setCases(Array.isArray(data) ? data : [])
      })
      .catch((err) => {
        if (!cancelled) setError(err?.response?.data?.error?.message || 'Could not load dashboard')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const summary = useMemo(() => {
    const overdue = cases.filter(item => getCaseSla(item).overdue)
    const needsAssignment = cases.filter(item => ['NEW_LEAD', 'REGISTERED', 'WAITING_FOR_DOCUMENTS'].includes(normalizeCaseStatus(item.status)) || !item.manager || !item.coordinator)
    const medicalReview = cases.filter(item => ['DOCUMENTS_UPLOADED', 'UNDER_REVIEW', 'DOCTOR_ASSIGNED', 'CONSULTATION_COMPLETED'].includes(normalizeCaseStatus(item.status)))
    const travel = cases.filter(item => ['TREATMENT_IN_KAZAKHSTAN', 'TRAVEL_PREPARATION', 'ARRIVED_TO_KAZAKHSTAN', 'IN_TREATMENT', 'RECOVERY'].includes(normalizeCaseStatus(item.status)))

    return { overdue, needsAssignment, medicalReview, travel }
  }, [cases])

  const queue = useMemo(() => {
    const weighted = [...cases].sort((a, b) => {
      const aSla = getCaseSla(a)
      const bSla = getCaseSla(b)
      if (aSla.overdue !== bSla.overdue) return aSla.overdue ? -1 : 1
      return new Date(a.updatedAt || a.createdAt) - new Date(b.updatedAt || b.createdAt)
    })
    return weighted.slice(0, 8)
  }, [cases])

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-9 h-9 animate-spin text-teal-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {role === 'coordinator' ? 'Coordinator dashboard' : 'Manager dashboard'}
          </h1>
          <p className="text-slate-600 mt-1">
            Case-first queue for assignments, SLA risks, medical review and travel readiness.
          </p>
        </div>
        <Link to={`${base}/cases`}>
          <Button>Open all cases</Button>
        </Link>
      </div>

      {error && (
        <Card>
          <CardContent className="p-4 text-sm text-rose-600">{error}</CardContent>
        </Card>
      )}

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={AlertCircle} label="SLA overdue" value={summary.overdue.length} tone="bg-rose-500" />
        <StatCard icon={Activity} label="Need assignment" value={summary.needsAssignment.length} tone="bg-amber-500" />
        <StatCard icon={Stethoscope} label="Medical review" value={summary.medicalReview.length} tone="bg-sky-500" />
        <StatCard icon={Plane} label="Travel stage" value={summary.travel.length} tone="bg-emerald-500" />
      </div>

      <div className="grid xl:grid-cols-3 gap-6">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Priority queue</CardTitle>
          </CardHeader>
          <CardContent>
            {queue.length === 0 ? (
              <div className="text-center py-10">
                <CheckCircle className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                <p className="font-medium text-slate-900">No active cases</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {queue.map(item => {
                  const id = item.documentId || item.id
                  const sla = getCaseSla(item)
                  return (
                    <Link key={id} to={`${base}/cases/${id}`} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-4 hover:bg-slate-50 px-2 rounded-lg">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-slate-900">{item.caseNumber || item.title || `Case #${item.id}`}</p>
                          <Badge variant={STATUS_VARIANTS[normalizeCaseStatus(item.status)] || 'default'}>{formatCaseStatus(item.status)}</Badge>
                          {sla.hours && <Badge variant={sla.overdue ? 'danger' : 'secondary'}>{sla.overdue ? 'SLA overdue' : `${sla.remainingHours}h left`}</Badge>}
                        </div>
                        <p className="text-sm text-slate-500 mt-1">
                          {item.patient?.fullName || 'Patient'} · {item.country || 'Country pending'} · {item.treatmentCategory || 'Direction pending'}
                        </p>
                      </div>
                      <div className="text-sm text-slate-500 sm:text-right">
                        <p>{item.clinic?.name || 'Clinic pending'}</p>
                        <p>{item.doctor?.fullName || 'Doctor pending'}</p>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>SLA policy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-amber-500 mt-0.5" />
              <div>
                <p className="font-medium text-slate-900">First response</p>
                <p className="text-sm text-slate-500">New leads should receive a first response within 2 hours.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Stethoscope className="w-5 h-5 text-sky-500 mt-0.5" />
              <div>
                <p className="font-medium text-slate-900">Medical review</p>
                <p className="text-sm text-slate-500">Review and plan-forming stages are monitored at 24-48 hours.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-teal-500 mt-0.5" />
              <div>
                <p className="font-medium text-slate-900">Stuck cases</p>
                <p className="text-sm text-slate-500">Overdue items are sorted to the top of every queue.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default StaffDashboard
