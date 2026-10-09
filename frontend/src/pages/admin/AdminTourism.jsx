import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowDown, ArrowUp, Check, Eye, EyeOff, ImagePlus, Loader2, MapPinned, Plus, RotateCcw, Save, Trash2 } from 'lucide-react'
import Button from '../../components/ui/Button'
import LocalizedFields from '../../components/admin/LocalizedFields'
import { useToast } from '../../components/ui/Toast'
import { contentAPI, deleteFile, normalizeResponse, uploadFile } from '../../services/api'
import {
  localizeTourismRegion,
  resolveTourismImage,
  resolveTourismRegions,
  tourismTypes,
} from '../../data/kazakhstanTourism'
import { cn } from '../../utils/helpers'

/**
 * Места на странице «Туризм»: регионы, курорты, маршруты — всё, куда пациент
 * может поехать отдохнуть. Хранится одним списком в Global.tourismRegions;
 * пока там пусто, сайт показывает встроенный список, и он же открывается здесь
 * для правки. Сохранение общее — как в «Отделениях».
 */
const copyByLanguage = {
  ru: {
    title: 'Туризм', subtitle: 'Места отдыха и маршруты на странице «Туризм»',
    unsaved: 'Есть несохранённые изменения', discard: 'Отменить изменения', save: 'Сохранить изменения',
    add: 'Добавить место', newName: 'Название нового места', photo: 'Фотография',
    upload: 'Загрузить фото', uploading: 'Загрузка…', imageHint: 'JPEG, PNG или WebP, до 10 МБ. Лучше горизонтальное фото.',
    uploadError: 'Не удалось загрузить изображение', uploaded: 'Фото загружено. Сохраните изменения.',
    content: 'Описание', name: 'Название', center: 'Центр / город', summary: 'Краткое описание',
    highlights: 'Что посмотреть', highlightsHint: 'Каждый пункт — с новой строки',
    settings: 'Настройки места', types: 'Виды туризма', typesHint: 'По ним работают фильтры на странице',
    visible: 'Показывать на сайте', hidden: 'Скрыто', moveUp: 'Выше', moveDown: 'Ниже',
    remove: 'Удалить место', confirmRemove: 'Удалить «{name}» со страницы «Туризм»?',
    loadError: 'Не удалось загрузить места', saveError: 'Не удалось сохранить места', saved: 'Места сохранены',
    nameRequired: 'У каждого показываемого места должно быть название на русском',
    empty: 'Мест пока нет — добавьте первое.', leaveConfirm: 'Есть несохранённые изменения. Уйти со страницы?',
    preview: 'Открыть страницу', cleanupWarning: 'Изменения сохранены, но старые фото не удалось удалить из хранилища.',
  },
  en: {
    title: 'Tourism', subtitle: 'Places and routes shown on the Tourism page',
    unsaved: 'Unsaved changes', discard: 'Discard changes', save: 'Save changes',
    add: 'Add place', newName: 'Name of the new place', photo: 'Photo',
    upload: 'Upload photo', uploading: 'Uploading…', imageHint: 'JPEG, PNG or WebP, up to 10 MB. Landscape works best.',
    uploadError: 'Failed to upload image', uploaded: 'Photo uploaded. Save your changes.',
    content: 'Description', name: 'Name', center: 'Centre / city', summary: 'Short description',
    highlights: 'Highlights', highlightsHint: 'One item per line',
    settings: 'Place settings', types: 'Tourism types', typesHint: 'Used by the filters on the page',
    visible: 'Show on the site', hidden: 'Hidden', moveUp: 'Move up', moveDown: 'Move down',
    remove: 'Delete place', confirmRemove: 'Remove “{name}” from the Tourism page?',
    loadError: 'Failed to load places', saveError: 'Failed to save places', saved: 'Places saved',
    nameRequired: 'Every visible place needs a Russian name',
    empty: 'No places yet — add the first one.', leaveConfirm: 'You have unsaved changes. Leave the page?',
    preview: 'Open page', cleanupWarning: 'Saved, but old photos could not be removed from storage.',
  },
  kk: {
    title: 'Туризм', subtitle: '«Туризм» бетіндегі демалыс орындары мен бағыттар',
    unsaved: 'Сақталмаған өзгерістер бар', discard: 'Өзгерістерді болдырмау', save: 'Өзгерістерді сақтау',
    add: 'Орын қосу', newName: 'Жаңа орынның атауы', photo: 'Фотосурет',
    upload: 'Фото жүктеу', uploading: 'Жүктелуде…', imageHint: 'JPEG, PNG немесе WebP, 10 МБ дейін. Көлденең фото жақсы.',
    uploadError: 'Суретті жүктеу мүмкін болмады', uploaded: 'Фото жүктелді. Өзгерістерді сақтаңыз.',
    content: 'Сипаттама', name: 'Атауы', center: 'Орталығы / қала', summary: 'Қысқаша сипаттама',
    highlights: 'Көруге болады', highlightsHint: 'Әр тармақ жаңа жолдан',
    settings: 'Орын параметрлері', types: 'Туризм түрлері', typesHint: 'Беттегі сүзгілер осы бойынша жұмыс істейді',
    visible: 'Сайтта көрсету', hidden: 'Жасырын', moveUp: 'Жоғары', moveDown: 'Төмен',
    remove: 'Орынды жою', confirmRemove: '«{name}» орнын «Туризм» бетінен жою керек пе?',
    loadError: 'Орындарды жүктеу мүмкін болмады', saveError: 'Орындарды сақтау мүмкін болмады', saved: 'Орындар сақталды',
    nameRequired: 'Көрсетілетін әр орынның орысша атауы болуы керек',
    empty: 'Әзірге орын жоқ — алғашқысын қосыңыз.', leaveConfirm: 'Сақталмаған өзгерістер бар. Беттен шығасыз ба?',
    preview: 'Бетті ашу', cleanupWarning: 'Сақталды, бірақ ескі суреттерді қоймадан жою мүмкін болмады.',
  },
}

const imageTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
const maxImageBytes = 10 * 1024 * 1024
const defaultImage = '/tourism/astana.jpg'
const LOCALES = ['ru', 'en', 'kk']

const clone = (value) => JSON.parse(JSON.stringify(value))
const getMediaId = (media) => (media && typeof media === 'object' ? Number(media.id) || null : null)

// Сервер принимает только пути (/api/file-proxy/…, /uploads/…): S3-провайдер
// отдаёт полный адрес, а сохранённый адрес не должен зависеть от домена.
const toStoredMedia = (media) => {
  let url = media.url
  if (typeof url === 'string' && url.startsWith('http')) {
    try {
      const parsed = new URL(url)
      if (parsed.pathname.startsWith('/uploads/') || parsed.pathname.startsWith('/api/file-proxy/')) {
        url = `${parsed.pathname}${parsed.search}`
      }
    } catch {
      // оставляем как есть — сервер отклонит, админ увидит ошибку
    }
  }
  return { id: media.id, url, name: media.name || '', alternativeText: media.alternativeText || '' }
}

const transliterateSlug = (value) => {
  const map = { а: 'a', ә: 'a', б: 'b', в: 'v', г: 'g', ғ: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'i', і: 'i', к: 'k', қ: 'q', л: 'l', м: 'm', н: 'n', ң: 'n', о: 'o', ө: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ұ: 'u', ү: 'u', ф: 'f', х: 'h', һ: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya' }
  return String(value || '').toLocaleLowerCase('ru').split('').map((char) => map[char] ?? char).join('')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70)
}

const withOrder = (items) => items.map((item, index) => ({ ...item, sortOrder: index + 1 }))

// Строки «Что посмотреть» редактируются как текст, в данных — массив.
const linesToArray = (value) => String(value || '').split('\n').map((line) => line.trim()).filter(Boolean)

function AdminTourism() {
  const { i18n } = useTranslation()
  const language = ['ru', 'en', 'kk'].includes(i18n.language) ? i18n.language : 'ru'
  const copy = copyByLanguage[language]
  const toast = useToast()
  const [places, setPlaces] = useState([])
  const [savedPlaces, setSavedPlaces] = useState([])
  const [activeId, setActiveId] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  // Черновые строки «Что посмотреть»: в textarea можно оставить пустую строку,
  // в данные уходят только непустые.
  const [highlightDrafts, setHighlightDrafts] = useState({})
  const pendingUploadIds = useRef(new Set())

  const isDirty = useMemo(() => JSON.stringify(places) !== JSON.stringify(savedPlaces), [places, savedPlaces])

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
      // Записи Global ещё нет — работаем со встроенным списком.
      .catch((error) => {
        if (error?.response?.status === 404) return null
        throw error
      })
      .then((data) => {
        if (!active) return
        const resolved = withOrder(resolveTourismRegions(data?.tourismRegions).map((item) => ({
          ...item,
          isActive: item.isActive !== false,
          content: Object.fromEntries(LOCALES.map((locale) => [locale, { name: '', center: '', summary: '', highlights: [], ...(item.content?.[locale] || {}) }])),
        })))
        setPlaces(resolved)
        setSavedPlaces(clone(resolved))
        setActiveId(resolved[0]?.id || '')
      })
      .catch((error) => {
        console.error('Error loading tourism places:', error)
        if (active) toast.error(copy.loadError)
      })
      .finally(() => { if (active) setIsLoading(false) })
    return () => { active = false }
  }, [copy.loadError, toast])

  const activeIndex = places.findIndex((place) => place.id === activeId)
  const activePlace = activeIndex >= 0 ? places[activeIndex] : null

  const updatePlace = (patch) => {
    setPlaces((items) => items.map((item) => (item.id === activeId ? { ...item, ...patch } : item)))
  }

  const getValue = (locale, key) => {
    if (!activePlace) return ''
    if (key === 'highlights') {
      const draft = highlightDrafts[`${activePlace.id}:${locale}`]
      return draft ?? (activePlace.content?.[locale]?.highlights || []).join('\n')
    }
    return activePlace.content?.[locale]?.[key] || ''
  }

  const setValue = (locale, key, value) => {
    if (!activePlace) return
    if (key === 'highlights') {
      setHighlightDrafts((drafts) => ({ ...drafts, [`${activePlace.id}:${locale}`]: value }))
    }
    const nextValue = key === 'highlights' ? linesToArray(value) : value
    updatePlace({
      content: {
        ...activePlace.content,
        [locale]: { ...(activePlace.content?.[locale] || {}), [key]: nextValue },
      },
    })
  }

  const toggleType = (type) => {
    if (!activePlace) return
    const types = activePlace.types.includes(type)
      ? activePlace.types.filter((item) => item !== type)
      : [...activePlace.types, type]
    updatePlace({ types })
  }

  const movePlace = (direction) => {
    const target = activeIndex + direction
    if (activeIndex < 0 || target < 0 || target >= places.length) return
    setPlaces((items) => {
      const next = [...items]
      ;[next[activeIndex], next[target]] = [next[target], next[activeIndex]]
      return withOrder(next)
    })
  }

  const addPlace = () => {
    const name = window.prompt(copy.newName, '')?.trim()
    if (!name) return
    const base = transliterateSlug(name) || 'place'
    const used = new Set(places.map((place) => place.id))
    let id = base
    for (let suffix = 2; used.has(id); suffix += 1) id = `${base}-${suffix}`
    const place = {
      id,
      image: defaultImage,
      types: [],
      isActive: true,
      sortOrder: places.length + 1,
      content: {
        ru: { name, center: '', summary: '', highlights: [] },
        en: { name: '', center: '', summary: '', highlights: [] },
        kk: { name: '', center: '', summary: '', highlights: [] },
      },
    }
    setPlaces((items) => withOrder([...items, place]))
    setActiveId(id)
  }

  const removePlace = () => {
    if (!activePlace) return
    const name = activePlace.content?.ru?.name || activePlace.id
    if (!window.confirm(copy.confirmRemove.replace('{name}', name))) return
    const remaining = withOrder(places.filter((place) => place.id !== activePlace.id))
    setPlaces(remaining)
    setActiveId(remaining[Math.min(activeIndex, remaining.length - 1)]?.id || '')
  }

  const handleUpload = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !activePlace) return
    if (!imageTypes.has(file.type) || file.size > maxImageBytes) {
      toast.warning(copy.uploadError)
      return
    }
    setIsUploading(true)
    try {
      const uploaded = await uploadFile(file)
      pendingUploadIds.current.add(Number(uploaded.id))
      updatePlace({ image: toStoredMedia(uploaded) })
      toast.success(copy.uploaded)
    } catch (error) {
      console.error('Error uploading tourism image:', error)
      toast.error(copy.uploadError)
    } finally {
      setIsUploading(false)
    }
  }

  const handleDiscard = () => {
    const uploads = [...pendingUploadIds.current]
    pendingUploadIds.current.clear()
    Promise.allSettled(uploads.map((id) => deleteFile(id)))
    setPlaces(clone(savedPlaces))
    setHighlightDrafts({})
    if (!savedPlaces.some((place) => place.id === activeId)) setActiveId(savedPlaces[0]?.id || '')
  }

  const handleSave = async () => {
    if (places.some((place) => place.isActive && !String(place.content?.ru?.name || '').trim())) {
      toast.warning(copy.nameRequired)
      return
    }
    setIsSaving(true)
    try {
      const payload = withOrder(places)
      await contentAPI.updateGlobal({ tourismRegions: payload })

      // Фото, которые больше нигде не используются, удаляем из хранилища.
      const usedIds = new Set(payload.map((place) => getMediaId(place.image)).filter(Boolean))
      const replacedIds = [...new Set([
        ...savedPlaces.map((place) => getMediaId(place.image)),
        ...pendingUploadIds.current,
      ])].filter((id) => id && !usedIds.has(id))
      const cleanup = await Promise.allSettled(replacedIds.map((id) => deleteFile(id)))
      if (cleanup.some((result) => result.status === 'rejected')) toast.warning(copy.cleanupWarning)
      pendingUploadIds.current.clear()

      setPlaces(payload)
      setSavedPlaces(clone(payload))
      setHighlightDrafts({})
      toast.success(copy.saved)
    } catch (error) {
      console.error('Error saving tourism places:', error)
      const reason = error?.response?.data?.error?.message
      toast.error(reason ? `${copy.saveError}: ${reason}` : copy.saveError)
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) return <div className='flex justify-center py-20'><Loader2 className='h-8 w-8 animate-spin text-teal-600' /></div>

  return (
    <div className='space-y-6 pb-16'>
      <div className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
        <div>
          <h1 className='text-2xl font-bold text-slate-950'>{copy.title}</h1>
          <p className='mt-1 text-slate-600'>{copy.subtitle}</p>
          {isDirty && <p className='mt-2 text-sm font-medium text-amber-600'>{copy.unsaved}</p>}
        </div>
        <div className='flex flex-wrap gap-2'>
          <a href='/tourism#regions' target='_blank' rel='noreferrer'>
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

      <div className='grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]'>
        <aside className='space-y-2 xl:sticky xl:top-24 xl:max-h-[calc(100vh-7rem)] xl:self-start xl:overflow-y-auto xl:pr-1'>
          <Button type='button' variant='secondary' className='mb-3 w-full' onClick={addPlace} leftIcon={<Plus className='h-4 w-4' />}>
            {copy.add}
          </Button>
          {places.length === 0 && <p className='rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500'>{copy.empty}</p>}
          {places.map((place) => {
            const localized = localizeTourismRegion(place, language)
            return (
              <button
                key={place.id}
                type='button'
                onClick={() => setActiveId(place.id)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors',
                  place.id === activeId ? 'border-teal-300 bg-teal-50' : 'border-slate-200 bg-white hover:border-slate-300',
                )}
              >
                <img src={resolveTourismImage(place.image)} alt='' className='h-12 w-16 shrink-0 rounded-xl bg-slate-100 object-cover' />
                <span className='min-w-0 flex-1'>
                  <span className='block truncate font-semibold text-slate-900'>{localized.name}</span>
                  <span className='block truncate text-xs text-slate-500'>{localized.center || place.id}</span>
                </span>
                {place.isActive
                  ? <Check className='h-4 w-4 shrink-0 text-teal-600' />
                  : <span className='shrink-0 text-[11px] font-medium text-amber-700'>{copy.hidden}</span>}
              </button>
            )
          })}
        </aside>

        {activePlace && (
          <div className='space-y-6'>
            <section className='rounded-3xl border border-slate-200 bg-white p-5 sm:p-7'>
              <h2 className='text-lg font-bold text-slate-900'>{copy.photo}</h2>
              <div className='mt-5 grid gap-5 lg:grid-cols-[320px_1fr] lg:items-center'>
                <div className='aspect-video overflow-hidden rounded-2xl bg-slate-100'>
                  <img src={resolveTourismImage(activePlace.image)} alt='' className='h-full w-full object-cover' />
                </div>
                <div>
                  <label className='inline-flex cursor-pointer'>
                    <input type='file' accept='image/jpeg,image/png,image/webp' className='hidden' onChange={handleUpload} disabled={isUploading} />
                    <span className='inline-flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-200'>
                      {isUploading ? <Loader2 className='h-4 w-4 animate-spin' /> : <ImagePlus className='h-4 w-4' />}
                      {isUploading ? copy.uploading : copy.upload}
                    </span>
                  </label>
                  <p className='mt-2 text-xs text-slate-500'>{copy.imageHint}</p>
                </div>
              </div>
            </section>

            <section className='rounded-3xl border border-slate-200 bg-white p-5 sm:p-7'>
              <h2 className='mb-5 text-lg font-bold text-slate-900'>{copy.content}</h2>
              <LocalizedFields
                key={activePlace.id}
                fields={[
                  { key: 'name', label: copy.name, required: true, maxLength: 200 },
                  { key: 'center', label: copy.center, maxLength: 200 },
                  { key: 'summary', label: copy.summary, multiline: true, rows: 3, maxLength: 2000 },
                  { key: 'highlights', label: `${copy.highlights} — ${copy.highlightsHint}`, multiline: true, rows: 4 },
                ]}
                getValue={getValue}
                setValue={setValue}
              />
            </section>

            <section className='rounded-3xl border border-slate-200 bg-white p-5 sm:p-7'>
              <h2 className='text-lg font-bold text-slate-900'>{copy.settings}</h2>
              <p className='mt-5 text-sm font-medium text-slate-700'>{copy.types}</p>
              <p className='mt-1 text-xs text-slate-500'>{copy.typesHint}</p>
              <div className='mt-3 flex flex-wrap gap-2'>
                {Object.entries(tourismTypes).map(([type, labels]) => {
                  const selected = activePlace.types.includes(type)
                  return (
                    <button
                      key={type}
                      type='button'
                      aria-pressed={selected}
                      onClick={() => toggleType(type)}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
                        selected ? 'border-teal-600 bg-teal-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-teal-300',
                      )}
                    >
                      {selected && <Check className='h-3.5 w-3.5' />}
                      {labels[language] || labels.ru}
                    </button>
                  )
                })}
              </div>

              <div className='mt-6 flex flex-wrap items-center gap-2'>
                <Button
                  type='button'
                  variant={activePlace.isActive ? 'secondary' : 'outline'}
                  onClick={() => updatePlace({ isActive: !activePlace.isActive })}
                  leftIcon={activePlace.isActive ? <Eye className='h-4 w-4' /> : <EyeOff className='h-4 w-4' />}
                >
                  {activePlace.isActive ? copy.visible : copy.hidden}
                </Button>
                <Button type='button' variant='secondary' onClick={() => movePlace(-1)} disabled={activeIndex <= 0} leftIcon={<ArrowUp className='h-4 w-4' />}>{copy.moveUp}</Button>
                <Button type='button' variant='secondary' onClick={() => movePlace(1)} disabled={activeIndex >= places.length - 1} leftIcon={<ArrowDown className='h-4 w-4' />}>{copy.moveDown}</Button>
                <Button type='button' variant='ghost' className='text-rose-600 hover:bg-rose-50' onClick={removePlace} leftIcon={<Trash2 className='h-4 w-4' />}>{copy.remove}</Button>
              </div>
              <p className='mt-4 flex items-center gap-2 text-xs text-slate-500'><MapPinned className='h-3.5 w-3.5' />{activePlace.id}</p>
            </section>
          </div>
        )}
      </div>
    </div>
  )
}

export default AdminTourism
