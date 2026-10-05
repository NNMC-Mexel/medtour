import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import { CalendarClock, Camera, Check, Loader2, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Textarea from '../../components/ui/Textarea'
import Modal from '../../components/ui/Modal'
import Badge from '../../components/ui/Badge'
import ImageCropModal from '../../components/ui/ImageCropModal'
import { useToast } from '../../components/ui/Toast'
import api, { clinicsAPI, contentAPI, doctorsAPI, getMediaUrl, normalizeResponse, specializationsAPI, uploadFile } from '../../services/api'
import { getPasswordError } from '../../utils/helpers'
import AdminScheduleBuilder from '../../components/admin/AdminScheduleBuilder'
import DoctorScheduleModal from '../../components/admin/DoctorScheduleModal'
import { createRecurringSchedule, getDoctorScheduleConfig } from '../../utils/schedule'
import { buildSchedulePayload, saveWithScheduleConflictConfirm } from '../../utils/scheduleSave'
import { TREATMENT_DEPARTMENTS, localizeDepartment, mergeTreatmentDepartments } from '../../data/treatmentDepartments'

const defaultForm = {
  username: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
  fullName: '',
  specialization: '',
  treatmentDepartments: [],
  experience: '0',
  price: '8000',
  licenseNumber: '',
  position: '',
  workplace: '',
  bio: '',
  education: '',
  isActive: true,
  slotDuration: '30',
  scheduleConfig: null,
}

const slotDurationOptions = [15, 30, 45, 60]

const getClinicRef = (clinic) => String(clinic?.documentId || clinic?.id || '')

const normalizeClinicName = (value) => String(value || '')
  .trim()
  .toLocaleLowerCase()
  .replace(/[^a-zа-яәғқңөұүһ0-9]/gi, '')

const resolveDoctorWorkplace = (doctor, clinics) => {
  const relatedClinic = Array.isArray(doctor?.clinic) ? doctor.clinic[0] : doctor?.clinic
  const relatedClinicRef = getClinicRef(relatedClinic)
  const clinicByRelation = clinics.find((clinic) => getClinicRef(clinic) === relatedClinicRef)
  if (clinicByRelation) return clinicByRelation.name
  if (relatedClinic?.name) return relatedClinic.name

  const workplace = normalizeClinicName(doctor?.workplace)
  const clinicByName = clinics.find((clinic) => normalizeClinicName(clinic.name) === workplace)
  if (clinicByName) return clinicByName.name

  if (workplace === 'ннмц') {
    return clinics.find((clinic) => clinic.clinicType === 'nnmc' || clinic.slug === 'nnmc')?.name || ''
  }

  return ''
}

const extractUser = (value) => {
  if (!value) return null
  if (Array.isArray(value)) return value[0] || null
  return value
}

const extractCreatedUser = (response) => {
  if (!response?.data) return null
  if (response.data.user?.id) return response.data.user
  if (response.data.id) return response.data
  if (response.data.data?.id) return response.data.data
  return null
}

function toPayload(form, clinics, schedulePayload) {
  const selectedClinic = clinics.find((clinic) => clinic.name === form.workplace)

  return {
    fullName: form.fullName.trim(),
    specialization: form.specialization ? Number(form.specialization) : null,
    treatmentDepartments: form.treatmentDepartments,
    experience: Number(form.experience) || 0,
    price: Number(form.price) || 0,
    licenseNumber: form.licenseNumber.trim(),
    position: form.position.trim(),
    workplace: selectedClinic?.name || '',
    clinic: selectedClinic ? getClinicRef(selectedClinic) : null,
    bio: form.bio || '',
    education: form.education || '',
    isActive: Boolean(form.isActive),
    ...schedulePayload,
  }
}

function AdminDoctors({ readonly = false }) {
  const { t, i18n } = useTranslation()
  const [searchParams] = useSearchParams()
  const toast = useToast()
  const [doctors, setDoctors] = useState([])
  const [specializations, setSpecializations] = useState([])
  const [clinics, setClinics] = useState([])
  const [scheduleDoctor, setScheduleDoctor] = useState(null)
  const [treatmentDepartments, setTreatmentDepartments] = useState(TREATMENT_DEPARTMENTS)
  const [search, setSearch] = useState('')
  const [specFilter, setSpecFilter] = useState('all')
  const [isLoading, setIsLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editingDoctor, setEditingDoctor] = useState(null)
  const [form, setForm] = useState(defaultForm)
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [removePhoto, setRemovePhoto] = useState(false)
  const [cropModalOpen, setCropModalOpen] = useState(false)
  const [cropImageSrc, setCropImageSrc] = useState(null)
  const [doctorSaveState, setDoctorSaveState] = useState('idle')
  const photoInputRef = useRef(null)
  const assignmentDepartment = treatmentDepartments.find((department) => department.slug === searchParams.get('department'))
  const assignmentCopy = {
    ru: { title: 'Назначение врачей', text: 'Откройте карточку врача и сохраните её — направление уже выбрано.', back: 'Завершить назначение' },
    en: { title: 'Assign doctors', text: 'Open a doctor and save the profile — the department is already selected.', back: 'Finish assigning' },
    kk: { title: 'Дәрігерлерді тағайындау', text: 'Дәрігер карточкасын ашып сақтаңыз — бөлім алдын ала таңдалған.', back: 'Тағайындауды аяқтау' },
  }[['ru', 'en', 'kk'].includes(i18n.language) ? i18n.language : 'ru']

  const createDoctorUser = async () => {
    const payload = {
      username: form.username.trim(),
      email: form.email.trim().toLowerCase(),
      password: form.password,
      confirmed: true,
      blocked: false,
      userRole: 'doctor',
      fullName: form.fullName.trim(),
      phone: form.phone.trim() || null,
    }
    const response = await api.post('/api/users', payload)
    const created = extractCreatedUser(response)
    if (!created?.id) {
      throw new Error('Doctor user was not created')
    }
    return created
  }

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [doctorsRes, specsRes, clinicsRes, globalRes] = await Promise.all([
        doctorsAPI.getAll({ includeInactive: true }),
        specializationsAPI.getAll(),
        clinicsAPI.getAll(),
        contentAPI.getGlobal().catch(() => null),
      ])

      const { data: doctorsData } = normalizeResponse(doctorsRes)
      const { data: specsData } = normalizeResponse(specsRes)
      const { data: clinicsData } = normalizeResponse(clinicsRes)
      const { data: globalData } = normalizeResponse(globalRes) || {}
      const usersRes = await api.get('/api/users?populate[role][fields][0]=id&populate[role][fields][1]=type&populate[role][fields][2]=name&pagination[limit]=1000')
      const usersData = Array.isArray(usersRes.data) ? usersRes.data : []
      const usersMap = new Map(usersData.map((user) => [user.id, user]))

      const normalizedDoctors = (doctorsData || []).map((doctor) => {
        const relationUser = extractUser(doctor.users_permissions_user)
        const linkedByRelation = relationUser?.id ? usersMap.get(relationUser.id) : null
        const linkedByUserId = doctor.userId ? usersMap.get(doctor.userId) : null
        const linkedUser = linkedByRelation || linkedByUserId || relationUser || null
        return {
          ...doctor,
          users_permissions_user: linkedUser,
        }
      })

      setDoctors(normalizedDoctors)
      setSpecializations(specsData || [])
      setClinics(clinicsData || [])
      setTreatmentDepartments(mergeTreatmentDepartments(globalData?.treatmentDepartments))
    } catch (error) {
      console.error('Error loading admin doctors:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const specializationOptions = useMemo(
    () =>
      (specializations || []).map((spec) => ({
        value: String(spec.id),
        label: spec.name,
      })),
    [specializations],
  )

  const workplaceOptions = useMemo(
    () => clinics.map((clinic) => ({
      value: clinic.name,
      label: clinic.name,
    })),
    [clinics],
  )

  const durationOptions = useMemo(
    () => slotDurationOptions.map((duration) => ({
      value: String(duration),
      label: t(`schedule.min_${duration}`),
    })),
    [t],
  )

  const filteredDoctors = useMemo(() => {
    return (doctors || []).filter((doctor) => {
      const matchesSearch =
        !search ||
        doctor.fullName?.toLowerCase().includes(search.toLowerCase()) ||
        doctor.bio?.toLowerCase().includes(search.toLowerCase())

      const doctorSpecId =
        typeof doctor.specialization === 'object' ? String(doctor.specialization?.id) : String(doctor.specialization || '')
      const matchesSpec = specFilter === 'all' || doctorSpecId === specFilter

      return matchesSearch && matchesSpec
    })
  }, [doctors, search, specFilter])

  const openCreateModal = () => {
    const defaultClinic = clinics.find((clinic) => clinic.clinicType === 'nnmc' || clinic.slug === 'nnmc') || clinics[0]
    setEditingDoctor(null)
    setForm({
      ...defaultForm,
      workplace: defaultClinic?.name || '',
      treatmentDepartments: assignmentDepartment ? [assignmentDepartment.slug] : [],
    })
    setPhotoFile(null)
    setPhotoPreview('')
    setRemovePhoto(false)
    setDoctorSaveState('idle')
    setIsModalOpen(true)
  }

  const openEditModal = (doctor) => {
    const linkedUser = extractUser(doctor.users_permissions_user) || null
    setEditingDoctor(doctor)
    setForm({
      username: linkedUser?.username || '',
      email: linkedUser?.email || '',
      phone: linkedUser?.phone || '',
      password: '',
      confirmPassword: '',
      fullName: doctor.fullName || '',
      specialization:
        typeof doctor.specialization === 'object'
          ? String(doctor.specialization?.id || '')
          : String(doctor.specialization || ''),
      treatmentDepartments: assignmentDepartment
        ? [...new Set([...(Array.isArray(doctor.treatmentDepartments) ? doctor.treatmentDepartments : []), assignmentDepartment.slug])]
        : (Array.isArray(doctor.treatmentDepartments) ? doctor.treatmentDepartments : []),
      experience: String(doctor.experience || 0),
      price: String(doctor.price || 0),
      licenseNumber: doctor.licenseNumber || '',
      position: doctor.position || '',
      workplace: resolveDoctorWorkplace(doctor, clinics),
      bio: doctor.bio || '',
      education: doctor.education || '',
      isActive: doctor.isActive !== false,
      slotDuration: String(doctor.slotDuration || 30),
      scheduleConfig: getDoctorScheduleConfig(doctor),
    })
    setPhotoFile(null)
    setPhotoPreview(getMediaUrl(doctor.photo) || '')
    setRemovePhoto(false)
    setDoctorSaveState('idle')
    setIsModalOpen(true)
  }

  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.warning(t('admin_doc.err_image_only'))
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.warning(t('admin_doc.err_size'))
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      setCropImageSrc(reader.result)
      setCropModalOpen(true)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleCroppedPhoto = async (croppedFile) => {
    setPhotoFile(croppedFile)
    setPhotoPreview(URL.createObjectURL(croppedFile))
    setRemovePhoto(false)
  }

  const handleRemovePhoto = () => {
    setPhotoFile(null)
    setPhotoPreview('')
    setRemovePhoto(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()

    if (!form.username.trim()) {
      toast.warning(t('admin_doc.err_login'))
      return
    }

    if (!form.email.trim()) {
      toast.warning(t('admin_doc.err_email'))
      return
    }

    if (!form.fullName.trim()) {
      toast.warning(t('admin_doc.err_name'))
      return
    }

    if (!form.price || Number(form.price) < 0) {
      toast.warning(t('admin_doc.err_price'))
      return
    }

    if (!form.licenseNumber.trim()) {
      toast.warning(t('admin_doc.err_license'))
      return
    }

    if ((!editingDoctor || !(extractUser(editingDoctor.users_permissions_user)?.id)) && !form.password) {
      toast.warning(t('admin_doc.err_password'))
      return
    }

    if (form.password && getPasswordError(form.password)) {
      toast.warning(t(getPasswordError(form.password)))
      return
    }

    if (form.password !== form.confirmPassword) {
      toast.warning(t('admin_doc.err_password_mismatch'))
      return
    }

    const { payload: schedulePayload, errorKey: scheduleErrorKey } = buildSchedulePayload(
      form.scheduleConfig || createRecurringSchedule(),
      form.slotDuration,
    )
    if (scheduleErrorKey) {
      toast.warning(t(scheduleErrorKey))
      return
    }

    setIsSaving(true)
    setDoctorSaveState('idle')
    try {
      const payload = toPayload(form, clinics, schedulePayload)
      if (photoFile) {
        const uploaded = await uploadFile(photoFile)
        payload.photo = uploaded.id
      } else if (removePhoto) {
        payload.photo = null
      }

      if (editingDoctor?.documentId) {
        const linkedUser = extractUser(editingDoctor.users_permissions_user) || null
        let userId = linkedUser?.id || null

        if (userId) {
          const userPayload = {
            username: form.username.trim(),
            email: form.email.trim().toLowerCase(),
            userRole: 'doctor',
            fullName: form.fullName.trim(),
            phone: form.phone.trim() || null,
          }
          if (form.password) {
            userPayload.password = form.password
          }
          await api.put(`/api/users/${userId}`, userPayload)
        } else {
          const createdUser = await createDoctorUser()
          userId = createdUser.id
        }

        const saved = await saveWithScheduleConflictConfirm(
          (data) => doctorsAPI.update(editingDoctor.documentId, data),
          { ...payload, users_permissions_user: userId, userId },
          t,
        )
        if (!saved) return
      } else {
        const createdUser = await createDoctorUser()
        await doctorsAPI.create({
          ...payload,
          users_permissions_user: createdUser.id,
          userId: createdUser.id,
        })
      }

      setDoctorSaveState('saved')
      toast.success(t('common.saved'))
      await new Promise(resolve => setTimeout(resolve, 700))
      setIsModalOpen(false)
      setEditingDoctor(null)
      setForm(defaultForm)
      setPhotoFile(null)
      setPhotoPreview('')
      setRemovePhoto(false)
      await loadData()
    } catch (error) {
      console.error('Error saving doctor:', error)
      const message = error?.response?.data?.error?.message || error?.message || t('admin_doc.err_save')
      toast.error(t('admin_doc.err_save_msg', { message }))
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (doctor) => {
    if (!doctor?.documentId) return

    const confirmed = window.confirm(t('admin_doc.confirm_delete', { name: doctor.fullName }))
    if (!confirmed) return

    try {
      await doctorsAPI.delete(doctor.documentId)
      await loadData()
    } catch (error) {
      console.error('Error deleting doctor:', error)
      toast.error(t('admin_doc.err_delete'))
    }
  }

  if (isLoading) {
    return (
      <div className='flex items-center justify-center py-12'>
        <Loader2 className='w-8 h-8 text-teal-600 animate-spin' />
      </div>
    )
  }

  return (
    <div className='space-y-6 animate-fadeIn'>
      <div className='flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4'>
        <div>
          <h1 className='text-2xl font-bold text-slate-900'>{t('admin_doc.title')}</h1>
          <p className='text-slate-600'>{t('admin_doc.subtitle')}</p>
        </div>
        {!readonly && (
          <Button leftIcon={<Plus className='w-4 h-4' />} onClick={openCreateModal}>
            {t('admin_doc.add_btn')}
          </Button>
        )}
      </div>

      {assignmentDepartment && (
        <div className='flex flex-col gap-3 rounded-2xl border border-teal-200 bg-teal-50 p-4 sm:flex-row sm:items-center sm:justify-between'>
          <div>
            <p className='font-semibold text-teal-900'>{assignmentCopy.title}: {localizeDepartment(assignmentDepartment, i18n.language).displayTitle}</p>
            <p className='mt-1 text-sm text-teal-800'>{assignmentCopy.text}</p>
          </div>
          <Link to='/admin/treatment-departments' className='text-sm font-semibold text-teal-800 underline underline-offset-4'>{assignmentCopy.back}</Link>
        </div>
      )}

      <div className='grid md:grid-cols-2 gap-4'>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('admin_doc.search_placeholder')}
          leftIcon={<Search className='w-4 h-4' />}
        />
        <Select
          value={specFilter}
          onChange={(e) => setSpecFilter(e.target.value)}
          options={[
            { value: 'all', label: t('admin_doc.filter_all') },
            ...specializationOptions,
          ]}
          placeholder={t('admin_doc.filter_placeholder')}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('admin_doc.list_title', { count: filteredDoctors.length })}</CardTitle>
        </CardHeader>
        <CardContent className='p-0'>
          <div className='overflow-x-auto'>
            <table className='w-full'>
              <thead>
                <tr className='border-b border-slate-200'>
                  <th className='text-left py-4 px-6 font-medium text-slate-500'>{t('admin_doc.col_name')}</th>
                  <th className='text-left py-4 px-6 font-medium text-slate-500'>{t('admin_doc.col_spec')}</th>
                  <th className='text-left py-4 px-6 font-medium text-slate-500'>{t('admin_doc.col_license')}</th>
                  <th className='text-left py-4 px-6 font-medium text-slate-500'>{t('admin_doc.col_exp')}</th>
                  <th className='text-left py-4 px-6 font-medium text-slate-500'>{t('admin_doc.col_price')}</th>
                  <th className='text-left py-4 px-6 font-medium text-slate-500'>{t('admin_doc.col_status')}</th>
                  <th className='text-right py-4 px-6 font-medium text-slate-500'>{t('admin_doc.col_actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredDoctors.length === 0 ? (
                  <tr>
                    <td colSpan={7} className='text-center py-10 text-slate-500'>
                      {t('admin_doc.not_found')}
                    </td>
                  </tr>
                ) : (
                  filteredDoctors.map((doctor) => (
                    <tr key={doctor.documentId || doctor.id} className='border-b border-slate-100 hover:bg-slate-50'>
                      <td className='py-4 px-6 font-medium text-slate-900'>{doctor.fullName}</td>
                      <td className='py-4 px-6 text-slate-600'>
                        {typeof doctor.specialization === 'object'
                          ? doctor.specialization?.name || t('admin_doc.no_spec')
                          : doctor.specialization || t('admin_doc.no_spec')}
                      </td>
                      <td className='py-4 px-6 text-slate-600'>{doctor.licenseNumber || '—'}</td>
                      <td className='py-4 px-6 text-slate-600'>
                        {t('admin_doc.exp_years', { count: doctor.experience || 0 })}
                      </td>
                      <td className='py-4 px-6 text-slate-600'>
                        {(doctor.price || 0).toLocaleString('ru-RU')} ₸
                      </td>
                      <td className='py-4 px-6'>
                        <Badge variant={doctor.isActive === false ? 'danger' : 'success'}>
                          {doctor.isActive === false ? t('admin_doc.inactive') : t('admin_doc.active')}
                        </Badge>
                      </td>
                      <td className='py-4 px-6'>
                        <div className='flex justify-end gap-2'>
                          <Button
                            size='icon'
                            variant='secondary'
                            onClick={() => setScheduleDoctor(doctor)}
                            aria-label={t('admin_doc.schedule_title')}
                            title={t('admin_doc.schedule_title')}
                          >
                            <CalendarClock className='w-4 h-4' />
                          </Button>
                          {!readonly && (
                            <>
                              <Button
                                size='icon'
                                variant='secondary'
                                onClick={() => openEditModal(doctor)}
                                aria-label={t('admin_doc.edit_aria')}
                              >
                                <Pencil className='w-4 h-4' />
                              </Button>
                              <Button
                                size='icon'
                                variant='secondary'
                                onClick={() => handleDelete(doctor)}
                                aria-label={t('admin_doc.delete_aria')}
                              >
                                <Trash2 className='w-4 h-4 text-rose-600' />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingDoctor ? t('admin_doc.modal_title_edit') : t('admin_doc.modal_title_add')}
        size='xl'
        footer={
          <>
            <Button variant='secondary' onClick={() => setIsModalOpen(false)} disabled={isSaving}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleSave}
              isLoading={isSaving}
              variant={doctorSaveState === 'saved' ? 'success' : 'primary'}
              leftIcon={doctorSaveState === 'saved' ? <Check className='w-4 h-4' /> : null}
            >
              {doctorSaveState === 'saved' ? t('common.saved') : editingDoctor ? t('admin_doc.save') : t('admin_doc.create')}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSave} className='space-y-4'>
          <div className='grid md:grid-cols-3 gap-4'>
            <Input
              label={t('admin_doc.label_login')}
              required
              value={form.username}
              onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
              placeholder={t('admin_doc.placeholder_login')}
            />
            <Input
              label='Email'
              type='email'
              required
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              placeholder='doctor@example.com'
            />
            <Input
              label={t('admin_doc.label_phone')}
              type='tel'
              value={form.phone}
              onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
              placeholder='+7 700 000 0000'
              autoComplete='tel'
            />
          </div>

          <div className='grid md:grid-cols-2 gap-4'>
            <Input
              label={editingDoctor ? t('admin_doc.label_password_new') : t('admin_doc.label_password')}
              type='password'
              required={!editingDoctor}
              value={form.password}
              onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
              placeholder={editingDoctor ? t('admin_doc.placeholder_password_new') : t('admin_doc.placeholder_password')}
              hint={editingDoctor ? t('admin_doc.hint_password') : undefined}
            />
            <Input
              label={editingDoctor ? t('admin_doc.label_confirm_new') : t('admin_doc.label_confirm')}
              type='password'
              required={!editingDoctor}
              value={form.confirmPassword}
              onChange={(e) => setForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
              placeholder={t('admin_doc.placeholder_confirm')}
            />
          </div>

          {/* flex-wrap: on a 320 px phone the buttons move under the photo
              instead of pushing out of the dialog. */}
          <div className='flex flex-wrap items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200'>
            <input ref={photoInputRef} type='file' accept='image/*' className='hidden' onChange={handlePhotoSelect} />
            <button
              type='button'
              onClick={() => photoInputRef.current?.click()}
              className='group relative h-20 w-20 shrink-0 overflow-hidden rounded-full bg-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2'
              aria-label={t('admin_doc.upload_photo')}
            >
              {photoPreview ? (
                <img src={photoPreview} alt={t('admin_doc.photo_alt')} className='w-full h-full object-cover' />
              ) : (
                <Camera className='w-8 h-8 text-slate-500' />
              )}
              <span className='absolute inset-0 flex items-center justify-center bg-slate-900/50 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus:opacity-100'>
                <Pencil className='h-5 w-5' />
              </span>
            </button>
            <div className='flex flex-wrap gap-2'>
              <Button type='button' variant='secondary' onClick={() => photoInputRef.current?.click()} leftIcon={<Camera className='w-4 h-4' />}>
                {t('admin_doc.upload_photo')}
              </Button>
              {photoPreview && (
                <Button type='button' variant='secondary' onClick={handleRemovePhoto} leftIcon={<X className='w-4 h-4' />}>
                  {t('admin_doc.remove_photo')}
                </Button>
              )}
            </div>
          </div>

          <div className='grid md:grid-cols-2 gap-4'>
            <Input
              label={t('admin_doc.label_name')}
              required
              value={form.fullName}
              onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
              placeholder={t('admin_doc.placeholder_name')}
            />
            <Select
              label={t('admin_doc.label_spec')}
              value={form.specialization}
              onChange={(e) => setForm((prev) => ({ ...prev, specialization: e.target.value }))}
              options={specializationOptions}
              placeholder={t('admin_doc.placeholder_spec')}
            />
          </div>

          <div className='rounded-xl border border-slate-200 p-4'>
            <div>
              <p className='text-sm font-medium text-slate-700'>{t('admin_doc.label_treatment_departments')}</p>
              <p className='mt-1 text-xs text-slate-500'>{t('admin_doc.hint_treatment_departments')}</p>
            </div>
            <div className='mt-4 grid gap-2 sm:grid-cols-2'>
              {treatmentDepartments.map((department) => {
                const localized = localizeDepartment(department, i18n.language)
                const checked = form.treatmentDepartments.includes(department.slug)
                return (
                  <label key={department.slug} className='flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50'>
                    <input
                      type='checkbox'
                      checked={checked}
                      onChange={() => setForm((prev) => ({
                        ...prev,
                        treatmentDepartments: checked
                          ? prev.treatmentDepartments.filter((slug) => slug !== department.slug)
                          : [...prev.treatmentDepartments, department.slug],
                      }))}
                      className='h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500'
                    />
                    <span className='text-sm font-medium text-slate-700'>{localized.displayTitle}</span>
                  </label>
                )
              })}
            </div>
          </div>

          <div className='grid md:grid-cols-3 gap-4'>
            <Input
              label={t('admin_doc.label_license')}
              required
              value={form.licenseNumber}
              onChange={(e) => setForm((prev) => ({ ...prev, licenseNumber: e.target.value }))}
              placeholder={t('admin_doc.placeholder_license')}
            />
            <Input
              label={t('admin_doc.label_position')}
              value={form.position}
              onChange={(e) => setForm((prev) => ({ ...prev, position: e.target.value }))}
              placeholder={t('admin_doc.placeholder_position')}
            />
            <Select
              label={t('admin_doc.label_workplace')}
              value={form.workplace}
              onChange={(e) => setForm((prev) => ({ ...prev, workplace: e.target.value }))}
              options={workplaceOptions}
            />
          </div>

          <div className='grid md:grid-cols-3 gap-4'>
            <Input
              label={t('admin_doc.label_exp')}
              type='number'
              min='0'
              value={form.experience}
              onChange={(e) => setForm((prev) => ({ ...prev, experience: e.target.value }))}
            />
            <Input
              label={t('admin_doc.label_price')}
              type='number'
              min='0'
              required
              value={form.price}
              onChange={(e) => setForm((prev) => ({ ...prev, price: e.target.value }))}
            />
            <Select
              label={t('admin_doc.label_duration')}
              value={form.slotDuration}
              onChange={(e) => setForm((prev) => ({ ...prev, slotDuration: e.target.value }))}
              options={durationOptions}
            />
          </div>

          <AdminScheduleBuilder
            value={form.scheduleConfig || createRecurringSchedule()}
            onChange={(scheduleConfig) => setForm((prev) => ({ ...prev, scheduleConfig }))}
          />

          <Textarea
            label={t('admin_doc.label_education')}
            rows={3}
            value={form.education}
            onChange={(e) => setForm((prev) => ({ ...prev, education: e.target.value }))}
            placeholder={t('admin_doc.placeholder_education')}
          />

          <Textarea
            label={t('admin_doc.label_bio')}
            rows={4}
            value={form.bio}
            onChange={(e) => setForm((prev) => ({ ...prev, bio: e.target.value }))}
            placeholder={t('admin_doc.placeholder_bio')}
          />

          <label className='flex items-center gap-2 text-sm text-slate-700'>
            <input
              type='checkbox'
              checked={form.isActive}
              onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
              className='rounded border-slate-300 text-teal-600 focus:ring-teal-500'
            />
            {t('admin_doc.label_active')}
          </label>
        </form>
      </Modal>

      <ImageCropModal
        isOpen={cropModalOpen}
        onClose={() => setCropModalOpen(false)}
        imageSrc={cropImageSrc}
        onCropComplete={handleCroppedPhoto}
        aspect={1}
      />

      <DoctorScheduleModal
        doctor={scheduleDoctor}
        isOpen={Boolean(scheduleDoctor)}
        onClose={() => setScheduleDoctor(null)}
        onSaved={loadData}
      />
    </div>
  )
}

export default AdminDoctors
