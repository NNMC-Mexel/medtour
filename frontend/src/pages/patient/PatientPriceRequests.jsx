import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, Loader2, RefreshCw, ShoppingCart } from 'lucide-react'
import { priceRequestsAPI } from '../../services/api'
import { formatPrice } from '../../utils/pricing'

const copy = {
  ru: {
    title: 'Отправленные корзины', subtitle: 'Ваши запросы по прайскуранту, отправленные менеджеру.',
    browse: 'Вернуться к прайскуранту', empty: 'Вы пока не отправляли корзину с услугами.',
    loadError: 'Не удалось загрузить отправленные корзины.', retry: 'Повторить', refresh: 'Обновить статусы',
    sentOn: 'Отправлено', services: 'Услуг', note: 'Ваш комментарий', estimated: 'Ориентировочная сумма',
    previous: 'Назад', next: 'Далее',
    statuses: { new: 'Отправлено', reviewing: 'В работе', contacted: 'Менеджер связался', closed: 'Закрыто' },
  },
  en: {
    title: 'Sent baskets', subtitle: 'Your service requests sent to a manager.',
    browse: 'Back to the price list', empty: 'You have not sent a service basket yet.',
    loadError: 'Could not load your sent baskets.', retry: 'Retry', refresh: 'Refresh statuses',
    sentOn: 'Sent', services: 'Services', note: 'Your note', estimated: 'Estimated total',
    previous: 'Previous', next: 'Next',
    statuses: { new: 'Sent', reviewing: 'Reviewing', contacted: 'Manager contacted you', closed: 'Closed' },
  },
  kk: {
    title: 'Жіберілген себеттер', subtitle: 'Менеджерге жіберген қызмет сұрауларыңыз.',
    browse: 'Бағалар тізіміне оралу', empty: 'Сіз әлі қызмет себетін жібермедіңіз.',
    loadError: 'Жіберілген себеттер жүктелмеді.', retry: 'Қайталау', refresh: 'Күйлерді жаңарту',
    sentOn: 'Жіберілді', services: 'Қызметтер', note: 'Сіздің пікіріңіз', estimated: 'Шамамен жалпы сома',
    previous: 'Артқа', next: 'Келесі',
    statuses: { new: 'Жіберілді', reviewing: 'Қаралуда', contacted: 'Менеджер хабарласты', closed: 'Жабылды' },
  },
}

const statusStyles = {
  new: 'bg-sky-50 text-sky-700',
  reviewing: 'bg-amber-50 text-amber-700',
  contacted: 'bg-teal-50 text-teal-700',
  closed: 'bg-slate-100 text-slate-700',
}

function PatientPriceRequests() {
  const { i18n } = useTranslation()
  const language = i18n.language?.split('-')[0] || 'ru'
  const labels = copy[language] || copy.ru
  const locale = { ru: 'ru-RU', en: 'en-US', kk: 'kk-KZ' }[language] || 'ru-RU'
  const [page, setPage] = useState(1)
  const [refreshKey, setRefreshKey] = useState(0)
  const [requests, setRequests] = useState([])
  const [pagination, setPagination] = useState({ pageCount: 0, total: 0 })
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    priceRequestsAPI.list(page)
      .then(({ data }) => {
        if (!active) return
        setRequests(data?.data || [])
        setPagination(data?.meta?.pagination || { pageCount: 0, total: 0 })
        setFailed(false)
      })
      .catch(() => { if (active) setFailed(true) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [page, refreshKey])

  const reload = () => { setLoading(true); setRefreshKey((current) => current + 1) }
  const changePage = (nextPage) => { setLoading(true); setPage(nextPage) }

  return <div className='mx-auto max-w-5xl space-y-6'>
    <div className='flex flex-wrap items-start justify-between gap-4'>
      <div>
        <h1 className='flex items-center gap-2 text-2xl font-bold text-slate-900'><ShoppingCart className='h-6 w-6 text-teal-600' />{labels.title}</h1>
        <p className='mt-2 text-sm text-slate-600'>{labels.subtitle}</p>
      </div>
      <div className='flex flex-wrap gap-2'>
        <Link to='/patient/prices' className='rounded-xl border border-teal-200 bg-white px-4 py-2 text-sm font-semibold text-teal-700 hover:bg-teal-50'>{labels.browse}</Link>
        <button type='button' onClick={reload} disabled={loading} className='inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50'><RefreshCw className='h-4 w-4' />{labels.refresh}</button>
      </div>
    </div>

    {loading ? <div className='flex justify-center py-16'><Loader2 className='h-8 w-8 animate-spin text-teal-600' /></div> : failed ?
      <div className='rounded-2xl border border-rose-200 bg-white p-8 text-center text-rose-700'><p>{labels.loadError}</p><button type='button' onClick={reload} className='mt-3 font-semibold underline'>{labels.retry}</button></div> :
      requests.length === 0 ? <div className='rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-600'>{labels.empty}</div> :
        <div className='space-y-4'>{requests.map((request) => <article key={request.documentId} className='rounded-2xl border border-slate-200 bg-white p-5 shadow-sm'>
          <div className='flex flex-wrap items-start justify-between gap-3'>
            <div>
              <h2 className='font-semibold text-slate-900'>{labels.sentOn} {new Date(request.createdAt).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })}</h2>
              <p className='mt-1 text-sm text-slate-500'>{labels.services}: {(request.items || []).length}</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-sm font-semibold ${statusStyles[request.status] || statusStyles.new}`}>{labels.statuses[request.status] || labels.statuses.new}</span>
          </div>
          <ul className='mt-4 divide-y divide-slate-100 border-t border-slate-100'>{(request.items || []).map((service, index) => <li key={`${service.priceItemId}-${index}`} className='flex flex-wrap items-start justify-between gap-2 py-3 text-sm'>
            <div className='min-w-0 flex-1'><p className='break-words text-slate-800'>{service.title}</p>{service.tariffCode && <p className='text-xs text-slate-400'>{service.tariffCode}</p>}</div>
            <strong className='whitespace-nowrap text-slate-900'>{formatPrice(service.priceUSD, 'USD')}</strong>
          </li>)}</ul>
          {request.note && <p className='mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700'><strong>{labels.note}: </strong>{request.note}</p>}
          <div className='mt-4 border-t border-slate-100 pt-4 text-right'><p className='text-xs text-slate-500'>{labels.estimated}</p><p className='text-xl font-bold text-slate-900'>{formatPrice(request.totalUSD, 'USD')}</p></div>
        </article>)}</div>}

    {!loading && !failed && pagination.pageCount > 1 && <nav className='flex items-center justify-center gap-4 text-sm' aria-label={labels.title}>
      <button type='button' disabled={page <= 1} onClick={() => changePage(page - 1)} className='inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 disabled:opacity-40'><ChevronLeft className='h-4 w-4' />{labels.previous}</button>
      <span>{page} / {pagination.pageCount}</span>
      <button type='button' disabled={page >= pagination.pageCount} onClick={() => changePage(page + 1)} className='inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 disabled:opacity-40'>{labels.next}<ChevronRight className='h-4 w-4' /></button>
    </nav>}
  </div>
}

export default PatientPriceRequests
