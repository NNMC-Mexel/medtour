import { useEffect, useMemo, useState } from 'react'
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
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Select from '../../components/ui/Select'
import Textarea from '../../components/ui/Textarea'
import Input from '../../components/ui/Input'
import { useToast } from '../../components/ui/Toast'
import useAuthStore from '../../stores/authStore'
import {
  documentsAPI,
  clinicsAPI,
  doctorsAPI,
  getMediaUrl,
  medicalCasesAPI,
  normalizeResponse,
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

function formatStatus(status) {
  return formatCaseStatus(status)
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

function DetailRow({ label, value }) {
  return (
    <div className="flex justify-between gap-4 py-2 border-b border-slate-100 last:border-b-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-medium text-slate-900 text-right">{value || '—'}</span>
    </div>
  )
}

function TimelineItem({ icon: Icon, title, value, muted }) {
  return (
    <div className="flex items-start gap-3">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${muted ? 'bg-slate-100 text-slate-400' : 'bg-teal-100 text-teal-600'}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-sm font-medium text-slate-900">{title}</p>
        <p className="text-sm text-slate-500">{value || 'Pending'}</p>
      </div>
    </div>
  )
}

function CaseDocumentsPanel({ medicalCase, onUploaded }) {
  const toast = useToast()
  const { user } = useAuthStore()
  const [file, setFile] = useState(null)
  const [title, setTitle] = useState('')
  const [type, setType] = useState('other')
  const [description, setDescription] = useState('')
  const [isUploading, setIsUploading] = useState(false)

  const docs = medicalCase.medical_documents || []

  const submit = async (event) => {
    event.preventDefault()
    if (!file) {
      toast.warning('Choose a file first')
      return
    }
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
      toast.success('Document uploaded')
      setFile(null)
      setTitle('')
      setDescription('')
      setType('other')
      onUploaded?.()
    } catch (error) {
      toast.error(error?.response?.data?.error?.message || error.message || 'Could not upload document')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Case documents</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <form onSubmit={submit} className="grid lg:grid-cols-4 gap-3 items-end">
          <Input
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Blood test, MRI, discharge summary..."
          />
          <Select
            label="Type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            options={[
              { value: 'analysis', label: 'Analysis' },
              { value: 'certificate', label: 'Report / certificate' },
              { value: 'mrt', label: 'MRI' },
              { value: 'xray', label: 'X-ray' },
              { value: 'ultrasound', label: 'Ultrasound' },
              { value: 'other', label: 'Other' },
            ]}
          />
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">File</label>
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
            Upload
          </Button>
          <Textarea
            containerClassName="lg:col-span-4"
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
        </form>

        {docs.length === 0 ? (
          <div className="text-sm text-slate-500 bg-slate-50 rounded-xl p-4">
            No documents uploaded for this case yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 rounded-xl border border-slate-100 overflow-hidden">
            {docs.map(doc => {
              const url = getMediaUrl(doc.file)
              return (
                <div key={doc.documentId || doc.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4">
                  <div className="flex items-start gap-3">
                    <FileText className="w-5 h-5 text-teal-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-slate-900">{doc.title}</p>
                      <p className="text-xs text-slate-500">{doc.type || 'other'}{doc.description ? ` · ${doc.description}` : ''}</p>
                    </div>
                  </div>
                  {url && (
                    <a href={url} target="_blank" rel="noreferrer">
                      <Button size="sm" variant="outline">Open</Button>
                    </a>
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
  const toast = useToast()
  const currentPlan = plans[0] || null
  const [isSaving, setIsSaving] = useState(false)
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

  const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }))

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

      toast.success('Treatment plan saved')
      onChanged?.()
    } catch (error) {
      toast.error(error?.response?.data?.error?.message || 'Could not save treatment plan')
    } finally {
      setIsSaving(false)
    }
  }

  const patientDecision = async (status) => {
    if (!currentPlan) return
    setIsSaving(true)
    try {
      await treatmentPlansAPI.update(currentPlan.documentId || currentPlan.id, { status })
      if (status === 'ACCEPTED') {
        await caseEventsAPI.create({
          medical_case: medicalCase.documentId || medicalCase.id,
          eventType: 'PLAN_ACCEPTED',
          fromStatus: medicalCase.status,
          toStatus: 'TRAVEL_PREPARATION',
          message: 'Patient accepted the treatment plan.',
          metadata: { planId: currentPlan.documentId || currentPlan.id },
        })
      }
      toast.success(status === 'ACCEPTED' ? 'Treatment plan accepted' : 'Treatment plan declined')
      onChanged?.()
    } catch (error) {
      toast.error(error?.response?.data?.error?.message || 'Could not save patient decision')
    } finally {
      setIsSaving(false)
    }
  }

  if (!canEdit && !currentPlan) {
    return (
      <Card>
        <CardHeader><CardTitle>Treatment plan</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500">Treatment plan is not ready yet.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Treatment plan</CardTitle>
          {currentPlan && <Badge variant={currentPlan.status === 'ACCEPTED' ? 'success' : currentPlan.status === 'SENT' ? 'primary' : 'warning'}>{currentPlan.status}</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {canEdit ? (
          <>
            <div className="grid md:grid-cols-3 gap-4">
              <Select
                label="Plan status"
                value={form.status}
                onChange={(e) => update('status', e.target.value)}
                options={['DRAFT', 'SENT', 'ACCEPTED', 'DECLINED', 'EXPIRED'].map(value => ({ value, label: value }))}
              />
              <Input
                label="Duration days"
                type="number"
                value={form.estimatedDurationDays}
                onChange={(e) => update('estimatedDurationDays', e.target.value)}
              />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Total cost" type="number" value={form.totalCost} onChange={(e) => update('totalCost', e.target.value)} />
                <Select label="Currency" value={form.currency} onChange={(e) => update('currency', e.target.value)} options={['USD', 'EUR', 'GBP', 'KZT'].map(value => ({ value, label: value }))} />
              </div>
            </div>
            <Textarea label="Diagnosis summary" value={form.diagnosisSummary} onChange={(e) => update('diagnosisSummary', e.target.value)} rows={3} />
            <Textarea label="Doctor decision notes" value={form.doctorDecisionNotes} onChange={(e) => update('doctorDecisionNotes', e.target.value)} rows={3} />
            <Textarea label="Procedures, one per line" value={form.proceduresText} onChange={(e) => update('proceduresText', e.target.value)} rows={4} />
            <Textarea label="Recommendations" value={form.recommendations} onChange={(e) => update('recommendations', e.target.value)} rows={3} />
            <div className="flex justify-end">
              <Button onClick={save} disabled={isSaving} leftIcon={isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}>
                Save treatment plan
              </Button>
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <DetailRow label="Status" value={currentPlan.status} />
            <DetailRow label="Cost" value={currentPlan.totalCost ? `${currentPlan.totalCost} ${currentPlan.currency || ''}` : '—'} />
            <DetailRow label="Duration" value={currentPlan.estimatedDurationDays ? `${currentPlan.estimatedDurationDays} days` : '—'} />
            <div>
              <p className="text-sm font-medium text-slate-900 mb-1">Diagnosis summary</p>
              <p className="text-sm text-slate-600 whitespace-pre-wrap">{currentPlan.diagnosisSummary || '—'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900 mb-1">Procedures</p>
              {Array.isArray(currentPlan.procedures) && currentPlan.procedures.length > 0 ? (
                <ul className="list-disc pl-5 text-sm text-slate-600 space-y-1">
                  {currentPlan.procedures.map((item, index) => <li key={index}>{item?.name || item?.procedure || String(item)}</li>)}
                </ul>
              ) : <p className="text-sm text-slate-500">—</p>}
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900 mb-1">Recommendations</p>
              <p className="text-sm text-slate-600 whitespace-pre-wrap">{currentPlan.recommendations || '—'}</p>
            </div>
            {canApprove && currentPlan.status === 'SENT' && (
              <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2">
                <Button variant="outline" onClick={() => patientDecision('DECLINED')} disabled={isSaving}>
                  Decline plan
                </Button>
                <Button onClick={() => patientDecision('ACCEPTED')} disabled={isSaving}>
                  Accept treatment plan
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function MedicalCaseDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { user } = useAuthStore()
  const role = user?.userRole || 'patient'
  const base = roleBase(role)
  const canManage = ['admin', 'manager', 'coordinator'].includes(role)

  const [medicalCase, setMedicalCase] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [clinics, setClinics] = useState([])
  const [doctors, setDoctors] = useState([])
  const [managers, setManagers] = useState([])
  const [coordinators, setCoordinators] = useState([])
  const [plans, setPlans] = useState([])
  const [checklists, setChecklists] = useState([])
  const [visas, setVisas] = useState([])
  const [tourism, setTourism] = useState([])
  const [events, setEvents] = useState([])
  const [ledger, setLedger] = useState([])
  const [form, setForm] = useState({})

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
        tourismNotes: data?.tourismNotes || '',
      })
    } catch (error) {
      toast.error(error?.response?.data?.error?.message || 'Could not load medical case')
    } finally {
      setIsLoading(false)
    }
  }

  const loadReferenceData = async () => {
    try {
      const requests = [
        clinicsAPI.getAll(),
        doctorsAPI.getAll({ includeInactive: true }),
        treatmentPlansAPI.getByCase(id),
        tripChecklistsAPI.getByCase(id),
        visaRequestsAPI.getByCase(id),
        tourismPackagesAPI.getByCase(id),
        caseEventsAPI.getByCase(id),
        financeLedgerAPI.getAll({ caseId: id }),
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

  const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }))

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

      await medicalCasesAPI.update(id, payload)
      toast.success('Medical case updated')
      await loadCase()
    } catch (error) {
      toast.error(error?.response?.data?.error?.message || 'Could not update case')
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
      toast.success(role === 'manager' ? 'Case assigned to you as manager' : 'Case assigned to you as coordinator')
      await loadCase()
      await loadReferenceData()
    } catch (error) {
      toast.error(error?.response?.data?.error?.message || 'Could not claim case')
    } finally {
      setIsSaving(false)
    }
  }

  const submitDoctorDecision = async (decision) => {
    if (!form.internalNotes?.trim()) {
      toast.warning('Decision notes are required')
      return
    }

    const nextStatus = decision === 'treatment_in_kazakhstan'
      ? 'TREATMENT_IN_KAZAKHSTAN'
      : decision === 'local_treatment'
        ? 'LOCAL_TREATMENT'
        : 'WAITING_FOR_DOCUMENTS'

    const message = decision === 'treatment_in_kazakhstan'
      ? 'Doctor recommended treatment in Kazakhstan.'
      : decision === 'local_treatment'
        ? 'Doctor recommended local treatment.'
        : 'Doctor requested more medical documents.'

    setIsSaving(true)
    try {
      await medicalCasesAPI.update(id, {
        status: nextStatus,
        internalNotes: form.internalNotes,
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
      toast.success('Doctor decision saved')
      await loadCase()
      await loadReferenceData()
    } catch (error) {
      toast.error(error?.response?.data?.error?.message || 'Could not save doctor decision')
    } finally {
      setIsSaving(false)
    }
  }

  const selectedClinicDoctors = useMemo(() => {
    if (!form.clinic) return doctors
    return doctors.filter(doctor => getRef(doctor.clinic) === form.clinic)
  }, [doctors, form.clinic])

  const canDoctorDecide = ['doctor', 'admin', 'coordinator'].includes(role)
  const canEditTreatmentPlan = ['doctor', 'admin', 'coordinator'].includes(role)
  const canApproveTreatmentPlan = role === 'patient'
  const allowedStatusOptions = useMemo(() => {
    const current = normalizeCaseStatus(medicalCase?.status) || 'NEW_LEAD'
    return [current, ...getAllowedCaseTransitions(role, current)]
      .filter((value, index, values) => values.indexOf(value) === index)
  }, [medicalCase?.status, role])
  const caseSla = getCaseSla(medicalCase)

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
          <p className="font-medium text-slate-900">Medical case not found</p>
          <Button className="mt-4" onClick={() => navigate(`${base}/cases`)}>Back to cases</Button>
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
            Back to cases
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{medicalCase.caseNumber || `Case #${medicalCase.id}`}</h1>
            <Badge variant={STATUS_VARIANTS[normalizeCaseStatus(medicalCase.status)] || 'default'}>{formatStatus(medicalCase.status)}</Badge>
            {caseSla.hours && (
              <Badge variant={caseSla.overdue ? 'danger' : 'secondary'}>
                {caseSla.overdue ? 'SLA overdue' : `${caseSla.remainingHours}h SLA left`}
              </Badge>
            )}
          </div>
          <p className="text-slate-600 mt-1">{medicalCase.title || medicalCase.treatmentCategory || 'Medical treatment request'}</p>
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-3">
            {role === 'manager' && !medicalCase.manager && (
              <Button variant="outline" onClick={claimCase} disabled={isSaving}>
                Claim as manager
              </Button>
            )}
            {role === 'coordinator' && !medicalCase.coordinator && (
              <Button variant="outline" onClick={claimCase} disabled={isSaving}>
                Claim as coordinator
              </Button>
            )}
            <Button onClick={save} disabled={isSaving} leftIcon={isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}>
              Save changes
            </Button>
          </div>
        )}
      </div>

      <div className="grid xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Patient request</CardTitle>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-slate-900 mb-3">Patient</h3>
                <DetailRow label="Name" value={medicalCase.patient?.fullName} />
                <DetailRow label="Email" value={medicalCase.patient?.email} />
                <DetailRow label="Phone" value={medicalCase.patient?.phone} />
                <DetailRow label="Country" value={medicalCase.country || medicalCase.patient?.country} />
                <DetailRow label="Language" value={medicalCase.language || medicalCase.patient?.language} />
                <DetailRow label="Timezone" value={medicalCase.timezone || medicalCase.patient?.timezone} />
                <DetailRow label="Preferred contact" value={medicalCase.preferredContact} />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 mb-3">Medical info</h3>
                <DetailRow label="Direction" value={medicalCase.treatmentCategory} />
                <DetailRow label="Urgency" value={medicalCase.urgency} />
                <DetailRow label="Preferred arrival" value={formatDesiredDate(medicalCase.desiredDates)} />
                <DetailRow label="Budget" value={medicalCase.budgetRange} />
                <DetailRow label="Visa support" value={medicalCase.visaSupportNeeded ? 'Needed' : 'Not requested'} />
                <DetailRow label="Diagnosis" value={medicalCase.diagnosis} />
                <DetailRow label="Symptoms" value={medicalCase.symptoms} />
                <DetailRow label="Current treatment" value={medicalCase.currentTreatment} />
                <DetailRow label="Tourism" value={medicalCase.tourismRequested ? 'Requested' : 'Not requested'} />
              </div>
            </CardContent>
          </Card>

          {canManage && (
            <Card>
              <CardHeader>
                <CardTitle>Case management</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid md:grid-cols-2 gap-4">
                  <Select
                    label="Status"
                    value={form.status}
                    onChange={(e) => update('status', e.target.value)}
                    options={allowedStatusOptions.map(value => ({ value, label: formatStatus(value) }))}
                  />
                  <Select
                    label="Clinic"
                    value={form.clinic}
                    onChange={(e) => {
                      update('clinic', e.target.value)
                      update('doctor', '')
                    }}
                    placeholder="Not assigned"
                    options={clinics.map(clinic => ({ value: getRef(clinic), label: clinic.name }))}
                  />
                  <Select
                    label="Doctor"
                    value={form.doctor}
                    onChange={(e) => update('doctor', e.target.value)}
                    placeholder="Not assigned"
                    options={selectedClinicDoctors.map(doctor => ({ value: getRef(doctor), label: doctor.fullName }))}
                  />
                  {role === 'admin' && (
                    <Select
                      label="Manager"
                      value={form.manager}
                      onChange={(e) => update('manager', e.target.value)}
                      placeholder="Not assigned"
                      options={managers.map(manager => ({ value: getRef(manager), label: manager.fullName || manager.email }))}
                    />
                  )}
                  {role === 'admin' && (
                    <Select
                      label="Coordinator"
                      value={form.coordinator}
                      onChange={(e) => update('coordinator', e.target.value)}
                      placeholder="Not assigned"
                      options={coordinators.map(coordinator => ({ value: getRef(coordinator), label: coordinator.fullName || coordinator.email }))}
                    />
                  )}
                </div>
                <Textarea
                  label="Internal notes"
                  value={form.internalNotes}
                  onChange={(e) => update('internalNotes', e.target.value)}
                  rows={4}
                />
                <Textarea
                  label="Tourism notes"
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
                <CardTitle>Doctor decision</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-slate-600">
                  Use this after the initial online consultation to record the doctor's verdict or request additional documents.
                </p>
                <Textarea
                  label="Decision notes"
                  value={form.internalNotes}
                  onChange={(e) => update('internalNotes', e.target.value)}
                  rows={3}
                />
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    onClick={() => submitDoctorDecision('treatment_in_kazakhstan')}
                    disabled={isSaving}
                    leftIcon={<CheckCircle className="w-4 h-4" />}
                  >
                    Treatment in Kazakhstan
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => submitDoctorDecision('local_treatment')}
                    disabled={isSaving}
                  >
                    Local treatment
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => submitDoctorDecision('needs_more_documents')}
                    disabled={isSaving}
                    leftIcon={<FileText className="w-4 h-4" />}
                  >
                    Need more documents
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <CaseDocumentsPanel medicalCase={medicalCase} onUploaded={loadCase} />

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
              <CardTitle>Documents and plans</CardTitle>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-50">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 text-teal-600" />
                  <p className="font-medium text-slate-900">Medical documents</p>
                </div>
                <p className="text-2xl font-bold text-slate-900">{medicalCase.medical_documents?.length || 0}</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-50">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <p className="font-medium text-slate-900">Treatment plans</p>
                </div>
                <p className="text-2xl font-bold text-slate-900">{plans.length}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Assignments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <TimelineItem icon={UserRound} title="Manager" value={medicalCase.manager?.fullName} muted={!medicalCase.manager} />
              <TimelineItem icon={UserRound} title="Coordinator" value={medicalCase.coordinator?.fullName} muted={!medicalCase.coordinator} />
              <TimelineItem icon={Building2} title="Clinic" value={medicalCase.clinic?.name} muted={!medicalCase.clinic} />
              <TimelineItem icon={Stethoscope} title="Doctor" value={medicalCase.doctor?.fullName} muted={!medicalCase.doctor} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Travel workflow</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <TimelineItem icon={FileText} title="Trip checklist" value={checklists[0]?.status} muted={!checklists.length} />
              <TimelineItem icon={Plane} title="Visa request" value={visas[0]?.status} muted={!visas.length} />
              <TimelineItem icon={Calendar} title="Tourism package" value={tourism[0]?.status} muted={!tourism.length} />
            </CardContent>
          </Card>

          {canManage && (
            <Card>
              <CardHeader>
                <CardTitle>Finance ledger</CardTitle>
              </CardHeader>
              <CardContent>
                {ledger.length === 0 ? (
                  <p className="text-sm text-slate-500">No payment or refund ledger entries yet.</p>
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
              <CardTitle>Activity</CardTitle>
            </CardHeader>
            <CardContent>
              {events.length === 0 ? (
                <p className="text-sm text-slate-500">No activity yet.</p>
              ) : (
                <div className="space-y-3">
                  {events.slice(-6).map(event => (
                    <div key={event.id || event.documentId} className="border-l-2 border-teal-200 pl-3">
                      <p className="text-sm font-medium text-slate-900">{event.eventType?.replaceAll('_', ' ') || 'Event'}</p>
                      <p className="text-xs text-slate-500">{event.message || event.createdAt}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default MedicalCaseDetail
