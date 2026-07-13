import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { AlertTriangle, Check, ImagePlus, Loader2, Plus, RotateCcw, Save, Trash2, Users } from 'lucide-react'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Textarea from '../../components/ui/Textarea'
import { useToast } from '../../components/ui/Toast'
import { contentAPI, deleteFile, doctorsAPI, getMediaUrl, normalizeResponse, uploadFile } from '../../services/api'
import {
  createDefaultTreatmentDepartmentsForCms,
  doctorBelongsToTreatmentDepartment,
} from '../../data/treatmentDepartments'
import { cn } from '../../utils/helpers'

const locales = [
  { code: 'ru', label: 'RU' },
  { code: 'en', label: 'EN' },
  { code: 'kk', label: 'KK' },
]

const copyByLanguage = {
  ru: {
    title: 'Отделения и лечение', subtitle: 'Редактирование публичных страниц направлений лечения', save: 'Сохранить изменения', saved: 'Сохранено',
    content: 'Контент страницы', settings: 'Настройки отделения', photo: 'Hero-фотография', upload: 'Загрузить новое фото', uploading: 'Загрузка…', uploaded: 'Фото загружено. Сохраните изменения.',
    titleField: 'Название отделения', short: 'Краткое описание для карточки и hero', summary: 'Полное описание отделения',
    services: 'Услуги и операции', conditions: 'Заболевания', technology: 'Технологии и оборудование', journey: 'Этапы лечения', benefits: 'Преимущества для иностранных пациентов',
    linesHint: 'Каждый пункт — с новой строки', programs: 'Приоритетные программы', addProgram: 'Добавить программу', programName: 'Название программы',
    programText: 'Описание', duration: 'Длительность', stay: 'Госпитализация', remove: 'Удалить программу',
    slug: 'Системный slug', icon: 'Иконка', accent: 'Цветовой акцент', order: 'Порядок', active: 'Показывать отделение на сайте',
    matches: 'Специализации врачей для автоматического подбора', matchesHint: 'Каждая специализация — с новой строки. Явные привязки врача имеют приоритет.',
    loadError: 'Не удалось загрузить данные отделений', saveError: 'Не удалось сохранить данные отделений', uploadError: 'Не удалось загрузить изображение', noDepartment: 'Отделение не выбрано', unsaved: 'Есть несохранённые изменения',
    discard: 'Отменить изменения', discardConfirm: 'Отменить все несохранённые изменения?', leaveConfirm: 'Есть несохранённые изменения. Покинуть страницу?',
    invalidContent: 'Заполните название, краткое и полное описание, услуги и программы на всех языках.', invalidSettings: 'Проверьте иконку, цвет и уникальный порядок отделений.',
    doctorsAssigned: 'врачей в направлении', noDoctors: 'Врачи не назначены', assignDoctors: 'Назначить врачей', cleanupWarning: 'Контент сохранён, но старое изображение не удалось удалить.', imageHint: 'JPEG, PNG или WebP, до 10 МБ.',
  },
  en: {
    title: 'Treatment departments', subtitle: 'Edit public treatment department pages', save: 'Save changes', saved: 'Saved',
    content: 'Page content', settings: 'Department settings', photo: 'Hero image', upload: 'Upload new image', uploading: 'Uploading…', uploaded: 'Image uploaded. Save your changes.',
    titleField: 'Department name', short: 'Short card and hero description', summary: 'Full department description',
    services: 'Services and procedures', conditions: 'Conditions', technology: 'Technology and equipment', journey: 'Treatment journey', benefits: 'International patient benefits',
    linesHint: 'One item per line', programs: 'Priority programs', addProgram: 'Add program', programName: 'Program name',
    programText: 'Description', duration: 'Duration', stay: 'Hospital stay', remove: 'Remove program',
    slug: 'System slug', icon: 'Icon', accent: 'Color accent', order: 'Order', active: 'Show department on the website',
    matches: 'Doctor specializations for automatic matching', matchesHint: 'One specialization per line. Explicit doctor assignments take priority.',
    loadError: 'Failed to load department data', saveError: 'Failed to save department data', uploadError: 'Failed to upload image', noDepartment: 'No department selected', unsaved: 'Unsaved changes',
    discard: 'Discard changes', discardConfirm: 'Discard all unsaved changes?', leaveConfirm: 'You have unsaved changes. Leave this page?',
    invalidContent: 'Complete the name, short and full descriptions, services and programs in every language.', invalidSettings: 'Check the icon, color and unique department order.',
    doctorsAssigned: 'doctors in department', noDoctors: 'No doctors assigned', assignDoctors: 'Assign doctors', cleanupWarning: 'Content was saved, but the previous image could not be deleted.', imageHint: 'JPEG, PNG or WebP, up to 10 MB.',
  },
  kk: {
    title: 'Емдеу бөлімдері', subtitle: 'Емдеу бағыттарының ашық беттерін өңдеу', save: 'Өзгерістерді сақтау', saved: 'Сақталды',
    content: 'Бет мазмұны', settings: 'Бөлім параметрлері', photo: 'Hero суреті', upload: 'Жаңа сурет жүктеу', uploading: 'Жүктелуде…', uploaded: 'Сурет жүктелді. Өзгерістерді сақтаңыз.',
    titleField: 'Бөлім атауы', short: 'Карточка мен hero үшін қысқаша сипаттама', summary: 'Бөлімнің толық сипаттамасы',
    services: 'Қызметтер мен операциялар', conditions: 'Аурулар', technology: 'Технологиялар мен жабдықтар', journey: 'Емдеу кезеңдері', benefits: 'Шетелдік пациенттерге артықшылықтар',
    linesHint: 'Әр тармақ жаңа жолдан', programs: 'Басым бағдарламалар', addProgram: 'Бағдарлама қосу', programName: 'Бағдарлама атауы',
    programText: 'Сипаттама', duration: 'Ұзақтығы', stay: 'Стационарда', remove: 'Бағдарламаны жою',
    slug: 'Жүйелік slug', icon: 'Белгіше', accent: 'Түс акценті', order: 'Реті', active: 'Бөлімді сайтта көрсету',
    matches: 'Дәрігерлерді автоматты таңдау мамандықтары', matchesHint: 'Әр мамандық жаңа жолдан. Дәрігердің тікелей байланысы басым.',
    loadError: 'Бөлім деректерін жүктеу мүмкін болмады', saveError: 'Бөлім деректерін сақтау мүмкін болмады', uploadError: 'Суретті жүктеу мүмкін болмады', noDepartment: 'Бөлім таңдалмаған', unsaved: 'Сақталмаған өзгерістер бар',
    discard: 'Өзгерістерден бас тарту', discardConfirm: 'Барлық сақталмаған өзгерістерден бас тарту керек пе?', leaveConfirm: 'Сақталмаған өзгерістер бар. Беттен шығу керек пе?',
    invalidContent: 'Барлық тілде атауды, қысқаша және толық сипаттаманы, қызметтер мен бағдарламаларды толтырыңыз.', invalidSettings: 'Белгішені, түсті және бөлімдердің бірегей ретін тексеріңіз.',
    doctorsAssigned: 'бағыттағы дәрігер', noDoctors: 'Дәрігерлер тағайындалмаған', assignDoctors: 'Дәрігер тағайындау', cleanupWarning: 'Мазмұн сақталды, бірақ алдыңғы суретті жою мүмкін болмады.', imageHint: 'JPEG, PNG немесе WebP, 10 МБ-қа дейін.',
  },
}

const linesToArray = (value) => value.split('\n').map((item) => item.trim()).filter(Boolean)
const arrayToLines = (value) => Array.isArray(value) ? value.join('\n') : ''
const validIcons = new Set(['Activity', 'Brain', 'Heart', 'HeartPulse', 'ScanLine', 'Stethoscope', 'Syringe', 'Venus'])
const validAccents = new Set(['teal', 'sky', 'violet', 'amber', 'rose', 'indigo', 'pink', 'red'])
const imageTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
const maxHeroBytes = 10 * 1024 * 1024

const cloneDepartments = (departments) => JSON.parse(JSON.stringify(departments))
const getMediaId = (media) => media && typeof media === 'object' ? Number(media.id) || null : null
const normalizeLegacyHeroImage = (media) => {
  if (media && typeof media === 'object') return { ...media, url: normalizeLegacyHeroImage(media.url) }
  if (typeof media !== 'string' || !media.startsWith('http')) return media
  try {
    const url = new URL(media)
    return url.pathname.startsWith('/uploads/') || url.pathname.startsWith('/api/file-proxy/')
      ? `${url.pathname}${url.search}`
      : media
  } catch {
    return media
  }
}
const toStoredMedia = (media) => ({
  id: media.id,
  url: normalizeLegacyHeroImage(media.url),
  name: media.name || '',
  alternativeText: media.alternativeText || '',
})
const resolveHeroPreview = (media) => typeof media === 'string' && media.startsWith('/treatments/')
  ? media
  : getMediaUrl(media)
const isValidHeroMedia = (media) => {
  const url = typeof media === 'string' ? media : media?.url
  return typeof url === 'string' && (
    url.startsWith('/treatments/') || url.startsWith('/uploads/') || url.startsWith('/api/file-proxy/')
  )
}

const isValidDepartmentContent = (department) => ['ru', 'en', 'kk'].every((locale) => {
  const content = department.content?.[locale]
  const requiredLists = ['services', 'conditions', 'technology', 'journey', 'benefits']
  return Boolean(
    content?.title?.trim()
    && content?.short?.trim()
    && content?.summary?.trim()
    && requiredLists.every((field) => Array.isArray(content?.[field]) && content[field].length > 0)
    && Array.isArray(content?.programs) && content.programs.length > 0
    && content.programs.every((program) => program?.name?.trim() && program?.text?.trim()),
  )
})

function LinesTextarea({ value, onCommit, onDirty, ...props }) {
  const [draft, setDraft] = useState(() => arrayToLines(value))
  return (
    <Textarea
      {...props}
      value={draft}
      onChange={(event) => {
        setDraft(event.target.value)
        onDirty?.()
      }}
      onBlur={() => onCommit(linesToArray(draft))}
    />
  )
}

const mergeStoredWithDefaults = (stored, defaults) => defaults.map((fallback) => {
  const incoming = Array.isArray(stored) ? stored.find((item) => item?.slug === fallback.slug) : null
  if (!incoming) return fallback
  return {
    ...fallback,
    ...incoming,
    heroImage: normalizeLegacyHeroImage(incoming.heroImage || fallback.heroImage),
    specialtyMatches: Array.isArray(incoming.specialtyMatches) ? incoming.specialtyMatches : fallback.specialtyMatches,
    content: {
      ...fallback.content,
      ...(incoming.content || {}),
      ru: { ...fallback.content.ru, ...(incoming.content?.ru || {}) },
      en: { ...fallback.content.en, ...(incoming.content?.en || {}) },
      kk: { ...fallback.content.kk, ...(incoming.content?.kk || {}) },
    },
  }
})

export default function AdminTreatmentDepartments() {
  const { i18n } = useTranslation()
  const toast = useToast()
  const language = ['ru', 'en', 'kk'].includes(i18n.language) ? i18n.language : 'ru'
  const copy = copyByLanguage[language]
  const defaults = useMemo(() => createDefaultTreatmentDepartmentsForCms(), [])
  const [departments, setDepartments] = useState(defaults)
  const [savedDepartments, setSavedDepartments] = useState(defaults)
  const [doctors, setDoctors] = useState([])
  const [activeSlug, setActiveSlug] = useState(defaults[0]?.slug || '')
  const [activeLocale, setActiveLocale] = useState('ru')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [resetVersion, setResetVersion] = useState(0)
  const pendingUploadIds = useRef(new Set())
  const pendingPreviewUrls = useRef(new Map())
  const [, setPreviewVersion] = useState(0)

  useEffect(() => () => {
    for (const id of pendingUploadIds.current) {
      deleteFile(id).catch((error) => console.warn('Could not clean up an unsaved hero image:', error))
    }
    for (const url of pendingPreviewUrls.current.values()) URL.revokeObjectURL(url)
  }, [])

  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (!isDirty) return
      event.preventDefault()
      event.returnValue = ''
    }
    const handleNavigationClick = (event) => {
      if (!isDirty || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const link = event.target.closest?.('a[href]')
      if (!link) return
      const target = new URL(link.href, window.location.href)
      const current = new URL(window.location.href)
      if (target.origin !== current.origin || (target.pathname === current.pathname && target.search === current.search && target.hash === current.hash)) return
      if (!window.confirm(copy.leaveConfirm)) {
        event.preventDefault()
        event.stopPropagation()
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('click', handleNavigationClick, true)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('click', handleNavigationClick, true)
    }
  }, [copy.leaveConfirm, isDirty])

  useEffect(() => {
    let active = true
    Promise.all([contentAPI.getGlobal(), doctorsAPI.getAll({ includeInactive: true })])
      .then(([globalResponse, doctorsResponse]) => {
        const { data } = normalizeResponse(globalResponse)
        const { data: doctorData } = normalizeResponse(doctorsResponse)
        if (!active) return
        const merged = mergeStoredWithDefaults(data?.treatmentDepartments, defaults)
        setDepartments(merged)
        setSavedDepartments(cloneDepartments(merged))
        setDoctors(doctorData || [])
        setActiveSlug((current) => current || merged[0]?.slug || '')
      })
      .catch((error) => {
        console.error('Error loading treatment departments:', error)
        toast.error(copy.loadError)
      })
      .finally(() => { if (active) setIsLoading(false) })
    return () => { active = false }
  }, [copy.loadError, defaults, toast])

  const activeDepartment = departments.find((department) => department.slug === activeSlug)
  const activeContent = activeDepartment?.content?.[activeLocale] || {}
  const activeDoctorCount = activeDepartment
    ? doctors.filter((doctor) => doctorBelongsToTreatmentDepartment(doctor, activeDepartment)).length
    : 0

  const updateDepartment = (patch) => {
    setDepartments((items) => items.map((item) => item.slug === activeSlug ? { ...item, ...patch } : item))
    setIsDirty(true)
  }

  const updateContent = (patch) => {
    if (!activeDepartment) return
    updateDepartment({
      content: {
        ...activeDepartment.content,
        [activeLocale]: { ...activeContent, ...patch },
      },
    })
  }

  const updateProgram = (index, patch) => {
    const programs = [...(activeContent.programs || [])]
    programs[index] = { ...programs[index], ...patch }
    updateContent({ programs })
  }

  const addProgram = () => updateContent({
    programs: [...(activeContent.programs || []), { name: '', text: '', duration: '', stay: '' }],
  })

  const removeProgram = (index) => updateContent({
    programs: (activeContent.programs || []).filter((_, programIndex) => programIndex !== index),
  })

  const handleUpload = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!imageTypes.has(file.type) || file.size > maxHeroBytes) {
      toast.warning(copy.uploadError)
      return
    }
    setIsUploading(true)
    try {
      const uploaded = await uploadFile(file)
      const currentMediaId = getMediaId(activeDepartment.heroImage)
      if (currentMediaId && pendingUploadIds.current.has(currentMediaId)) {
        await deleteFile(currentMediaId).catch((error) => console.warn('Could not clean up superseded hero image:', error))
        pendingUploadIds.current.delete(currentMediaId)
      }
      pendingUploadIds.current.add(Number(uploaded.id))
      const previousPreview = pendingPreviewUrls.current.get(activeSlug)
      if (previousPreview) URL.revokeObjectURL(previousPreview)
      pendingPreviewUrls.current.set(activeSlug, URL.createObjectURL(file))
      setPreviewVersion((version) => version + 1)
      updateDepartment({ heroImage: toStoredMedia(uploaded) })
      toast.success(copy.uploaded)
    } catch (error) {
      console.error('Error uploading department image:', error)
      toast.error(copy.uploadError)
    } finally {
      setIsUploading(false)
    }
  }

  const handleSave = async () => {
    const sortOrders = departments.map((department) => Number(department.sortOrder))
    const validSettings = departments.every((department) => (
      validIcons.has(department.icon)
      && validAccents.has(department.accent)
      && isValidHeroMedia(department.heroImage)
      && Number.isInteger(Number(department.sortOrder))
      && Number(department.sortOrder) > 0
    )) && new Set(sortOrders).size === sortOrders.length

    if (!validSettings) {
      toast.warning(copy.invalidSettings)
      return
    }
    if (!departments.every(isValidDepartmentContent)) {
      toast.warning(copy.invalidContent)
      return
    }

    setIsSaving(true)
    try {
      await contentAPI.updateGlobal({ treatmentDepartments: departments })
      const currentMediaIds = new Set(departments.map((department) => getMediaId(department.heroImage)).filter(Boolean))
      const replacedMediaIds = savedDepartments
        .map((department) => getMediaId(department.heroImage))
        .filter((id) => id && !currentMediaIds.has(id))
      const cleanupResults = await Promise.allSettled(replacedMediaIds.map((id) => deleteFile(id)))
      if (cleanupResults.some((result) => result.status === 'rejected')) toast.warning(copy.cleanupWarning)

      pendingUploadIds.current.clear()
      for (const url of pendingPreviewUrls.current.values()) URL.revokeObjectURL(url)
      pendingPreviewUrls.current.clear()
      setPreviewVersion((version) => version + 1)
      setSavedDepartments(cloneDepartments(departments))
      setIsDirty(false)
      toast.success(copy.saved)
    } catch (error) {
      console.error('Error saving treatment departments:', error)
      toast.error(copy.saveError)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDiscard = async () => {
    if (!window.confirm(copy.discardConfirm)) return
    const uploadsToDelete = [...pendingUploadIds.current]
    await Promise.allSettled(uploadsToDelete.map((id) => deleteFile(id)))
    pendingUploadIds.current.clear()
    for (const url of pendingPreviewUrls.current.values()) URL.revokeObjectURL(url)
    pendingPreviewUrls.current.clear()
    setPreviewVersion((version) => version + 1)
    setDepartments(cloneDepartments(savedDepartments))
    setResetVersion((version) => version + 1)
    setIsDirty(false)
  }

  if (isLoading) return <div className='flex justify-center py-20'><Loader2 className='h-8 w-8 animate-spin text-teal-600' /></div>
  if (!activeDepartment) return <div className='py-16 text-center text-slate-500'>{copy.noDepartment}</div>

  return (
    <div className='space-y-6 pb-16'>
      <div className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
        <div>
          <h1 className='text-2xl font-bold text-slate-950'>{copy.title}</h1>
          <p className='mt-1 text-slate-600'>{copy.subtitle}</p>
          {isDirty && <p className='mt-2 text-sm font-medium text-amber-600'>{copy.unsaved}</p>}
        </div>
        <div className='flex flex-wrap gap-2'>
          {isDirty && (
            <Button type='button' variant='secondary' onClick={handleDiscard} disabled={isSaving || isUploading} leftIcon={<RotateCcw className='h-4 w-4' />}>
              {copy.discard}
            </Button>
          )}
          <Button onClick={handleSave} isLoading={isSaving} disabled={!isDirty || isUploading} leftIcon={<Save className='h-4 w-4' />}>{copy.save}</Button>
        </div>
      </div>

      <div className='grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]'>
        <aside className='space-y-2 xl:sticky xl:top-24 xl:self-start'>
          {departments.map((department) => (
            <button
              key={department.slug}
              type='button'
              onClick={() => setActiveSlug(department.slug)}
              className={cn(
                'w-full rounded-2xl border p-4 text-left transition-colors',
                department.slug === activeSlug ? 'border-teal-300 bg-teal-50' : 'border-slate-200 bg-white hover:border-slate-300',
              )}
            >
              <div className='flex items-center justify-between gap-3'>
                <span className='font-semibold text-slate-900'>{department.content?.[language]?.title || department.content?.ru?.title}</span>
                {department.isActive !== false && <Check className='h-4 w-4 text-teal-600' />}
              </div>
              <div className='mt-1 flex items-center justify-between gap-2 text-xs'>
                <span className='text-slate-500'>{department.slug}</span>
                <span className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium',
                  doctors.some((doctor) => doctorBelongsToTreatmentDepartment(doctor, department))
                    ? 'bg-teal-50 text-teal-700'
                    : 'bg-amber-50 text-amber-700',
                )}>
                  <Users className='h-3 w-3' />
                  {doctors.filter((doctor) => doctorBelongsToTreatmentDepartment(doctor, department)).length}
                </span>
              </div>
            </button>
          ))}
        </aside>

        <div className='space-y-6'>
          <section className='rounded-3xl border border-slate-200 bg-white p-5 sm:p-7'>
            <h2 className='text-lg font-bold text-slate-900'>{copy.photo}</h2>
            <div className='mt-5 grid gap-5 lg:grid-cols-[280px_1fr] lg:items-center'>
              <div className='aspect-video overflow-hidden rounded-2xl bg-slate-100'>
                <img src={pendingPreviewUrls.current.get(activeSlug) || resolveHeroPreview(activeDepartment.heroImage)} alt='' className='h-full w-full object-cover' />
              </div>
              <div>
                <label className='inline-flex cursor-pointer'>
                  <input type='file' accept='image/*' className='hidden' onChange={handleUpload} disabled={isUploading} />
                  <span className='inline-flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-200'>
                    {isUploading ? <Loader2 className='h-4 w-4 animate-spin' /> : <ImagePlus className='h-4 w-4' />}
                    {isUploading ? copy.uploading : copy.upload}
                  </span>
                </label>
                <p className='mt-2 text-xs text-slate-500'>{copy.imageHint}</p>
              </div>
            </div>
          </section>

          <section className={cn(
            'rounded-3xl border p-5 sm:p-6',
            activeDoctorCount > 0 ? 'border-teal-200 bg-teal-50' : 'border-amber-200 bg-amber-50',
          )}>
            <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
              <div className='flex items-start gap-3'>
                {activeDoctorCount > 0
                  ? <Users className='mt-0.5 h-5 w-5 text-teal-700' />
                  : <AlertTriangle className='mt-0.5 h-5 w-5 text-amber-700' />}
                <div>
                  <p className='font-semibold text-slate-900'>
                    {activeDoctorCount > 0 ? `${activeDoctorCount} ${copy.doctorsAssigned}` : copy.noDoctors}
                  </p>
                  <p className='mt-1 text-sm text-slate-600'>{copy.matchesHint}</p>
                </div>
              </div>
              <Link to={`/admin/doctors?department=${activeSlug}`} className='inline-flex flex-none items-center justify-center rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-teal-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50'>
                {copy.assignDoctors}
              </Link>
            </div>
          </section>

          <section className='rounded-3xl border border-slate-200 bg-white p-5 sm:p-7'>
            <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
              <h2 className='text-lg font-bold text-slate-900'>{copy.content}</h2>
              <div className='inline-flex rounded-xl bg-slate-100 p-1 self-start'>
                {locales.map((locale) => <button key={locale.code} type='button' onClick={() => setActiveLocale(locale.code)} className={cn('rounded-lg px-4 py-2 text-sm font-semibold', activeLocale === locale.code ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500')}>{locale.label}</button>)}
              </div>
            </div>

            <div className='mt-6 space-y-5'>
              <Input label={copy.titleField} value={activeContent.title || ''} onChange={(e) => updateContent({ title: e.target.value })} />
              <Textarea label={copy.short} rows={2} value={activeContent.short || ''} onChange={(e) => updateContent({ short: e.target.value })} />
              <Textarea label={copy.summary} rows={5} value={activeContent.summary || ''} onChange={(e) => updateContent({ summary: e.target.value })} />

              <div className='grid gap-5 lg:grid-cols-2'>
                {[
                  ['services', copy.services], ['conditions', copy.conditions], ['technology', copy.technology],
                  ['journey', copy.journey], ['benefits', copy.benefits],
                ].map(([field, label]) => (
                  <LinesTextarea key={`${activeSlug}-${activeLocale}-${field}-${resetVersion}`} label={label} hint={copy.linesHint} rows={6} value={activeContent[field]} onDirty={() => setIsDirty(true)} onCommit={(items) => updateContent({ [field]: items })} />
                ))}
              </div>
            </div>
          </section>

          <section className='rounded-3xl border border-slate-200 bg-white p-5 sm:p-7'>
            <div className='flex items-center justify-between gap-4'>
              <h2 className='text-lg font-bold text-slate-900'>{copy.programs}</h2>
              <Button type='button' variant='secondary' size='sm' onClick={addProgram} leftIcon={<Plus className='h-4 w-4' />}>{copy.addProgram}</Button>
            </div>
            <div className='mt-6 space-y-4'>
              {(activeContent.programs || []).map((program, index) => (
                <div key={`${activeLocale}-${index}`} className='rounded-2xl border border-slate-200 bg-slate-50 p-5'>
                  <div className='flex items-center justify-between gap-4'>
                    <span className='font-bold text-teal-700'>{String(index + 1).padStart(2, '0')}</span>
                    <button type='button' onClick={() => removeProgram(index)} className='rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600' aria-label={copy.remove}><Trash2 className='h-4 w-4' /></button>
                  </div>
                  <div className='mt-4 space-y-4'>
                    <Input label={copy.programName} value={program.name || ''} onChange={(e) => updateProgram(index, { name: e.target.value })} />
                    <Textarea label={copy.programText} rows={3} value={program.text || ''} onChange={(e) => updateProgram(index, { text: e.target.value })} />
                    <div className='grid gap-4 sm:grid-cols-2'>
                      <Input label={copy.duration} value={program.duration || ''} onChange={(e) => updateProgram(index, { duration: e.target.value })} />
                      <Input label={copy.stay} value={program.stay || ''} onChange={(e) => updateProgram(index, { stay: e.target.value })} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className='rounded-3xl border border-slate-200 bg-white p-5 sm:p-7'>
            <h2 className='text-lg font-bold text-slate-900'>{copy.settings}</h2>
            <div className='mt-6 grid gap-5 sm:grid-cols-2'>
              <Input label={copy.slug} value={activeDepartment.slug} disabled />
              <Input label={copy.order} type='number' min='1' value={activeDepartment.sortOrder || 1} onChange={(e) => updateDepartment({ sortOrder: Number(e.target.value) || 1 })} />
              <Select
                label={copy.icon}
                value={activeDepartment.icon || ''}
                onChange={(e) => updateDepartment({ icon: e.target.value })}
                options={[...validIcons].map((value) => ({ value, label: value }))}
              />
              <Select
                label={copy.accent}
                value={activeDepartment.accent || ''}
                onChange={(e) => updateDepartment({ accent: e.target.value })}
                options={[...validAccents].map((value) => ({ value, label: value }))}
              />
            </div>
            <LinesTextarea key={`${activeSlug}-matches-${resetVersion}`} containerClassName='mt-5' label={copy.matches} hint={copy.matchesHint} rows={5} value={activeDepartment.specialtyMatches} onDirty={() => setIsDirty(true)} onCommit={(items) => updateDepartment({ specialtyMatches: items })} />
            <label className='mt-5 flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-4'>
              <input type='checkbox' checked={activeDepartment.isActive !== false} onChange={(e) => updateDepartment({ isActive: e.target.checked })} className='h-4 w-4 rounded border-slate-300 text-teal-600' />
              <span className='text-sm font-medium text-slate-700'>{copy.active}</span>
            </label>
          </section>
        </div>
      </div>
    </div>
  )
}
