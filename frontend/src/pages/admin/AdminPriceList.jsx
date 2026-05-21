import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, Pencil, Plus, ReceiptText, Search, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import Select from '../../components/ui/Select'
import Textarea from '../../components/ui/Textarea'
import { normalizeResponse, priceItemsAPI } from '../../services/api'
import { formatPrice } from '../../utils/pricing'

const defaultForm = {
  title: '',
  category: '',
  description: '',
  price: '',
  currency: 'KZT',
  unit: '',
  badge: '',
  note: '',
  sortOrder: '',
  isActive: true,
  isFeatured: false,
}

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

function toPayload(form, fallbackOrder) {
  return {
    title: form.title.trim(),
    category: form.category.trim(),
    description: form.description?.trim() || '',
    price: Number(form.price) || 0,
    currency: form.currency || 'KZT',
    unit: form.unit?.trim() || '',
    badge: form.badge?.trim() || '',
    note: form.note?.trim() || '',
    sortOrder: Number(form.sortOrder) || fallbackOrder,
    isActive: Boolean(form.isActive),
    isFeatured: Boolean(form.isFeatured),
  }
}

function AdminPriceList() {
  const { t } = useTranslation()
  const [items, setItems] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState(defaultForm)

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
      item.title?.toLowerCase().includes(query) ||
      item.category?.toLowerCase().includes(query) ||
      item.description?.toLowerCase().includes(query),
    )
  }, [items, search])

  const openCreateModal = () => {
    setEditingItem(null)
    setForm({
      ...defaultForm,
      sortOrder: String((items?.length || 0) + 1),
    })
    setIsModalOpen(true)
  }

  const openEditModal = (item) => {
    setEditingItem(item)
    setForm({
      title: item.title || '',
      category: item.category || '',
      description: item.description || '',
      price: item.price !== undefined ? String(item.price) : '',
      currency: item.currency || 'KZT',
      unit: item.unit || '',
      badge: item.badge || '',
      note: item.note || '',
      sortOrder: item.sortOrder !== undefined ? String(item.sortOrder) : '',
      isActive: item.isActive !== false,
      isFeatured: Boolean(item.isFeatured),
    })
    setIsModalOpen(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()

    if (!form.title.trim() || !form.category.trim()) {
      alert(t('admin_price.err_required'))
      return
    }

    if (Number(form.price) < 0 || Number.isNaN(Number(form.price))) {
      alert(t('admin_price.err_price'))
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
      setForm(defaultForm)
      await loadData()
    } catch (error) {
      console.error('Error saving price item:', error)
      alert(t('admin_price.err_save'))
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (item) => {
    if (!item?.documentId) return

    const confirmed = window.confirm(t('admin_price.confirm_delete', { title: item.title }))
    if (!confirmed) return

    try {
      await priceItemsAPI.delete(item.documentId)
      await loadData()
    } catch (error) {
      console.error('Error deleting price item:', error)
      alert(t('admin_price.err_delete'))
    }
  }

  const setFormValue = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

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
                            <div className='font-medium text-slate-900'>{item.title}</div>
                            <div className='mt-1 max-w-lg truncate text-sm text-slate-500'>
                              {item.description || item.note || '—'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className='px-6 py-4 text-slate-600'>{item.category}</td>
                      <td className='px-6 py-4'>
                        <div className='font-semibold text-slate-900'>{formatPrice(item.price, item.currency)}</div>
                        <div className='text-xs text-slate-500'>/ {item.unit || t('admin_price.unit_default')}</div>
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
          <div className='grid gap-4 md:grid-cols-2'>
            <Input
              label={t('admin_price.label_title')}
              required
              value={form.title}
              onChange={(e) => setFormValue('title', e.target.value)}
              placeholder={t('admin_price.placeholder_title')}
            />
            <Input
              label={t('admin_price.label_category')}
              required
              value={form.category}
              onChange={(e) => setFormValue('category', e.target.value)}
              placeholder={t('admin_price.placeholder_category')}
            />
          </div>

          <Textarea
            label={t('admin_price.label_description')}
            rows={3}
            value={form.description}
            onChange={(e) => setFormValue('description', e.target.value)}
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
              value={form.unit}
              onChange={(e) => setFormValue('unit', e.target.value)}
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
              value={form.badge}
              onChange={(e) => setFormValue('badge', e.target.value)}
              placeholder={t('admin_price.placeholder_badge')}
            />
            <Textarea
              label={t('admin_price.label_note')}
              rows={2}
              value={form.note}
              onChange={(e) => setFormValue('note', e.target.value)}
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
