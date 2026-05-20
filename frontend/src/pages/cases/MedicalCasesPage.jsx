import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  Activity,
  AlertCircle,
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

function formatStatus(status) {
  return formatCaseStatus(status)
}

function StatusBadge({ status }) {
  const normalizedStatus = normalizeCaseStatus(status)
  return (
    <Badge variant={STATUS_VARIANTS[normalizedStatus] || 'default'}>
      {formatStatus(status)}
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
        visaSupportNeeded: form.visaSupportNeeded === 'true',
        currentTreatment: form.currentTreatment,
        tourismRequested: form.tourismRequested === 'true',
        language: user?.language || 'en',
        timezone: user?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      })
      const { data } = normalizeResponse(response)
      toast.success('Medical case created')
      onCreated(data)
      onClose()
    } catch (error) {
      toast.error(error?.response?.data?.error?.message || 'Could not create medical case')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal isOpen onClose={onClose} title="Start medical case" size="lg">
      <form onSubmit={submit} className="space-y-4">
        <Input
          label="Case title"
          value={form.title}
          onChange={(e) => update('title', e.target.value)}
          placeholder="Knee replacement, oncology review, cardiac surgery..."
        />
        <div className="grid sm:grid-cols-2 gap-4">
          <Input
            label="Country"
            value={form.country}
            onChange={(e) => update('country', e.target.value)}
            placeholder="United Kingdom"
          />
          <Input
            label="Treatment direction"
            value={form.treatmentCategory}
            onChange={(e) => update('treatmentCategory', e.target.value)}
            placeholder="Cardiology, oncology, orthopedics..."
          />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <Select
            label="Urgency"
            value={form.urgency}
            onChange={(e) => update('urgency', e.target.value)}
            options={[
              { value: 'routine', label: 'Routine: can wait 1-3 months' },
              { value: 'soon', label: 'Soon: within 2-4 weeks' },
              { value: 'urgent', label: 'Urgent: as soon as possible' },
            ]}
          />
          <Input
            label="Preferred arrival date"
            type="date"
            value={form.preferredArrivalDate}
            onChange={(e) => update('preferredArrivalDate', e.target.value)}
          />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <Input
            label="Approximate budget"
            value={form.budgetRange}
            onChange={(e) => update('budgetRange', e.target.value)}
            placeholder="Up to 10,000 USD, flexible..."
          />
          <Input
            label="Preferred contact"
            value={form.preferredContact}
            onChange={(e) => update('preferredContact', e.target.value)}
            placeholder="WhatsApp, Telegram, phone..."
          />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <Select
            label="Visa support"
            value={form.visaSupportNeeded}
            onChange={(e) => update('visaSupportNeeded', e.target.value)}
            options={[
              { value: 'unknown', label: 'Not sure yet' },
              { value: 'true', label: 'Yes, visa support needed' },
              { value: 'false', label: 'No visa support needed' },
            ]}
          />
          <Select
            label="Tourism support"
            value={form.tourismRequested}
            onChange={(e) => update('tourismRequested', e.target.value)}
            options={[
              { value: 'false', label: 'Medical trip only' },
              { value: 'true', label: 'Interested in tourism options' },
            ]}
          />
        </div>
        <Textarea
          label="Diagnosis or suspected diagnosis"
          value={form.diagnosis}
          onChange={(e) => update('diagnosis', e.target.value)}
          rows={3}
        />
        <Textarea
          label="Current treatment and important context"
          value={form.currentTreatment}
          onChange={(e) => update('currentTreatment', e.target.value)}
          rows={3}
        />
        <Textarea
          label="Symptoms and patient notes"
          value={form.symptoms}
          onChange={(e) => update('symptoms', e.target.value)}
          rows={4}
        />
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={isSaving} leftIcon={isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}>
            Create case
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function MedicalCasesPage() {
  const { user } = useAuthStore()
  const role = user?.userRole || 'patient'
  const location = useLocation()
  const toast = useToast()
  const [cases, setCases] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [showCreate, setShowCreate] = useState(false)

  const base = roleBase(role)
  const canCreate = role === 'patient'

  const loadCases = async () => {
    setIsLoading(true)
    try {
      const response = await medicalCasesAPI.getAll(status ? { status } : {})
      const { data } = normalizeResponse(response)
      setCases(Array.isArray(data) ? data : [])
    } catch (error) {
      toast.error(error?.response?.data?.error?.message || 'Could not load medical cases')
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

  const stats = useMemo(() => ({
    total: cases.length,
    active: cases.filter(item => !['COMPLETED', 'CANCELLED'].includes(normalizeCaseStatus(item.status))).length,
    planReady: cases.filter(item => normalizeCaseStatus(item.status) === 'WAITING_PATIENT_CONFIRMATION').length,
    confirmed: cases.filter(item => ['TREATMENT_IN_KAZAKHSTAN', 'TRAVEL_PREPARATION', 'ARRIVED_TO_KAZAKHSTAN', 'IN_TREATMENT', 'RECOVERY'].includes(normalizeCaseStatus(item.status))).length,
    overdue: cases.filter(item => getCaseSla(item).overdue).length,
  }), [cases])

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Medical cases</h1>
          <p className="text-slate-600 mt-1">
            {role === 'patient'
              ? 'Track your treatment request, documents, consultation and plan.'
              : 'Manage patient cases, assignments, clinic matching and treatment workflow.'}
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setShowCreate(true)} leftIcon={<Plus className="w-4 h-4" />}>
            Start medical case
          </Button>
        )}
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={Activity} label="Total cases" value={stats.total} className="bg-teal-500" />
        <StatCard icon={Clock} label="Active" value={stats.active} className="bg-sky-500" />
        <StatCard icon={FileText} label="Awaiting patient" value={stats.planReady} className="bg-amber-500" />
        <StatCard icon={stats.overdue > 0 ? AlertCircle : CheckCircle} label={stats.overdue > 0 ? 'SLA overdue' : 'Treatment+'} value={stats.overdue > 0 ? stats.overdue : stats.confirmed} className={stats.overdue > 0 ? 'bg-rose-500' : 'bg-emerald-500'} />
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <CardTitle>Cases</CardTitle>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search cases..."
                  className="w-full sm:w-72 pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <Select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                placeholder="All statuses"
                className="min-w-48"
                options={MEDICAL_CASE_STATUSES.map(value => ({ value, label: formatStatus(value) }))}
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
              <p className="font-medium text-slate-900">No cases found</p>
              <p className="text-sm text-slate-500 mt-1">New patient cases will appear here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px]">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="py-3 px-4">Case</th>
                    <th className="py-3 px-4">Patient</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Clinic / doctor</th>
                    <th className="py-3 px-4">Manager</th>
                    <th className="py-3 px-4">SLA</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCases.map(item => {
                    const id = item.documentId || item.id
                    return (
                      <tr key={id} className="border-b border-slate-50 hover:bg-slate-50/70">
                        <td className="py-4 px-4">
                          <Link to={`${base}/cases/${id}`} state={{ from: location.pathname }} className="font-semibold text-slate-900 hover:text-teal-600">
                            {item.caseNumber || `Case #${item.id}`}
                          </Link>
                          <p className="text-sm text-slate-500 line-clamp-1">{item.title || item.treatmentCategory || 'Medical treatment request'}</p>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <UserRound className="w-4 h-4 text-slate-400" />
                            <div>
                              <p className="text-sm font-medium text-slate-900">{item.patient?.fullName || 'Patient'}</p>
                              <p className="text-xs text-slate-500">{item.country || item.patient?.country || '—'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4"><StatusBadge status={item.status} /></td>
                        <td className="py-4 px-4">
                          <p className="text-sm text-slate-900">{item.clinic?.name || 'Not assigned'}</p>
                          <p className="text-xs text-slate-500">{item.doctor?.fullName || 'Doctor pending'}</p>
                        </td>
                        <td className="py-4 px-4">
                          <p className="text-sm text-slate-700">{item.manager?.fullName || 'Unassigned'}</p>
                          <p className="text-xs text-slate-500">{item.coordinator?.fullName || 'No coordinator'}</p>
                        </td>
                        <td className="py-4 px-4 text-sm text-slate-500">
                          {(() => {
                            const sla = getCaseSla(item)
                            if (!sla.hours) return item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : '—'
                            return (
                              <span className={sla.overdue ? 'font-semibold text-rose-600' : 'text-slate-500'}>
                                {sla.overdue ? 'Overdue' : `${sla.remainingHours}h left`}
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
          )}
        </CardContent>
      </Card>

      {showCreate && (
        <CreateCaseModal
          onClose={() => setShowCreate(false)}
          onCreated={(created) => setCases(prev => [created, ...prev])}
        />
      )}
    </div>
  )
}

export default MedicalCasesPage
