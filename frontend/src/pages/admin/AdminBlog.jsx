import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Eye, FileText, Loader2, Pencil, Plus, Search, Star, Trash2, Upload } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import Select from '../../components/ui/Select'
import LocalizedFields from '../../components/admin/LocalizedFields'
import { useToast } from '../../components/ui/Toast'
import { BLOG_CATEGORIES, categoryLabel, localizePost } from '../../config/blog'
import { blogPostsAPI, getMediaUrl, uploadFile } from '../../services/api'

const COPY = {
  ru: {
    title: 'Блог / Статьи', subtitle: 'Статьи на странице «Блог / Статьи» сайта. Скрытые статьи на сайте не показываются.',
    add: 'Добавить статью', addTitle: 'Новая статья', editTitle: 'Редактировать статью', search: 'Поиск по заголовку',
    listTitle: 'Статьи', empty: 'Статей пока нет', loadError: 'Не удалось загрузить статьи',
    colArticle: 'Статья', colCategory: 'Рубрика', colStatus: 'Статус', colOrder: 'Порядок', colActions: 'Действия',
    active: 'На сайте', hidden: 'Скрыта', featured: 'Главная', noText: 'Только анонс',
    open: 'Открыть на сайте', edit: 'Редактировать', delete: 'Удалить', confirmDelete: 'Удалить статью «{title}»? Это действие нельзя отменить.',
    name: 'Заголовок', excerpt: 'Анонс', content: 'Текст статьи',
    markupHint: 'Разметка текста: «## Заголовок» — раздел, «### Подзаголовок», «- пункт» — список, «> текст» — выделенная заметка, **жирный**, [ссылка](https://…). Пустые строки ничего не значат. Без текста статья показывается только анонсом и ведёт к координатору.',
    category: 'Рубрика', readTime: 'Время чтения, мин', order: 'Порядок', orderHint: 'Меньше — выше в списке',
    slug: 'Адрес статьи', slugHint: 'Латиница, цифры и дефисы: /blog/<адрес>. Пусто — сформируется из заголовка.',
    cover: 'Обложка', uploadImage: 'Загрузить JPG/PNG/WebP', removeCover: 'Убрать обложку', coverUrl: 'или ссылка на картинку', coverUrlPlaceholder: 'https://… или /tourism/astana.jpg',
    showOnSite: 'Показывать на сайте', markFeatured: 'Главная статья (большая карточка вверху)',
    titleRequired: 'Введите заголовок на русском', saved: 'Статья сохранена', saveError: 'Не удалось сохранить статью',
    deleted: 'Статья удалена', deleteError: 'Не удалось удалить статью', uploaded: 'Обложка загружена', uploadError: 'Не удалось загрузить обложку',
    slugTaken: 'Этот адрес уже занят другой статьёй', slugInvalid: 'Адрес статьи: только латиница, цифры и дефисы, без пробелов', readTimeInvalid: 'Время чтения — целое число минут от 1 до 600', coverUrlInvalid: 'Ссылка на обложку должна начинаться с https:// или /', coverMissing: 'Загруженная обложка не найдена — загрузите её заново', tooLong: 'Текст слишком длинный',
    cancel: 'Отмена', save: 'Сохранить',
  },
  en: {
    title: 'Blog / Articles', subtitle: 'Articles on the site’s “Blog / Articles” page. Hidden articles are not shown on the site.',
    add: 'Add article', addTitle: 'New article', editTitle: 'Edit article', search: 'Search by title',
    listTitle: 'Articles', empty: 'No articles yet', loadError: 'Failed to load articles',
    colArticle: 'Article', colCategory: 'Category', colStatus: 'Status', colOrder: 'Order', colActions: 'Actions',
    active: 'Published', hidden: 'Hidden', featured: 'Featured', noText: 'Teaser only',
    open: 'Open on site', edit: 'Edit', delete: 'Delete', confirmDelete: 'Delete the article “{title}”? This cannot be undone.',
    name: 'Title', excerpt: 'Teaser', content: 'Article text',
    markupHint: 'Markup: “## Title” starts a section, “### Subheading”, “- item” is a list item, “> text” is a highlighted note, **bold**, [link](https://…). Blank lines are ignored. Without text the article is shown as a teaser that leads to a coordinator.',
    category: 'Category', readTime: 'Reading time, min', order: 'Order', orderHint: 'Lower comes first',
    slug: 'Article address', slugHint: 'Latin letters, digits and dashes: /blog/<address>. Leave empty to build it from the title.',
    cover: 'Cover', uploadImage: 'Upload JPG/PNG/WebP', removeCover: 'Remove cover', coverUrl: 'or image link', coverUrlPlaceholder: 'https://… or /tourism/astana.jpg',
    showOnSite: 'Show on site', markFeatured: 'Featured article (large card at the top)',
    titleRequired: 'Enter the title in Russian', saved: 'Article saved', saveError: 'Failed to save the article',
    deleted: 'Article deleted', deleteError: 'Failed to delete the article', uploaded: 'Cover uploaded', uploadError: 'Failed to upload the cover',
    slugTaken: 'This address is already used by another article', slugInvalid: 'Article address: Latin letters, digits and dashes only, no spaces', readTimeInvalid: 'Reading time must be a whole number of minutes from 1 to 600', coverUrlInvalid: 'The cover link must start with https:// or /', coverMissing: 'The uploaded cover was not found — upload it again', tooLong: 'The text is too long',
    cancel: 'Cancel', save: 'Save',
  },
  kk: {
    title: 'Блог / Мақалалар', subtitle: 'Сайттың «Блог / Мақалалар» бетіндегі мақалалар. Жасырын мақалалар сайтта көрсетілмейді.',
    add: 'Мақала қосу', addTitle: 'Жаңа мақала', editTitle: 'Мақаланы өңдеу', search: 'Тақырып бойынша іздеу',
    listTitle: 'Мақалалар', empty: 'Әзірге мақала жоқ', loadError: 'Мақалаларды жүктеу мүмкін болмады',
    colArticle: 'Мақала', colCategory: 'Айдар', colStatus: 'Күйі', colOrder: 'Реті', colActions: 'Әрекеттер',
    active: 'Сайтта', hidden: 'Жасырын', featured: 'Басты', noText: 'Тек анонс',
    open: 'Сайтта ашу', edit: 'Өңдеу', delete: 'Жою', confirmDelete: '«{title}» мақаласын жою керек пе? Бұл әрекетті қайтару мүмкін емес.',
    name: 'Тақырып', excerpt: 'Анонс', content: 'Мақала мәтіні',
    markupHint: 'Белгілеу: «## Тақырып» — бөлім, «### Тақырықша», «- тармақ» — тізім, «> мәтін» — ерекшеленген ескертпе, **қалың**, [сілтеме](https://…). Бос жолдар ескерілмейді. Мәтінсіз мақала тек анонс ретінде көрсетіледі және үйлестірушіге апарады.',
    category: 'Айдар', readTime: 'Оқу уақыты, мин', order: 'Реті', orderHint: 'Аз сан — тізімде жоғары',
    slug: 'Мақала мекенжайы', slugHint: 'Латын әріптері, цифрлар және сызықшалар: /blog/<мекенжай>. Бос болса — тақырыптан жасалады.',
    cover: 'Мұқаба', uploadImage: 'JPG/PNG/WebP жүктеу', removeCover: 'Мұқабаны алып тастау', coverUrl: 'немесе сурет сілтемесі', coverUrlPlaceholder: 'https://… немесе /tourism/astana.jpg',
    showOnSite: 'Сайтта көрсету', markFeatured: 'Басты мақала (жоғарыдағы үлкен карточка)',
    titleRequired: 'Тақырыпты орыс тілінде енгізіңіз', saved: 'Мақала сақталды', saveError: 'Мақаланы сақтау мүмкін болмады',
    deleted: 'Мақала жойылды', deleteError: 'Мақаланы жою мүмкін болмады', uploaded: 'Мұқаба жүктелді', uploadError: 'Мұқабаны жүктеу мүмкін болмады',
    slugTaken: 'Бұл мекенжайды басқа мақала қолданып тұр', slugInvalid: 'Мақала мекенжайы: тек латын әріптері, цифрлар және сызықшалар, бос орынсыз', readTimeInvalid: 'Оқу уақыты — 1-ден 600-ге дейінгі бүтін минут саны', coverUrlInvalid: 'Мұқаба сілтемесі https:// немесе / белгісінен басталуы керек', coverMissing: 'Жүктелген мұқаба табылмады — оны қайта жүктеңіз', tooLong: 'Мәтін тым ұзын',
    cancel: 'Болдырмау', save: 'Сақтау',
  },
}

const emptyForm = () => ({
  title: {}, excerpt: {}, content: {},
  slug: '', category: BLOG_CATEGORIES[0].id, readTime: '', sortOrder: '0',
  cover: null, coverUrl: '', isActive: true, isFeatured: false,
})

const formFromPost = (post) => ({
  title: { ...post.title }, excerpt: { ...post.excerpt }, content: { ...post.content },
  slug: post.slug || '', category: post.category || BLOG_CATEGORIES[0].id,
  readTime: post.readTime ? String(post.readTime) : '', sortOrder: String(post.sortOrder || 0),
  cover: post.cover || null, coverUrl: post.coverUrl || '', isActive: post.isActive !== false, isFeatured: Boolean(post.isFeatured),
})

// Ответы сервера (server/src/utils/blog-posts.ts, controllers/blog-post.ts) —
// по-английски; админу показываем их на языке интерфейса.
const SERVER_ERRORS = [
  [/slug is already used/, 'slugTaken'],
  [/^slug may contain/, 'slugInvalid'],
  [/^readTime/, 'readTimeInvalid'],
  [/^coverUrl/, 'coverUrlInvalid'],
  [/plugin::upload\.file/, 'coverMissing'],
  [/is longer than/, 'tooLong'],
  [/^title is required/, 'titleRequired'],
]

const saveErrorMessage = (error, copy) => {
  const message = String(error?.response?.data?.error?.message || '')
  const match = SERVER_ERRORS.find(([pattern]) => pattern.test(message))
  return match ? copy[match[1]] : copy.saveError
}

function AdminBlog() {
  const { i18n } = useTranslation()
  const lang = ['ru', 'en', 'kk'].includes(i18n.language) ? i18n.language : 'ru'
  const copy = COPY[lang]
  const toast = useToast()
  const [items, setItems] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [search, setSearch] = useState('')

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await blogPostsAPI.manage()
      setItems(response.data?.data || [])
    } catch (error) {
      console.error('Error loading blog posts:', error)
      toast.error(copy.loadError)
    } finally {
      setIsLoading(false)
    }
  }, [copy.loadError, toast])

  useEffect(() => { loadData() }, [loadData])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return items
    return items.filter((item) => Object.values(item.title || {}).some((text) => String(text).toLowerCase().includes(query)))
  }, [items, search])

  const setField = (field, value) => setForm((current) => ({ ...current, [field]: value }))

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm())
    setIsModalOpen(true)
  }

  const openEdit = (item) => {
    setEditing(item)
    setForm(formFromPost(item))
    setIsModalOpen(true)
  }

  const handleCoverUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setIsUploading(true)
    try {
      setField('cover', await uploadFile(file))
      toast.success(copy.uploaded)
    } catch (error) {
      toast.error(error.message || copy.uploadError)
    } finally {
      setIsUploading(false)
      event.target.value = ''
    }
  }

  const handleSave = async () => {
    if (!String(form.title.ru || '').trim()) {
      toast.warning(copy.titleRequired)
      return
    }
    const payload = {
      title: form.title, excerpt: form.excerpt, content: form.content,
      slug: form.slug.trim().toLowerCase(), category: form.category,
      readTime: form.readTime === '' ? null : Number(form.readTime),
      sortOrder: Number(form.sortOrder) || 0,
      cover: form.cover?.id || null, coverUrl: form.coverUrl.trim(),
      isActive: form.isActive, isFeatured: form.isFeatured,
    }
    setIsSaving(true)
    try {
      if (editing) await blogPostsAPI.update(editing.documentId, payload)
      else await blogPostsAPI.create(payload)
      toast.success(copy.saved)
      setIsModalOpen(false)
      await loadData()
    } catch (error) {
      console.error('Error saving blog post:', error)
      toast.error(saveErrorMessage(error, copy))
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (item) => {
    const title = localizePost(item, lang).title
    if (!window.confirm(copy.confirmDelete.replace('{title}', title))) return
    try {
      await blogPostsAPI.delete(item.documentId)
      toast.success(copy.deleted)
      await loadData()
    } catch (error) {
      console.error('Error deleting blog post:', error)
      toast.error(copy.deleteError)
    }
  }

  const coverPreview = form.cover ? getMediaUrl(form.cover) : form.coverUrl.trim()

  return (
    <div className='space-y-6'>
      <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <div>
          <h1 className='text-2xl font-bold text-slate-900'>{copy.title}</h1>
          <p className='text-slate-600'>{copy.subtitle}</p>
        </div>
        <Button leftIcon={<Plus className='h-4 w-4' />} onClick={openCreate}>{copy.add}</Button>
      </div>

      <div className='relative max-w-md'>
        <Search className='absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400' />
        <input
          type='text'
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={copy.search}
          className='w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-teal-500'
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{copy.listTitle} ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className='flex items-center justify-center py-12'><Loader2 className='h-8 w-8 animate-spin text-teal-600' /></div>
          ) : filtered.length === 0 ? (
            <div className='py-12 text-center text-slate-500'>
              <FileText className='mx-auto mb-3 h-12 w-12 text-slate-300' />
              {copy.empty}
            </div>
          ) : (
            <div className='overflow-x-auto'>
              <table className='w-full text-sm'>
                <thead>
                  <tr className='border-b border-slate-100'>
                    <th className='px-4 py-3 text-left font-medium text-slate-500'>{copy.colArticle}</th>
                    <th className='px-4 py-3 text-left font-medium text-slate-500'>{copy.colCategory}</th>
                    <th className='px-4 py-3 text-left font-medium text-slate-500'>{copy.colStatus}</th>
                    <th className='px-4 py-3 text-left font-medium text-slate-500'>{copy.colOrder}</th>
                    <th className='px-4 py-3 text-right font-medium text-slate-500'>{copy.colActions}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => {
                    const view = localizePost(item, lang, getMediaUrl)
                    return (
                      <tr key={item.documentId} className='border-b border-slate-50'>
                        <td className='px-4 py-4'>
                          <div className='flex items-center gap-3'>
                            <div className='h-12 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-100'>
                              {view.image && <img src={view.image} alt='' className='h-full w-full object-cover' />}
                            </div>
                            <div className='min-w-0'>
                              <div className='font-semibold text-slate-900'>{view.title}</div>
                              <div className='max-w-md truncate text-xs text-slate-500'>/blog/{item.slug}{!item.hasContent && ` · ${copy.noText}`}</div>
                            </div>
                          </div>
                        </td>
                        <td className='px-4 py-4 text-slate-600'>{categoryLabel(item.category, lang)}</td>
                        <td className='px-4 py-4'>
                          <div className='flex flex-wrap gap-1.5'>
                            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${item.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                              {item.isActive ? copy.active : copy.hidden}
                            </span>
                            {item.isFeatured && (
                              <span className='inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700'>
                                <Star className='h-3 w-3' />{copy.featured}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className='px-4 py-4 text-slate-600'>{item.sortOrder}</td>
                        <td className='px-4 py-4'>
                          <div className='flex items-center justify-end gap-2'>
                            {item.isActive && (
                              <a
                                href={item.hasContent ? `/blog/${item.slug}` : '/blog'}
                                target='_blank'
                                rel='noopener noreferrer'
                                className='rounded-lg p-2 text-slate-500 hover:bg-teal-50 hover:text-teal-600'
                                aria-label={copy.open}
                                title={copy.open}
                              >
                                <Eye className='h-4 w-4' />
                              </a>
                            )}
                            <button type='button' onClick={() => openEdit(item)} className='rounded-lg p-2 text-slate-500 hover:bg-teal-50 hover:text-teal-600' aria-label={copy.edit} title={copy.edit}>
                              <Pencil className='h-4 w-4' />
                            </button>
                            <button type='button' onClick={() => handleDelete(item)} className='rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600' aria-label={copy.delete} title={copy.delete}>
                              <Trash2 className='h-4 w-4' />
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
        title={editing ? copy.editTitle : copy.addTitle}
        size='xl'
        footer={
          <>
            <Button variant='secondary' onClick={() => setIsModalOpen(false)} disabled={isSaving}>{copy.cancel}</Button>
            <Button onClick={handleSave} isLoading={isSaving}>{copy.save}</Button>
          </>
        }
      >
        <div className='space-y-5'>
          <LocalizedFields
            fields={[
              { key: 'title', label: copy.name, required: true, maxLength: 300 },
              { key: 'excerpt', label: copy.excerpt, multiline: true, rows: 3, maxLength: 1000 },
              { key: 'content', label: copy.content, multiline: true, rows: 14 },
            ]}
            getValue={(locale, key) => form[key]?.[locale] || ''}
            setValue={(locale, key, value) => setForm((current) => ({ ...current, [key]: { ...current[key], [locale]: value } }))}
          />
          <p className='-mt-2 text-xs leading-5 text-slate-500'>{copy.markupHint}</p>

          <div className='grid gap-4 md:grid-cols-3'>
            <Select
              label={copy.category}
              value={form.category}
              onChange={(event) => setField('category', event.target.value)}
              options={BLOG_CATEGORIES.map((item) => ({ value: item.id, label: item.label[lang] }))}
            />
            <Input label={copy.readTime} type='number' min='1' value={form.readTime} onChange={(event) => setField('readTime', event.target.value)} />
            <Input label={copy.order} type='number' value={form.sortOrder} hint={copy.orderHint} onChange={(event) => setField('sortOrder', event.target.value)} />
          </div>

          <Input label={copy.slug} value={form.slug} hint={copy.slugHint} placeholder='burabay-in-one-day' onChange={(event) => setField('slug', event.target.value)} />

          <div className='grid gap-4 md:grid-cols-[1fr_160px]'>
            <div className='space-y-3'>
              <label className='block text-sm font-medium text-slate-700'>{copy.cover}</label>
              <label className='flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-3 hover:border-teal-400 hover:bg-teal-50/40'>
                {isUploading ? <Loader2 className='h-4 w-4 animate-spin' /> : <Upload className='h-4 w-4' />}
                <span className='text-sm text-slate-600'>{form.cover?.name || copy.uploadImage}</span>
                <input type='file' accept='image/jpeg,image/png,image/webp' className='hidden' onChange={handleCoverUpload} />
              </label>
              {form.cover ? (
                <button type='button' onClick={() => setField('cover', null)} className='text-sm text-rose-600 hover:text-rose-700'>{copy.removeCover}</button>
              ) : (
                <Input label={copy.coverUrl} value={form.coverUrl} placeholder={copy.coverUrlPlaceholder} onChange={(event) => setField('coverUrl', event.target.value)} />
              )}
            </div>
            <div className='h-28 overflow-hidden rounded-xl bg-slate-100 md:mt-7'>
              {coverPreview && <img src={coverPreview} alt='' className='h-full w-full object-cover' />}
            </div>
          </div>

          <div className='flex flex-col gap-3 sm:flex-row sm:gap-8'>
            <label className='flex items-center gap-3'>
              <input type='checkbox' checked={form.isActive} onChange={(event) => setField('isActive', event.target.checked)} className='h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500' />
              <span className='text-sm text-slate-700'>{copy.showOnSite}</span>
            </label>
            <label className='flex items-center gap-3'>
              <input type='checkbox' checked={form.isFeatured} onChange={(event) => setField('isFeatured', event.target.checked)} className='h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500' />
              <span className='text-sm text-slate-700'>{copy.markFeatured}</span>
            </label>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default AdminBlog
