import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowDown, ArrowUp, Check, Eye, EyeOff, ImagePlus, Loader2, Plus, RotateCcw, Save, Trash2, Undo2 } from 'lucide-react'
import Button from '../ui/Button'
import LocalizedFields from './LocalizedFields'
import { useToast } from '../ui/Toast'
import { contentAPI, deleteFile, normalizeResponse, uploadFile } from '../../services/api'
import {
  DEFAULT_TOURISM_HERO,
  localizeTourismTour,
  resolveTourismImage,
  resolveTourismPage,
} from '../../data/kazakhstanTourism'
import { getMediaId, isAcceptableImage, linesToArray, toStoredMedia, uniqueSlug, withOrder } from '../../utils/adminMedia'
import { cn } from '../../utils/helpers'

/**
 * Admin > Туризм > Страница: картинка первого экрана и блок «Маршруты из
 * турпакета». Хранится в Global.tourismPage; пока его не сохраняли, сайт
 * показывает встроенные картинку и маршруты — они же открываются здесь.
 */
const copyByLanguage = {
  ru: {
    subtitle: 'Первый экран страницы «Туризм» и маршруты из турпакета',
    unsaved: 'Есть несохранённые изменения', discard: 'Отменить изменения', save: 'Сохранить изменения', preview: 'Открыть страницу',
    hero: 'Картинка первого экрана', heroHint: 'Широкое горизонтальное фото, от 1920 px по ширине. JPEG, PNG или WebP, до 10 МБ.',
    upload: 'Загрузить фото', uploading: 'Загрузка…', resetHero: 'Вернуть стандартную', defaultHero: 'Сейчас стандартная картинка сайта',
    tours: 'Маршруты из турпакета', toursHint: 'Карточки блока «Два способа открыть природу из Астаны»',
    add: 'Добавить маршрут', newName: 'Название нового маршрута', photo: 'Фото маршрута',
    name: 'Название', label: 'Подпись над названием', text: 'Описание', highlights: 'Что входит — каждый пункт с новой строки',
    visible: 'Показывать на сайте', hidden: 'Скрыт', moveUp: 'Выше', moveDown: 'Ниже', remove: 'Удалить маршрут',
    confirmRemove: 'Удалить маршрут «{name}»?', empty: 'Маршрутов нет — блок на странице скрыт.',
    uploadError: 'Не удалось загрузить изображение', uploaded: 'Фото загружено. Сохраните изменения.',
    loadError: 'Не удалось загрузить настройки страницы', saveError: 'Не удалось сохранить', saved: 'Страница сохранена',
    nameRequired: 'У каждого показываемого маршрута должно быть название на русском',
    leaveConfirm: 'Есть несохранённые изменения. Уйти со страницы?', cleanupWarning: 'Сохранено, но старые фото не удалось удалить из хранилища.',
  },
  en: {
    subtitle: 'Tourism page hero and tour package routes',
    unsaved: 'Unsaved changes', discard: 'Discard changes', save: 'Save changes', preview: 'Open page',
    hero: 'Hero image', heroHint: 'A wide landscape photo, 1920 px wide or more. JPEG, PNG or WebP, up to 10 MB.',
    upload: 'Upload photo', uploading: 'Uploading…', resetHero: 'Use the default', defaultHero: 'The site’s default image is used',
    tours: 'Tour package routes', toursHint: 'Cards of the “Two ways to discover nature from Astana” block',
    add: 'Add route', newName: 'Name of the new route', photo: 'Route photo',
    name: 'Name', label: 'Label above the name', text: 'Description', highlights: 'What is included — one item per line',
    visible: 'Show on the site', hidden: 'Hidden', moveUp: 'Move up', moveDown: 'Move down', remove: 'Delete route',
    confirmRemove: 'Delete the route “{name}”?', empty: 'No routes — the block is hidden on the page.',
    uploadError: 'Failed to upload image', uploaded: 'Photo uploaded. Save your changes.',
    loadError: 'Failed to load page settings', saveError: 'Failed to save', saved: 'Page saved',
    nameRequired: 'Every visible route needs a Russian name',
    leaveConfirm: 'You have unsaved changes. Leave the page?', cleanupWarning: 'Saved, but old photos could not be removed from storage.',
  },
  kk: {
    subtitle: '«Туризм» бетінің бірінші экраны және турпакет бағыттары',
    unsaved: 'Сақталмаған өзгерістер бар', discard: 'Өзгерістерді болдырмау', save: 'Өзгерістерді сақтау', preview: 'Бетті ашу',
    hero: 'Бірінші экран суреті', heroHint: 'Кең көлденең фото, ені 1920 px-тен. JPEG, PNG немесе WebP, 10 МБ дейін.',
    upload: 'Фото жүктеу', uploading: 'Жүктелуде…', resetHero: 'Стандартты қайтару', defaultHero: 'Қазір сайттың стандартты суреті',
    tours: 'Турпакет бағыттары', toursHint: '«Астанадан табиғатқа екі бағыт» блогының карточкалары',
    add: 'Бағыт қосу', newName: 'Жаңа бағыттың атауы', photo: 'Бағыт фотосы',
    name: 'Атауы', label: 'Атау үстіндегі жазу', text: 'Сипаттама', highlights: 'Не кіреді — әр тармақ жаңа жолдан',
    visible: 'Сайтта көрсету', hidden: 'Жасырын', moveUp: 'Жоғары', moveDown: 'Төмен', remove: 'Бағытты жою',
    confirmRemove: '«{name}» бағытын жою керек пе?', empty: 'Бағыттар жоқ — бетте блок жасырылған.',
    uploadError: 'Суретті жүктеу мүмкін болмады', uploaded: 'Фото жүктелді. Өзгерістерді сақтаңыз.',
    loadError: 'Бет баптауларын жүктеу мүмкін болмады', saveError: 'Сақтау мүмкін болмады', saved: 'Бет сақталды',
    nameRequired: 'Көрсетілетін әр бағыттың орысша атауы болуы керек',
    leaveConfirm: 'Сақталмаған өзгерістер бар. Беттен шығасыз ба?', cleanupWarning: 'Сақталды, бірақ ескі суреттерді қоймадан жою мүмкін болмады.',
  },
}

const LOCALES = ['ru', 'en', 'kk']
const defaultTourImage = '/tourism/burabay.jpg'
const clone = (value) => JSON.parse(JSON.stringify(value))
const emptyContent = () => ({ name: '', label: '', text: '', highlights: [] })

const normalizePage = (stored) => {
  const page = resolveTourismPage(stored)
  return {
    heroImage: page.heroImage,
    tours: withOrder(page.tours.map((tour) => ({
      ...tour,
      isActive: tour.isActive !== false,
      content: Object.fromEntries(LOCALES.map((locale) => [locale, { ...emptyContent(), ...(tour.content?.[locale] || {}) }])),
    }))),
  }
}

function TourismPageSettings({ hidden }) {
  const { i18n } = useTranslation()
  const language = LOCALES.includes(i18n.language) ? i18n.language : 'ru'
  const copy = copyByLanguage[language]
  const toast = useToast()
  const [page, setPage] = useState({ heroImage: null, tours: [] })
  const [savedPage, setSavedPage] = useState({ heroImage: null, tours: [] })
  const [activeId, setActiveId] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [uploadTarget, setUploadTarget] = useState('')
  const [highlightDrafts, setHighlightDrafts] = useState({})
  const pendingUploadIds = useRef(new Set())

  const isDirty = useMemo(() => JSON.stringify(page) !== JSON.stringify(savedPage), [page, savedPage])

  useEffect(() => {
    if (!isDirty) return undefined
    const handleBeforeUnload = (event) => {
      event.preventDefault()
      event.returnValue = copy.leaveConfirm
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [copy.leaveConfirm, isDirty])

  useEffect(() => {
    let active = true
    contentAPI.getGlobal()
      .then((response) => normalizeResponse(response)?.data || null)
      .catch((error) => {
        if (error?.response?.status === 404) return null
        throw error
      })
      .then((data) => {
        if (!active) return
        const resolved = normalizePage(data?.tourismPage)
        setPage(resolved)
        setSavedPage(clone(resolved))
        setActiveId(resolved.tours[0]?.id || '')
      })
      .catch((error) => {
        console.error('Error loading tourism page settings:', error)
        if (active) toast.error(copy.loadError)
      })
      .finally(() => { if (active) setIsLoading(false) })
    return () => { active = false }
  }, [copy.loadError, toast])

  const tours = page.tours
  const activeIndex = tours.findIndex((tour) => tour.id === activeId)
  const activeTour = activeIndex >= 0 ? tours[activeIndex] : null

  const setTours = (update) => setPage((current) => ({ ...current, tours: withOrder(update(current.tours)) }))
  const updateTour = (patch) => setTours((items) => items.map((item) => (item.id === activeId ? { ...item, ...patch } : item)))

  const getValue = (locale, key) => {
    if (!activeTour) return ''
    if (key === 'highlights') {
      const draft = highlightDrafts[`${activeTour.id}:${locale}`]
      return draft ?? (activeTour.content?.[locale]?.highlights || []).join('\n')
    }
    return activeTour.content?.[locale]?.[key] || ''
  }

  const setValue = (locale, key, value) => {
    if (!activeTour) return
    if (key === 'highlights') setHighlightDrafts((drafts) => ({ ...drafts, [`${activeTour.id}:${locale}`]: value }))
    updateTour({
      content: {
        ...activeTour.content,
        [locale]: { ...(activeTour.content?.[locale] || {}), [key]: key === 'highlights' ? linesToArray(value) : value },
      },
    })
  }

  // target: 'hero' или id маршрута — фиксируем до загрузки.
  const uploadImage = async (event, target) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!isAcceptableImage(file)) {
      toast.warning(copy.uploadError)
      return
    }
    setUploadTarget(target)
    try {
      const uploaded = await uploadFile(file)
      pendingUploadIds.current.add(Number(uploaded.id))
      const media = toStoredMedia(uploaded)
      if (target === 'hero') setPage((current) => ({ ...current, heroImage: media }))
      else setTours((items) => items.map((item) => (item.id === target ? { ...item, image: media } : item)))
      toast.success(copy.uploaded)
    } catch (error) {
      console.error('Error uploading tourism page image:', error)
      toast.error(copy.uploadError)
    } finally {
      setUploadTarget('')
    }
  }

  const addTour = () => {
    const name = window.prompt(copy.newName, '')?.trim()
    if (!name) return
    const id = uniqueSlug(name, tours.map((tour) => tour.id), 'route')
    setTours((items) => [...items, {
      id,
      image: defaultTourImage,
      isActive: true,
      sortOrder: items.length + 1,
      content: { ru: { ...emptyContent(), name }, en: emptyContent(), kk: emptyContent() },
    }])
    setActiveId(id)
  }

  const removeTour = () => {
    if (!activeTour) return
    const name = activeTour.content?.ru?.name || activeTour.id
    if (!window.confirm(copy.confirmRemove.replace('{name}', name))) return
    const remaining = tours.filter((tour) => tour.id !== activeTour.id)
    setTours(() => remaining)
    setActiveId(remaining[Math.min(activeIndex, remaining.length - 1)]?.id || '')
  }

  const moveTour = (direction) => {
    const target = activeIndex + direction
    if (activeIndex < 0 || target < 0 || target >= tours.length) return
    setTours((items) => {
      const next = [...items]
      ;[next[activeIndex], next[target]] = [next[target], next[activeIndex]]
      return next
    })
  }

  const handleDiscard = () => {
    const uploads = [...pendingUploadIds.current]
    pendingUploadIds.current.clear()
    Promise.allSettled(uploads.map((id) => deleteFile(id)))
    setPage(clone(savedPage))
    setHighlightDrafts({})
    if (!savedPage.tours.some((tour) => tour.id === activeId)) setActiveId(savedPage.tours[0]?.id || '')
  }

  const handleSave = async () => {
    if (tours.some((tour) => tour.isActive && !String(tour.content?.ru?.name || '').trim())) {
      toast.warning(copy.nameRequired)
      return
    }
    setIsSaving(true)
    try {
      const payload = { heroImage: page.heroImage || null, tours: withOrder(tours) }
      await contentAPI.updateGlobal({ tourismPage: payload })

      // Фото, которые больше нигде не используются, удаляем из хранилища.
      const mediaIds = (value) => [value.heroImage, ...value.tours.map((tour) => tour.image)].map(getMediaId)
      const usedIds = new Set(mediaIds(payload).filter(Boolean))
      const replacedIds = [...new Set([...mediaIds(savedPage), ...pendingUploadIds.current])].filter((id) => id && !usedIds.has(id))
      const cleanup = await Promise.allSettled(replacedIds.map((id) => deleteFile(id)))
      if (cleanup.some((result) => result.status === 'rejected')) toast.warning(copy.cleanupWarning)
      pendingUploadIds.current.clear()

      setPage(payload)
      setSavedPage(clone(payload))
      setHighlightDrafts({})
      toast.success(copy.saved)
    } catch (error) {
      console.error('Error saving tourism page settings:', error)
      const reason = error?.response?.data?.error?.message
      toast.error(reason ? `${copy.saveError}: ${reason}` : copy.saveError)
    } finally {
      setIsSaving(false)
    }
  }

  if (hidden) return null
  if (isLoading) return <div className='flex justify-center py-20'><Loader2 className='h-8 w-8 animate-spin text-teal-600' /></div>

  const isUploading = Boolean(uploadTarget)
  const uploadButton = (target, disabled) => (
    <label className={cn('inline-flex', disabled ? 'pointer-events-none opacity-50' : 'cursor-pointer')}>
      <input type='file' accept='image/jpeg,image/png,image/webp' className='hidden' disabled={disabled}
        onChange={(event) => uploadImage(event, target)} data-testid={`tourism-${target === 'hero' ? 'hero' : 'route'}-input`} />
      <span className='inline-flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-200'>
        {uploadTarget === target ? <Loader2 className='h-4 w-4 animate-spin' /> : <ImagePlus className='h-4 w-4' />}
        {uploadTarget === target ? copy.uploading : copy.upload}
      </span>
    </label>
  )

  return (
    <div className='space-y-6'>
      <div className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
        <div>
          <p className='text-slate-600'>{copy.subtitle}</p>
          {isDirty && <p className='mt-2 text-sm font-medium text-amber-600'>{copy.unsaved}</p>}
        </div>
        <div className='flex flex-wrap gap-2'>
          <a href='/tourism' target='_blank' rel='noreferrer'>
            <Button type='button' variant='secondary' leftIcon={<Eye className='h-4 w-4' />}>{copy.preview}</Button>
          </a>
          {isDirty && (
            <Button type='button' variant='secondary' onClick={handleDiscard} disabled={isSaving || isUploading} leftIcon={<RotateCcw className='h-4 w-4' />}>
              {copy.discard}
            </Button>
          )}
          <Button onClick={handleSave} isLoading={isSaving} disabled={!isDirty || isUploading} leftIcon={<Save className='h-4 w-4' />}>{copy.save}</Button>
        </div>
      </div>

      <section className='rounded-3xl border border-slate-200 bg-white p-5 sm:p-7'>
        <h2 className='text-lg font-bold text-slate-900'>{copy.hero}</h2>
        <div className='mt-5 grid gap-5 lg:grid-cols-[420px_1fr] lg:items-center'>
          <div className='aspect-[21/9] overflow-hidden rounded-2xl bg-slate-100'>
            <img src={resolveTourismImage(page.heroImage) || DEFAULT_TOURISM_HERO} alt='' className='h-full w-full object-cover' data-testid='tourism-hero-preview' />
          </div>
          <div className='space-y-3'>
            <div className='flex flex-wrap gap-2'>
              {uploadButton('hero', isUploading)}
              {page.heroImage && (
                <Button type='button' variant='ghost' onClick={() => setPage((current) => ({ ...current, heroImage: null }))} leftIcon={<Undo2 className='h-4 w-4' />}>
                  {copy.resetHero}
                </Button>
              )}
            </div>
            <p className='text-xs text-slate-500'>{copy.heroHint}</p>
            {!page.heroImage && <p className='text-xs font-medium text-slate-600'>{copy.defaultHero}</p>}
          </div>
        </div>
      </section>

      <section className='rounded-3xl border border-slate-200 bg-white p-5 sm:p-7'>
        <h2 className='text-lg font-bold text-slate-900'>{copy.tours}</h2>
        <p className='mt-1 text-xs text-slate-500'>{copy.toursHint}</p>
        <div className='mt-5 grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]'>
          <aside className='space-y-2'>
            <Button type='button' variant='secondary' className='mb-3 w-full' onClick={addTour} leftIcon={<Plus className='h-4 w-4' />}>{copy.add}</Button>
            {tours.length === 0 && <p className='rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500'>{copy.empty}</p>}
            {tours.map((tour) => (
              <button
                key={tour.id}
                type='button'
                onClick={() => setActiveId(tour.id)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors',
                  tour.id === activeId ? 'border-teal-300 bg-teal-50' : 'border-slate-200 bg-white hover:border-slate-300',
                )}
              >
                <img src={resolveTourismImage(tour.image)} alt='' className='h-12 w-16 shrink-0 rounded-xl bg-slate-100 object-cover' />
                <span className='min-w-0 flex-1 truncate font-semibold text-slate-900'>{localizeTourismTour(tour, language).name}</span>
                {tour.isActive
                  ? <Check className='h-4 w-4 shrink-0 text-teal-600' />
                  : <span className='shrink-0 text-[11px] font-medium text-amber-700'>{copy.hidden}</span>}
              </button>
            ))}
          </aside>

          {activeTour && (
            <div className='space-y-5'>
              <div className='grid gap-5 lg:grid-cols-[280px_1fr] lg:items-center'>
                <div className='aspect-video overflow-hidden rounded-2xl bg-slate-100'>
                  <img src={resolveTourismImage(activeTour.image)} alt='' className='h-full w-full object-cover' />
                </div>
                <div>
                  <p className='mb-2 text-sm font-medium text-slate-700'>{copy.photo}</p>
                  {uploadButton(activeTour.id, isUploading)}
                </div>
              </div>
              <LocalizedFields
                key={activeTour.id}
                fields={[
                  { key: 'name', label: copy.name, required: true, maxLength: 200 },
                  { key: 'label', label: copy.label, maxLength: 200 },
                  { key: 'text', label: copy.text, multiline: true, rows: 3, maxLength: 2000 },
                  { key: 'highlights', label: copy.highlights, multiline: true, rows: 3 },
                ]}
                getValue={getValue}
                setValue={setValue}
              />
              <div className='flex flex-wrap items-center gap-2'>
                <Button
                  type='button'
                  variant={activeTour.isActive ? 'secondary' : 'outline'}
                  onClick={() => updateTour({ isActive: !activeTour.isActive })}
                  leftIcon={activeTour.isActive ? <Eye className='h-4 w-4' /> : <EyeOff className='h-4 w-4' />}
                >
                  {activeTour.isActive ? copy.visible : copy.hidden}
                </Button>
                <Button type='button' variant='secondary' onClick={() => moveTour(-1)} disabled={activeIndex <= 0} leftIcon={<ArrowUp className='h-4 w-4' />}>{copy.moveUp}</Button>
                <Button type='button' variant='secondary' onClick={() => moveTour(1)} disabled={activeIndex >= tours.length - 1} leftIcon={<ArrowDown className='h-4 w-4' />}>{copy.moveDown}</Button>
                <Button type='button' variant='ghost' className='text-rose-600 hover:bg-rose-50' onClick={removeTour} leftIcon={<Trash2 className='h-4 w-4' />}>{copy.remove}</Button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

export default TourismPageSettings
