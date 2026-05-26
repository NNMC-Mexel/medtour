import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, Pencil, Plus, ReceiptText, Search, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import Select from '../../components/ui/Select'
import Textarea from '../../components/ui/Textarea'
import { useToast } from '../../components/ui/Toast'
import { normalizeResponse, priceItemsAPI } from '../../services/api'
import { formatPrice } from '../../utils/pricing'
import { DEFAULT_CONTENT_LOCALE, SUPPORTED_LOCALES } from '../../utils/locales'

const defaultForm = {
  translations: {},
  price: '',
  currency: 'KZT',
  sortOrder: '',
  isActive: true,
  isFeatured: false,
}

const priceTextFields = ['title', 'category', 'description', 'unit', 'badge', 'note']

const currencyOptions = [
  { value: 'KZT', label: 'KZT' },
  { value: 'USD', label: 'USD' },
  { value: 'EUR', label: 'EUR' },
  { value: 'RUB', label: 'RUB' },
]

function sortItems(list) {
  return [...(list || [])].sort((a, b) => {
    const orderA = Number(a.sortOrder) || 0
    const orderB = Number(b.sortOrder) || 0
    if (orderA !== orderB) return orderA - orderB
    return (a.title || '').localeCompare(b.title || '', 'ru')
  })
}

function getEmptyTranslations() {
  return SUPPORTED_LOCALES.reduce((acc, locale) => {
    acc[locale.code] = priceTextFields.reduce((fields, field) => {
      fields[field] = ''
      return fields
    }, {})
    return acc
  }, {})
}

function getLocalizedField(item, field, lang) {
  return item?.i18n?.[lang]?.[field] || item?.[field] || ''
}

function normalizeItemTranslations(item) {
  const translations = getEmptyTranslations()
  SUPPORTED_LOCALES.forEach((locale) => {
    priceTextFields.forEach((field) => {
      translations[locale.code][field] = getLocalizedField(item, field, locale.code)
    })
  })
  return translations
}

function toPayload(form, fallbackOrder) {
  const translations = {
    ...getEmptyTranslations(),
    ...(form.translations || {}),
  }
  const baseTranslation =
    translations[DEFAULT_CONTENT_LOCALE] ||
    translations[SUPPORTED_LOCALES[0]?.code] ||
    {}

  return {
    title: baseTranslation.title.trim(),
    category: baseTranslation.category.trim(),
    description: baseTranslation.description?.trim() || '',
    price: Number(form.price) || 0,
    currency: form.currency || 'KZT',
    unit: baseTranslation.unit?.trim() || '',
    badge: baseTranslation.badge?.trim() || '',
    note: baseTranslation.note?.trim() || '',
    sortOrder: Number(form.sortOrder) || fallbackOrder,
    isActive: Boolean(form.isActive),
    isFeatured: Boolean(form.isFeatured),
    i18n: SUPPORTED_LOCALES.reduce((acc, locale) => {
      const source = translations[locale.code] || {}
      acc[locale.code] = priceTextFields.reduce((fields, field) => {
        fields[field] = source[field]?.trim() || ''
        return fields
      }, {})
      return acc
    }, {}),
  }
}

function AdminPriceList() {
  const { t } = useTranslation()
  const toast = useToast()
  const [items, setItems] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [activeLocale, setActiveLocale] = useState(DEFAULT_CONTENT_LOCALE)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({ ...defaultForm, translations: getEmptyTranslations() })

  const loadData = async () => {
    setIsLoading(true)
    try {
      const res = await priceItemsAPI.getAll({ includeInactive: true })
      const { data } = normalizeResponse(res)
      setItems(sortItems(data || []))
    } catch (error) {
      console.error('Error loading price list:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return items
    return items.filter((item) =>
      getLocalizedField(item, 'title', activeLocale)?.toLowerCase().includes(query) ||
      getLocalizedField(item, 'category', activeLocale)?.toLowerCase().includes(query) ||
      getLocalizedField(item, 'description', activeLocale)?.toLowerCase().includes(query),
    )
  }, [items, search, activeLocale])

  const openCreateModal = () => {
    setEditingItem(null)
    setForm({
      ...defaultForm,
      translations: getEmptyTranslations(),
      sortOrder: String((items?.length || 0) + 1),
    })
    setIsModalOpen(true)
  }

  const openEditModal = (item) => {
    setEditingItem(item)
    setForm({
      translations: normalizeItemTranslations(item),
      price: item.price !== undefined ? String(item.price) : '',
      currency: item.currency || 'KZT',
      sortOrder: item.sortOrder !== undefined ? String(item.sortOrder) : '',
      isActive: item.isActive !== false,
      isFeatured: Boolean(item.isFeatured),
    })
    setIsModalOpen(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()

    const baseTranslation = form.translations?.[DEFAULT_CONTENT_LOCALE] || {}
    if (!baseTranslation.title?.trim() || !baseTranslation.category?.trim()) {
      toast.warning(t('admin_price.err_required'))
      return
    }

    if (Number(form.price) < 0 || Number.isNaN(Number(form.price))) {
      toast.warning(t('admin_price.err_price'))
      return
    }

    setIsSaving(true)
    try {
      const payload = toPayload(form, (items?.length || 0) + 1)

      if (editingItem?.documentId) {
        await priceItemsAPI.update(editingItem.documentId, payload)
      } else {
        await priceItemsAPI.create(payload)
      }

      setIsModalOpen(false)
      setEditingItem(null)
      setForm({ ...defaultForm, translations: getEmptyTranslations() })
      await loadData()
      toast.success(editingItem ? t('admin_price.saved') : t('admin_price.created'))
    } catch (error) {
      console.error('Error saving price item:', error)
      toast.error(t('admin_price.err_save'))
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (item) => {
    if (!item?.documentId) return

    const confirmed = window.confirm(t('admin_price.confirm_delete', { title: getLocalizedField(item, 'title', activeLocale) }))
    if (!confirmed) return

    try {
      await priceItemsAPI.delete(item.documentId)
      await loadData()
      toast.success(t('admin_price.deleted'))
    } catch (error) {
      console.error('Error deleting price item:', error)
      toast.error(t('admin_price.err_delete'))
    }
  }

  const setFormValue = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const setTranslationValue = (key, value) => {
    setForm((prev) => ({
      ...prev,
      translations: {
        ...prev.translations,
        [activeLocale]: {
          ...(prev.translations?.[activeLocale] || {}),
          [key]: value,
        },
      },
    }))
  }

  const activeTranslation = form.translations?.[activeLocale] || {}

  if (isLoading) {
    return (
      <div className='flex items-center justify-center py-12'>
        <Loader2 className='h-8 w-8 animate-spin text-teal-600' />
      </div>
    )
  }

  return (
    <div className='space-y-6 animate-fadeIn'>
      <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <div>
          <h1 className='text-2xl font-bold text-slate-900'>{t('admin_price.title')}</h1>
          <p className='text-slate-600'>{t('admin_price.subtitle')}</p>
        </div>
        <Button leftIcon={<Plus className='h-4 w-4' />} onClick={openCreateModal}>
          {t('admin_price.add_btn')}
        </Button>
      </div>

      <div className='flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm'>
        {SUPPORTED_LOCALES.map((locale) => (
          <button
            key={locale.code}
            type='button'
            onClick={() => setActiveLocale(locale.code)}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              activeLocale === locale.code
                ? 'bg-teal-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            {locale.label}
          </button>
        ))}
      </div>

      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t('admin_price.search_placeholder')}
        leftIcon={<Search className='h-4 w-4' />}
      />

      <Card>
        <CardHeader>
          <CardTitle>{t('admin_price.list_title', { count: filteredItems.length })}</CardTitle>
        </CardHeader>
        <CardContent className='p-0'>
          <div className='overflow-x-auto'>
            <table className='w-full'>
              <thead>
                <tr className='border-b border-slate-200'>
                  <th className='px-6 py-4 text-left font-medium text-slate-500'>{t('admin_price.col_service')}</th>
                  <th className='px-6 py-4 text-left font-medium text-slate-500'>{t('admin_price.col_category')}</th>
                  <th className='px-6 py-4 text-left font-medium text-slate-500'>{t('admin_price.col_price')}</th>
                  <th className='px-6 py-4 text-left font-medium text-slate-500'>{t('admin_price.col_status')}</th>
                  <th className='px-6 py-4 text-right font-medium text-slate-500'>{t('admin_price.col_actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} className='py-10 text-center text-slate-500'>
                      {t('admin_price.not_found')}
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => (
                    <tr key={item.documentId || item.id} className='border-b border-slate-100 hover:bg-slate-50'>
                      <td className='px-6 py-4'>
                        <div className='flex items-start gap-3'>
                          <div className='mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700'>
                            <ReceiptText className='h-4 w-4' />
                          </div>
                          <div>
                            <div className='font-medium text-slate-900'>{getLocalizedField(item, 'title', activeLocale)}</div>
                            <div className='mt-1 max-w-lg truncate text-sm text-slate-500'>
                              {getLocalizedField(item, 'description', activeLocale) || getLocalizedField(item, 'note', activeLocale) || '—'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className='px-6 py-4 text-slate-600'>{getLocalizedField(item, 'category', activeLocale)}</td>
                      <td className='px-6 py-4'>
                        <div className='font-semibold text-slate-900'>{formatPrice(item.price, item.currency)}</div>
                        <div className='text-xs text-slate-500'>/ {getLocalizedField(item, 'unit', activeLocale) || t('admin_price.unit_default')}</div>
                      </td>
                      <td className='px-6 py-4'>
                        <div className='flex flex-wrap gap-2'>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${item.isActive !== false ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                            {item.isActive !== false ? t('admin_price.active') : t('admin_price.inactive')}
                          </span>
                          {item.isFeatured && (
                            <span className='rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700'>
                              {t('admin_price.featured')}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className='px-6 py-4'>
                        <div className='flex justify-end gap-2'>
                          <Button
                            size='icon'
                            variant='secondary'
                            onClick={() => openEditModal(item)}
                            aria-label={t('admin_price.edit_aria')}
                          >
                            <Pencil className='h-4 w-4' />
                          </Button>
                          <Button
                            size='icon'
                            variant='secondary'
                            onClick={() => handleDelete(item)}
                            aria-label={t('admin_price.delete_aria')}
                          >
                            <Trash2 className='h-4 w-4 text-rose-600' />
                          </Button>
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
        title={editingItem ? t('admin_price.modal_title_edit') : t('admin_price.modal_title_add')}
        size='xl'
        footer={
          <>
            <Button variant='secondary' onClick={() => setIsModalOpen(false)} disabled={isSaving}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSave} isLoading={isSaving}>
              {editingItem ? t('admin_price.save') : t('admin_price.create')}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSave} className='space-y-4'>
          <div className='flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-2'>
            {SUPPORTED_LOCALES.map((locale) => (
              <button
                key={locale.code}
                type='button'
                onClick={() => setActiveLocale(locale.code)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  activeLocale === locale.code
                    ? 'bg-white text-teal-700 shadow-sm'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900'
                }`}
              >
                {locale.label}
              </button>
            ))}
          </div>

          <div className='grid gap-4 md:grid-cols-2'>
            <Input
              label={t('admin_price.label_title')}
              required
              value={activeTranslation.title || ''}
              onChange={(e) => setTranslationValue('title', e.target.value)}
              placeholder={t('admin_price.placeholder_title')}
            />
            <Input
              label={t('admin_price.label_category')}
              required
              value={activeTranslation.category || ''}
              onChange={(e) => setTranslationValue('category', e.target.value)}
              placeholder={t('admin_price.placeholder_category')}
            />
          </div>

          <Textarea
            label={t('admin_price.label_description')}
            rows={3}
            value={activeTranslation.description || ''}
            onChange={(e) => setTranslationValue('description', e.target.value)}
            placeholder={t('admin_price.placeholder_description')}
          />

          <div className='grid gap-4 md:grid-cols-4'>
            <Input
              label={t('admin_price.label_price')}
              required
              type='number'
              min='0'
              step='0.01'
              value={form.price}
              onChange={(e) => setFormValue('price', e.target.value)}
            />
            <Select
              label={t('admin_price.label_currency')}
              value={form.currency}
              onChange={(e) => setFormValue('currency', e.target.value)}
              options={currencyOptions}
            />
            <Input
              label={t('admin_price.label_unit')}
              value={activeTranslation.unit || ''}
              onChange={(e) => setTranslationValue('unit', e.target.value)}
              placeholder={t('admin_price.placeholder_unit')}
            />
            <Input
              label={t('admin_price.label_order')}
              type='number'
              min='0'
              value={form.sortOrder}
              onChange={(e) => setFormValue('sortOrder', e.target.value)}
            />
          </div>

          <div className='grid gap-4 md:grid-cols-2'>
            <Input
              label={t('admin_price.label_badge')}
              value={activeTranslation.badge || ''}
              onChange={(e) => setTranslationValue('badge', e.target.value)}
              placeholder={t('admin_price.placeholder_badge')}
            />
            <Textarea
              label={t('admin_price.label_note')}
              rows={2}
              value={activeTranslation.note || ''}
              onChange={(e) => setTranslationValue('note', e.target.value)}
              placeholder={t('admin_price.placeholder_note')}
            />
          </div>

          <div className='flex flex-wrap gap-4 rounded-xl border border-slate-200 p-4'>
            <label className='inline-flex items-center gap-2 text-sm font-medium text-slate-700'>
              <input
                type='checkbox'
                checked={form.isActive}
                onChange={(e) => setFormValue('isActive', e.target.checked)}
                className='h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500'
              />
              {t('admin_price.label_active')}
            </label>
            <label className='inline-flex items-center gap-2 text-sm font-medium text-slate-700'>
              <input
                type='checkbox'
                checked={form.isFeatured}
                onChange={(e) => setFormValue('isFeatured', e.target.checked)}
                className='h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500'
              />
              {t('admin_price.label_featured')}
            </label>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default AdminPriceList
