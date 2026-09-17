import { useCallback, useEffect, useState } from 'react'
import { Loader2, ShoppingCart } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { priceRequestsAPI } from '../../services/api'
import { formatPrice } from '../../utils/pricing'
import { useToast } from '../../components/ui/Toast'

const texts = {
  ru: { title: 'Запросы по прайсу', empty: 'Запросов пока нет.', note: 'Комментарий пациента', status: 'Статус', new: 'Новый', reviewing: 'В работе', contacted: 'Связались', closed: 'Закрыт', error: 'Не удалось загрузить запросы.', saveError: 'Не удалось изменить статус.' },
  en: { title: 'Service requests', empty: 'No requests yet.', note: 'Patient note', status: 'Status', new: 'New', reviewing: 'Reviewing', contacted: 'Contacted', closed: 'Closed', error: 'Could not load requests.', saveError: 'Could not update status.' },
  kk: { title: 'Қызмет сұраулары', empty: 'Сұраулар жоқ.', note: 'Пациент пікірі', status: 'Күйі', new: 'Жаңа', reviewing: 'Қаралуда', contacted: 'Байланысты', closed: 'Жабық', error: 'Сұраулар жүктелмеді.', saveError: 'Күйі өзгертілмеді.' },
}

export default function StaffPriceRequests() {
  const { i18n } = useTranslation()
  const t = texts[i18n.language?.split('-')[0]] || texts.ru
  const toast = useToast()
  const [items, setItems] = useState([])
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ pageCount: 0, total: 0 })
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await priceRequestsAPI.list(page)
      setItems(response.data?.data || [])
      setPagination(response.data?.meta?.pagination || { pageCount: 0, total: 0 })
      setFailed(false)
    } catch { setFailed(true) }
    finally { setLoading(false) }
  }, [page])
  useEffect(() => { load() }, [load])

  const changeStatus = async (item, status) => {
    try {
      await priceRequestsAPI.update(item.documentId, { status })
      setItems((current) => current.map((entry) => entry.documentId === item.documentId ? { ...entry, status } : entry))
    } catch { toast.error(t.saveError) }
  }

  return <div className='space-y-6'>
    <h1 className='flex items-center gap-2 text-2xl font-bold text-slate-900'><ShoppingCart className='h-6 w-6 text-teal-600' />{t.title} ({pagination.total})</h1>
    {loading ? <Loader2 className='h-7 w-7 animate-spin text-teal-600' /> : failed ? <p className='text-rose-600'>{t.error}</p> : items.length === 0 ? <p className='rounded-xl bg-white p-8 text-slate-500'>{t.empty}</p> :
      <div className='space-y-4'>{items.map((request) => <article key={request.documentId} className='rounded-2xl border border-slate-200 bg-white p-5 shadow-sm'>
        <div className='flex flex-wrap items-start justify-between gap-4'>
          <div><p className='font-semibold text-slate-900'>{request.patient?.fullName || request.patient?.email || 'Patient'}</p><p className='text-sm text-slate-500'>{request.patient?.email} {request.patient?.phone ? `· ${request.patient.phone}` : ''}</p><p className='mt-1 text-xs text-slate-400'>{new Date(request.createdAt).toLocaleString()}</p></div>
          <div className='text-right'><p className='text-lg font-bold text-slate-900'>{formatPrice(request.totalUSD, 'USD')}</p><label className='mt-2 block text-xs text-slate-500'>{t.status}<select value={request.status || 'new'} onChange={(event) => changeStatus(request, event.target.value)} className='mt-1 block rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm text-slate-800'>{['new', 'reviewing', 'contacted', 'closed'].map((status) => <option key={status} value={status}>{t[status]}</option>)}</select></label></div>
        </div>
        <ul className='mt-4 divide-y divide-slate-100 border-t border-slate-100'>{(request.items || []).map((service) => <li key={service.priceItemId} className='flex justify-between gap-3 py-2 text-sm'><span>{service.title}{service.tariffCode ? <small className='ml-2 text-slate-400'>{service.tariffCode}</small> : null}</span><strong>{formatPrice(service.priceUSD, 'USD')}</strong></li>)}</ul>
        {request.note && <p className='mt-3 rounded-lg bg-slate-50 p-3 text-sm'><strong>{t.note}: </strong>{request.note}</p>}
      </article>)}</div>}
    {pagination.pageCount > 1 && <div className='flex items-center justify-center gap-4 text-sm'><button disabled={page <= 1} onClick={() => setPage(page - 1)} className='rounded-lg border px-3 py-2 disabled:opacity-40'>←</button>{page} / {pagination.pageCount}<button disabled={page >= pagination.pageCount} onClick={() => setPage(page + 1)} className='rounded-lg border px-3 py-2 disabled:opacity-40'>→</button></div>}
  </div>
}
