import { useCallback, useEffect, useMemo, useState } from 'react'
import { Eye, Loader2, Pencil, Plus, Search, Trash2, Upload, Video } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import Select from '../../components/ui/Select'
import Textarea from '../../components/ui/Textarea'
import { useToast } from '../../components/ui/Toast'
import { getMediaUrl, guideVideosAPI, normalizeResponse, uploadFile } from '../../services/api'

const defaultForm = {
  title: '',
  description: '',
  videoUrl: '',
  videoFile: null,
  poster: null,
  icon: 'play',
  sortOrder: '',
  isActive: true,
  i18n: {},
}

const languageOptions = [
  { value: 'ru', label: 'Русский' },
  { value: 'en', label: 'English' },
  { value: 'kk', label: 'Қазақша' },
]

const iconOptions = [
  { value: 'play', label: 'Старт' },
  { value: 'upload', label: 'Загрузка' },
  { value: 'video', label: 'Видео' },
  { value: 'chat', label: 'Чат' },
  { value: 'document', label: 'Документ' },
]

function createEmptyLocale() {
  return {
    title: '',
    description: '',
    videoUrl: '',
    videoFile: null,
    poster: null,
  }
}

function createDefaultI18n(source = {}) {
  return languageOptions.reduce((acc, { value }) => {
    acc[value] = {
      ...createEmptyLocale(),
      ...(source?.[value] || {}),
    }
    return acc
  }, {})
}

function createDefaultForm() {
  return {
    ...defaultForm,
    i18n: createDefaultI18n(),
  }
}

function sortVideos(list) {
  return [...(list || [])].sort((a, b) => {
    const orderA = Number(a.sortOrder) || 0
    const orderB = Number(b.sortOrder) || 0
    if (orderA !== orderB) return orderA - orderB
    return (a.title || '').localeCompare(b.title || '', 'ru')
  })
}

function hasVideoSource(entry) {
  return Boolean(entry?.videoUrl?.trim() || entry?.videoFile?.id || entry?.videoFile?.url)
}

function getFileLabel(file, fallback) {
  return file?.name || file?.url || fallback
}

function getVideoSource(entry) {
  return entry?.videoUrl || getMediaUrl(entry?.videoFile) || ''
}

function AdminGuideVideos() {
  const toast = useToast()
  const [items, setItems] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [uploadingVideoTarget, setUploadingVideoTarget] = useState(null)
  const [uploadingPosterTarget, setUploadingPosterTarget] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState(createDefaultForm)
  const [activeLanguage, setActiveLanguage] = useState('ru')

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await guideVideosAPI.getAll({ includeInactive: true })
      const { data } = normalizeResponse(res)
      setItems(sortVideos(data || []))
    } catch (error) {
      console.error('Error loading guide videos:', error)
      toast.error('Не удалось загрузить видео обучения')
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadData()
  }, [loadData])

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return items
    return items.filter((item) =>
      item.title?.toLowerCase().includes(query) ||
      item.description?.toLowerCase().includes(query) ||
      Object.values(item.i18n || {}).some((locale) =>
        locale?.title?.toLowerCase().includes(query) ||
        locale?.description?.toLowerCase().includes(query),
      ),
    )
  }, [items, search])

  const openCreateModal = () => {
    setEditingItem(null)
    setForm({
      ...createDefaultForm(),
      sortOrder: String((items.length + 1) * 10),
    })
    setActiveLanguage('ru')
    setIsModalOpen(true)
  }

  const openEditModal = (item) => {
    setEditingItem(item)
    setForm({
      title: item.title || '',
      description: item.description || '',
      videoUrl: item.videoUrl || '',
      videoFile: item.videoFile || null,
      poster: item.poster || null,
      icon: item.icon || 'play',
      sortOrder: item.sortOrder !== undefined ? String(item.sortOrder) : '',
      isActive: item.isActive !== false,
      i18n: createDefaultI18n(item.i18n || {}),
    })
    setActiveLanguage('ru')
    setIsModalOpen(true)
  }

  const setFormValue = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const setLocaleValue = (language, field, value) => {
    setForm((prev) => ({
      ...prev,
      i18n: {
        ...prev.i18n,
        [language]: {
          ...createEmptyLocale(),
          ...(prev.i18n?.[language] || {}),
          [field]: value,
        },
      },
    }))
  }

  const handleVideoUpload = async (event, language = null) => {
    const file = event.target.files?.[0]
    if (!file) return
    const target = language || 'default'
    setUploadingVideoTarget(target)
    try {
      const uploaded = await uploadFile(file)
      if (language) {
        setLocaleValue(language, 'videoFile', uploaded)
        setLocaleValue(language, 'videoUrl', '')
      } else {
        setFormValue('videoFile', uploaded)
        setFormValue('videoUrl', '')
      }
      toast.success('Видео загружено')
    } catch (error) {
      toast.error(error.message || 'Не удалось загрузить видео')
    } finally {
      setUploadingVideoTarget(null)
      event.target.value = ''
    }
  }

  const handlePosterUpload = async (event, language = null) => {
    const file = event.target.files?.[0]
    if (!file) return
    const target = language || 'default'
    setUploadingPosterTarget(target)
    try {
      const uploaded = await uploadFile(file)
      if (language) {
        setLocaleValue(language, 'poster', uploaded)
      } else {
        setFormValue('poster', uploaded)
      }
      toast.success('Обложка загружена')
    } catch (error) {
      toast.error(error.message || 'Не удалось загрузить обложку')
    } finally {
      setUploadingPosterTarget(null)
      event.target.value = ''
    }
  }

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast.warning('Введите название видео')
      return
    }
    const hasDefaultVideo = hasVideoSource(form)
    const hasLocalizedVideo = Object.values(form.i18n || {}).some(hasVideoSource)
    if (!hasDefaultVideo && !hasLocalizedVideo) {
      toast.warning('Добавьте ссылку на видео или загрузите файл')
      return
    }

    const localizedPayload = languageOptions.reduce((acc, { value }) => {
      const locale = form.i18n?.[value] || createEmptyLocale()
      acc[value] = {
        title: locale.title?.trim() || '',
        description: locale.description?.trim() || '',
        videoUrl: locale.videoUrl?.trim() || '',
        videoFile: locale.videoFile || null,
        poster: locale.poster || null,
      }
      return acc
    }, {})

    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      videoUrl: form.videoUrl.trim(),
      videoFile: form.videoFile?.id || null,
      poster: form.poster?.id || null,
      icon: form.icon || 'play',
      sortOrder: Number(form.sortOrder) || 0,
      isActive: Boolean(form.isActive),
      i18n: localizedPayload,
    }

    setIsSaving(true)
    try {
      if (editingItem) {
        await guideVideosAPI.update(editingItem.documentId || editingItem.id, payload)
      } else {
        await guideVideosAPI.create(payload)
      }
      toast.success('Видео сохранено')
      setIsModalOpen(false)
      await loadData()
    } catch (error) {
      console.error('Error saving guide video:', error)
      toast.error('Не удалось сохранить видео')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (item) => {
    const confirmed = window.confirm(`Удалить видео "${item.title}"?`)
    if (!confirmed) return

    try {
      await guideVideosAPI.delete(item.documentId || item.id)
      toast.success('Видео удалено')
      await loadData()
    } catch (error) {
      console.error('Error deleting guide video:', error)
      toast.error('Не удалось удалить видео')
    }
  }

  const activeLocale = form.i18n?.[activeLanguage] || createEmptyLocale()
  const activeLanguageLabel = languageOptions.find((item) => item.value === activeLanguage)?.label || activeLanguage

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Видео обучения</h1>
          <p className="text-slate-600">Настройка видео для пациентской вкладки «Обучение».</p>
        </div>
        <Button leftIcon={<Plus className="w-4 h-4" />} onClick={openCreateModal}>
          Добавить видео
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по названию"
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Список видео ({filteredItems.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-12 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              <Video className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              Видео пока не добавлены
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="px-4 py-3 text-left font-medium text-slate-500">Видео</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-500">Источник</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-500">Статус</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-500">Порядок</th>
                    <th className="px-4 py-3 text-right font-medium text-slate-500">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => {
                    const localizedVideoCount = Object.values(item.i18n || {}).filter(hasVideoSource).length
                    const firstLocalizedVideo = Object.values(item.i18n || {}).map(getVideoSource).find(Boolean)
                    const videoSrc = item.videoUrl || getMediaUrl(item.videoFile) || firstLocalizedVideo
                    const sourceLabel = item.videoUrl ? 'Ссылка' : item.videoFile ? 'Файл' : localizedVideoCount ? 'По языкам' : '-'
                    return (
                      <tr key={item.documentId || item.id} className="border-b border-slate-50">
                        <td className="px-4 py-4">
                          <div className="font-semibold text-slate-900">{item.title}</div>
                          {item.description && (
                            <div className="text-xs text-slate-500 max-w-md truncate">{item.description}</div>
                          )}
                        </td>
                        <td className="px-4 py-4 text-slate-600">
                          <div>{sourceLabel}</div>
                          {localizedVideoCount > 0 && (
                            <div className="text-xs text-slate-400 mt-1">
                              {localizedVideoCount} языковая версия
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
                            item.isActive !== false
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-slate-100 text-slate-500'
                          }`}>
                            {item.isActive !== false ? 'Активно' : 'Скрыто'}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-slate-600">{item.sortOrder || 0}</td>
                        <td className="px-4 py-4">
                          <div className="flex items-center justify-end gap-2">
                            {videoSrc && (
                              <a
                                href={videoSrc}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 rounded-lg text-slate-500 hover:text-teal-600 hover:bg-teal-50"
                                aria-label="Открыть видео"
                              >
                                <Eye className="w-4 h-4" />
                              </a>
                            )}
                            <button
                              onClick={() => openEditModal(item)}
                              className="p-2 rounded-lg text-slate-500 hover:text-teal-600 hover:bg-teal-50"
                              aria-label="Редактировать"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(item)}
                              className="p-2 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50"
                              aria-label="Удалить"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
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

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingItem ? 'Редактировать видео' : 'Добавить видео'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsModalOpen(false)} disabled={isSaving}>
              Отмена
            </Button>
            <Button onClick={handleSave} isLoading={isSaving}>
              Сохранить
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <Input
            label="Название"
            value={form.title}
            onChange={(e) => setFormValue('title', e.target.value)}
            placeholder="Например: Как создать медицинскую заявку"
            required
          />
          <Textarea
            label="Описание"
            value={form.description}
            onChange={(e) => setFormValue('description', e.target.value)}
            placeholder="Короткое описание видео для пациента"
            rows={3}
          />
          <Input
            label="Ссылка на видео"
            value={form.videoUrl}
            onChange={(e) => {
              setFormValue('videoUrl', e.target.value)
              if (e.target.value.trim()) setFormValue('videoFile', null)
            }}
            placeholder="https://... или /guide/start.mp4"
          />

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">Файл видео</label>
              <label className="flex items-center justify-center gap-2 px-4 py-3 border border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-teal-400 hover:bg-teal-50/40">
                {uploadingVideoTarget === 'default' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                <span className="text-sm text-slate-600">
                  {getFileLabel(form.videoFile, 'Загрузить MP4/WebM/MOV')}
                </span>
                <input type="file" accept="video/mp4,video/webm,video/quicktime" className="hidden" onChange={(e) => handleVideoUpload(e)} />
              </label>
              {form.videoFile && (
                <button
                  type="button"
                  onClick={() => setFormValue('videoFile', null)}
                  className="text-sm text-rose-600 hover:text-rose-700"
                >
                  Убрать загруженное видео
                </button>
              )}
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">Обложка</label>
              <label className="flex items-center justify-center gap-2 px-4 py-3 border border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-teal-400 hover:bg-teal-50/40">
                {uploadingPosterTarget === 'default' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                <span className="text-sm text-slate-600">
                  {getFileLabel(form.poster, 'Загрузить изображение')}
                </span>
                <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => handlePosterUpload(e)} />
              </label>
              {form.poster && (
                <button
                  type="button"
                  onClick={() => setFormValue('poster', null)}
                  className="text-sm text-rose-600 hover:text-rose-700"
                >
                  Убрать обложку
                </button>
              )}
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl p-4 space-y-4">
            <div>
              <h3 className="font-semibold text-slate-900">Версии по языкам сайта</h3>
              <p className="text-sm text-slate-500 mt-1">
                Эти поля показываются пациенту вместо основного видео, когда выбран соответствующий язык.
              </p>
            </div>

            <div className="inline-flex flex-wrap gap-2 rounded-xl bg-slate-100 p-1">
              {languageOptions.map((language) => (
                <button
                  key={language.value}
                  type="button"
                  onClick={() => setActiveLanguage(language.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    activeLanguage === language.value
                      ? 'bg-white text-teal-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {language.label}
                </button>
              ))}
            </div>

            <Input
              label={`Название (${activeLanguageLabel})`}
              value={activeLocale.title || ''}
              onChange={(e) => setLocaleValue(activeLanguage, 'title', e.target.value)}
              placeholder="Локализованное название"
            />
            <Textarea
              label={`Описание (${activeLanguageLabel})`}
              value={activeLocale.description || ''}
              onChange={(e) => setLocaleValue(activeLanguage, 'description', e.target.value)}
              placeholder="Локализованное описание"
              rows={3}
            />
            <Input
              label={`Ссылка на видео (${activeLanguageLabel})`}
              value={activeLocale.videoUrl || ''}
              onChange={(e) => {
                setLocaleValue(activeLanguage, 'videoUrl', e.target.value)
                if (e.target.value.trim()) setLocaleValue(activeLanguage, 'videoFile', null)
              }}
              placeholder="https://... или /guide/start-ru.mp4"
            />

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">
                  Файл видео ({activeLanguageLabel})
                </label>
                <label className="flex items-center justify-center gap-2 px-4 py-3 border border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-teal-400 hover:bg-teal-50/40">
                  {uploadingVideoTarget === activeLanguage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  <span className="text-sm text-slate-600">
                    {getFileLabel(activeLocale.videoFile, 'Загрузить MP4/WebM/MOV')}
                  </span>
                  <input
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime"
                    className="hidden"
                    onChange={(e) => handleVideoUpload(e, activeLanguage)}
                  />
                </label>
                {activeLocale.videoFile && (
                  <button
                    type="button"
                    onClick={() => setLocaleValue(activeLanguage, 'videoFile', null)}
                    className="text-sm text-rose-600 hover:text-rose-700"
                  >
                    Убрать загруженное видео
                  </button>
                )}
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">
                  Обложка ({activeLanguageLabel})
                </label>
                <label className="flex items-center justify-center gap-2 px-4 py-3 border border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-teal-400 hover:bg-teal-50/40">
                  {uploadingPosterTarget === activeLanguage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  <span className="text-sm text-slate-600">
                    {getFileLabel(activeLocale.poster, 'Загрузить изображение')}
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => handlePosterUpload(e, activeLanguage)}
                  />
                </label>
                {activeLocale.poster && (
                  <button
                    type="button"
                    onClick={() => setLocaleValue(activeLanguage, 'poster', null)}
                    className="text-sm text-rose-600 hover:text-rose-700"
                  >
                    Убрать обложку
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <Select
              label="Иконка"
              value={form.icon}
              onChange={(e) => setFormValue('icon', e.target.value)}
              options={iconOptions}
            />
            <Input
              label="Порядок"
              type="number"
              value={form.sortOrder}
              onChange={(e) => setFormValue('sortOrder', e.target.value)}
            />
            <label className="flex items-center gap-3 pt-8">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setFormValue('isActive', e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
              />
              <span className="text-sm text-slate-700">Показывать пациентам</span>
            </label>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default AdminGuideVideos
