import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, ChevronLeft, ChevronRight, Loader2, ReceiptText, Search, ShoppingCart, Trash2 } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import Button from '../ui/Button'
import { Card, CardContent } from '../ui/Card'
import { priceItemsAPI, priceRequestsAPI } from '../../services/api'
import { formatPrice } from '../../utils/pricing'
import useAuthStore from '../../stores/authStore'
import { useToast } from '../ui/Toast'

const copy = {
  ru: { all: 'Все услуги', checkup: 'Check-up и пакеты', analysis: 'Анализы', service: 'Другие услуги', search: 'Поиск услуги или кода', category: 'Все направления', add: 'В корзину', remove: 'Убрать', cart: 'Моя корзина', emptyCart: 'Выберите услуги, чтобы отправить запрос менеджеру.', note: 'Комментарий менеджеру (необязательно)', send: 'Отправить менеджеру', sent: 'Запрос отправлен менеджеру', signIn: 'Войдите как пациент, чтобы отправить запрос. Корзина сохранится.', max: 'Можно выбрать до 50 услуг.', estimate: 'Ориентировочная сумма. Менеджер уточнит состав и стоимость.', changed: 'Состав или цены услуг обновились. Проверьте корзину и отправьте запрос ещё раз.', previous: 'Назад', next: 'Далее', result: 'Найдено услуг', loadError: 'Не удалось загрузить прайс.', noResults: 'Услуги не найдены.', sendError: 'Не удалось отправить запрос.' },
  en: { all: 'All services', checkup: 'Check-ups and packages', analysis: 'Lab tests', service: 'Other services', search: 'Search by service or code', category: 'All specialties', add: 'Add to basket', remove: 'Remove', cart: 'My basket', emptyCart: 'Choose services to send a request to a manager.', note: 'Note for the manager (optional)', send: 'Send to manager', sent: 'Request sent to a manager', signIn: 'Sign in as a patient to send your request. Your basket will be saved.', max: 'Choose up to 50 services.', estimate: 'Estimated total. A manager will confirm the services and prices.', changed: 'Services or prices changed. Review your basket and send again.', previous: 'Previous', next: 'Next', result: 'Services found', loadError: 'Could not load prices.', noResults: 'No services found.', sendError: 'Could not send your request.' },
  kk: { all: 'Барлық қызметтер', checkup: 'Check-up және пакеттер', analysis: 'Талдаулар', service: 'Басқа қызметтер', search: 'Қызмет немесе код бойынша іздеу', category: 'Барлық бағыттар', add: 'Себетке', remove: 'Алып тастау', cart: 'Менің себетім', emptyCart: 'Менеджерге жіберу үшін қызметтерді таңдаңыз.', note: 'Менеджерге пікір (міндетті емес)', send: 'Менеджерге жіберу', sent: 'Сұрау менеджерге жіберілді', signIn: 'Сұрауды жіберу үшін пациент ретінде кіріңіз. Себет сақталады.', max: '50 қызметке дейін таңдауға болады.', estimate: 'Шамамен есептелген сома. Менеджер қызметтер мен бағаларды нақтылайды.', changed: 'Қызметтер немесе бағалар өзгерді. Себетті тексеріп, қайта жіберіңіз.', previous: 'Артқа', next: 'Келесі', result: 'Табылған қызметтер', loadError: 'Бағалар жүктелмеді.', noResults: 'Қызмет табылмады.', sendError: 'Сұрау жіберілмеді.' },
}

const categoryTranslations = {
  'Консультации специалистов': { en: 'Specialist consultations', kk: 'Маман кеңестері' },
  'Онлайн-консультации': { en: 'Online consultations', kk: 'Онлайн кеңестер' },
  'Амбулаторные услуги': { en: 'Outpatient services', kk: 'Амбулаториялық қызметтер' },
  'Эндоскопия': { en: 'Endoscopy', kk: 'Эндоскопия' },
  'Реабилитация': { en: 'Rehabilitation', kk: 'Оңалту' },
  'Лучевая и УЗ-диагностика': { en: 'Imaging and ultrasound', kk: 'Сәулелік және УДЗ диагностикасы' },
  'Лабораторные анализы': { en: 'Laboratory tests', kk: 'Зертханалық талдаулар' },
  'Трансфузиология': { en: 'Transfusion medicine', kk: 'Трансфузиология' },
  'Патоморфология': { en: 'Pathology', kk: 'Патоморфология' },
  'Лечение и операции': { en: 'Treatment and surgery', kk: 'Емдеу және операциялар' },
  'Стационар и другие услуги': { en: 'Inpatient and other services', kk: 'Стационар және басқа қызметтер' },
  'Дополнительные услуги': { en: 'Additional services', kk: 'Қосымша қызметтер' },
}

function categoryLabel(value, language) {
  return categoryTranslations[value]?.[language] || value
}

function localized(item, key, language) {
  return item?.i18n?.[language]?.[key] || item?.i18n?.ru?.[key] || item?.[key] || ''
}

function readBasket() {
  try {
    const parsed = JSON.parse(localStorage.getItem('medtour-price-basket') || '[]')
    return Array.isArray(parsed) ? parsed.filter((item) => /^[a-zA-Z0-9_-]{1,80}$/.test(item?.documentId || '')).slice(0, 50) : []
  } catch { return [] }
}

async function currentBasket(basket) {
  const ids = basket.map((item) => item.documentId).join(',')
  const response = await priceItemsAPI.catalog({ ids, pageSize: 50 })
  const byId = new Map((response.data?.data || []).map((item) => [item.documentId, item]))
  return basket.map((item) => byId.get(item.documentId)).filter(Boolean)
    .map((item) => ({ documentId: item.documentId, title: item.title, price: Number(item.price) }))
}

function basketChanged(previous, current) {
  return previous.length !== current.length || previous.some((item, index) =>
    item.documentId !== current[index]?.documentId || item.title !== current[index]?.title || Number(item.price) !== current[index]?.price)
}

function PriceListSection({ compact = false, limit, featuredOnly = false, showCta = false, ctaTo = '/prices', ctaLabel, className = '' }) {
  const { t, i18n } = useTranslation()
  const language = i18n.language?.split('-')[0] || 'ru'
  const labels = copy[language] || copy.ru
  const navigate = useNavigate()
  const toast = useToast()
  const user = useAuthStore((state) => state.user)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const [items, setItems] = useState([])
  const [categories, setCategories] = useState([])
  const [pagination, setPagination] = useState({ page: 1, pageCount: 0, total: 0 })
  const [page, setPage] = useState(1)
  const [section, setSection] = useState('all')
  const [category, setCategory] = useState('all')
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [basket, setBasket] = useState(readBasket)
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [sending, setSending] = useState(false)

  useEffect(() => { const timeout = setTimeout(() => setQuery(search.trim()), 250); return () => clearTimeout(timeout) }, [search])
  useEffect(() => { localStorage.setItem('medtour-price-basket', JSON.stringify(basket)) }, [basket])
  useEffect(() => {
    if (!basket.length) return
    let alive = true
    currentBasket(basket).then((current) => {
      if (alive && basketChanged(basket, current)) {
        setBasket(current)
        toast.warning(labels.changed)
      }
    }).catch(() => {})
    return () => { alive = false }
  }, [basket, labels.changed, toast])
  useEffect(() => {
    let alive = true
    setLoading(true)
    priceItemsAPI.catalog({ page, pageSize: limit || (compact ? 6 : 24), featuredOnly, section, category, search: query })
      .then(({ data }) => {
        if (!alive) return
        setItems(data.data || [])
        setCategories(data.meta?.categories || [])
        setPagination(data.meta?.pagination || { page, pageCount: 0, total: 0 })
        setFailed(false)
      })
      .catch(() => { if (alive) { setFailed(true); setItems([]) } })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [page, limit, compact, featuredOnly, section, category, query])

  const selected = useMemo(() => new Set(basket.map((item) => item.documentId)), [basket])
  const total = basket.reduce((sum, item) => sum + Number(item.price || 0), 0)
  const choose = (item) => {
    if (selected.has(item.documentId)) {
      setBasket((current) => current.filter((entry) => entry.documentId !== item.documentId))
    } else if (basket.length >= 50) {
      toast.warning(labels.max)
    } else {
      setBasket((current) => [...current, { documentId: item.documentId, title: item.title, price: Number(item.price) }])
    }
  }
  const send = async () => {
    if (!isAuthenticated || user?.userRole !== 'patient') {
      toast.warning(labels.signIn)
      if (!isAuthenticated) navigate('/login')
      return
    }
    setSending(true)
    try {
      const current = await currentBasket(basket)
      if (basketChanged(basket, current)) {
        setBasket(current)
        toast.warning(labels.changed)
        return
      }
      const response = await priceRequestsAPI.create(basket.map((item) => item.documentId), note)
      if (Math.abs(Number(response.data?.data?.totalUSD) - total) > 0.01) toast.warning(labels.changed)
      setBasket([])
      setNote('')
      toast.success(labels.sent)
    } catch (error) {
      toast.error(error?.response?.data?.error?.message || labels.sendError)
    } finally { setSending(false) }
  }
  const changeSection = (value) => { setSection(value); setCategory('all'); setPage(1) }
  const changeCategory = (value) => { setCategory(value); setPage(1) }

  return (
    <section id={compact ? undefined : 'prices'} className={`${compact ? 'space-y-4' : 'bg-slate-50 py-16'} ${className}`}>
      <div className={compact ? '' : 'mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'}>
        <div className='mb-8'>
          <span className='inline-flex items-center gap-2 rounded-full bg-teal-100 px-4 py-1 text-sm font-medium text-teal-700'><ReceiptText className='h-4 w-4' />{t('pricing.badge')}</span>
          <h2 className={`${compact ? 'mt-3 text-xl' : 'mt-4 text-3xl sm:text-4xl'} font-bold text-slate-900`}>{compact ? t('pricing.patient_title') : t('pricing.title')}</h2>
          <p className='mt-3 text-slate-600'>{compact ? t('pricing.patient_subtitle') : t('pricing.subtitle')}</p>
          <p className='mt-2 text-sm font-semibold text-teal-700'>USD</p>
        </div>

        {!compact && <div className='mb-7 space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm'>
          <div className='flex flex-wrap gap-2' role='group' aria-label={labels.all}>
            {['all', 'checkup', 'analysis', 'service'].map((value) => <button key={value} type='button' onClick={() => changeSection(value)} className={`rounded-full px-4 py-2 text-sm font-medium ${section === value ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>{labels[value]}</button>)}
          </div>
          <div className='grid gap-3 sm:grid-cols-2'>
            <label className='relative block'><Search className='absolute left-3 top-3 h-5 w-5 text-slate-400' /><span className='sr-only'>{labels.search}</span><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder={labels.search} className='w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-3 outline-none focus:border-teal-500' /></label>
            <label><span className='sr-only'>{labels.category}</span><select value={category} onChange={(event) => changeCategory(event.target.value)} className='w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-teal-500'><option value='all'>{labels.category}</option>{categories.map((value) => <option key={value} value={value}>{categoryLabel(value, language)}</option>)}</select></label>
          </div>
        </div>}

        {!compact && <p className='mb-4 text-sm text-slate-500'>{labels.result}: {pagination.total}</p>}
        {loading ? <div className='flex justify-center py-16'><Loader2 className='h-8 w-8 animate-spin text-teal-600' /></div> : failed ? <p className='rounded-xl bg-white p-8 text-center text-slate-500'>{labels.loadError}</p> : items.length === 0 ? <p className='rounded-xl bg-white p-8 text-center text-slate-500'>{labels.noResults}</p> :
          <div className={`grid gap-4 ${compact ? 'md:grid-cols-2' : 'md:grid-cols-2 lg:grid-cols-3'}`}>
            {items.map((item) => <Card key={item.documentId} className='border-slate-200 shadow-sm'><CardContent className='flex h-full flex-col p-5'>
              <p className='mb-2 text-xs font-medium text-teal-700'>{categoryLabel(localized(item, 'category', language), language)}</p>
              <h3 className='flex-1 font-semibold text-slate-900'>{localized(item, 'title', language)}</h3>
              {item.tariffCode && <p className='mt-2 text-xs text-slate-400'>{item.tariffCode}</p>}
              <div className='mt-4 flex items-center justify-between gap-2'><span className='text-xl font-bold text-slate-900'>{formatPrice(item.price, 'USD')}</span>{!compact && <button type='button' onClick={() => choose(item)} className={`inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium ${selected.has(item.documentId) ? 'bg-teal-50 text-teal-700' : 'bg-teal-600 text-white hover:bg-teal-700'}`}>{selected.has(item.documentId) ? <Check className='h-4 w-4' /> : <ShoppingCart className='h-4 w-4' />}{selected.has(item.documentId) ? labels.remove : labels.add}</button>}</div>
            </CardContent></Card>)}
          </div>}

        {!compact && pagination.pageCount > 1 && <nav className='mt-8 flex items-center justify-center gap-4' aria-label='Pagination'><button type='button' disabled={page <= 1} onClick={() => setPage(page - 1)} className='inline-flex items-center gap-1 rounded-lg border px-3 py-2 disabled:opacity-40'><ChevronLeft className='h-4 w-4' />{labels.previous}</button><span className='text-sm text-slate-600'>{page} / {pagination.pageCount}</span><button type='button' disabled={page >= pagination.pageCount} onClick={() => setPage(page + 1)} className='inline-flex items-center gap-1 rounded-lg border px-3 py-2 disabled:opacity-40'>{labels.next}<ChevronRight className='h-4 w-4' /></button></nav>}

        {!compact && <aside className='mt-10 rounded-2xl border border-teal-200 bg-white p-5 shadow-sm'>
          <h3 className='flex items-center gap-2 text-lg font-semibold text-slate-900'><ShoppingCart className='h-5 w-5 text-teal-600' />{labels.cart} ({basket.length})</h3>
          {basket.length === 0 ? <p className='mt-3 text-sm text-slate-500'>{labels.emptyCart}</p> : <>
            <ul className='mt-4 divide-y divide-slate-100'>{basket.map((item) => <li key={item.documentId} className='flex items-center justify-between gap-3 py-2 text-sm'><span className='flex-1'>{item.title}</span><span className='font-semibold'>{formatPrice(item.price, 'USD')}</span><button type='button' onClick={() => choose(item)} aria-label={labels.remove} className='rounded p-2 text-rose-600 hover:bg-rose-50'><Trash2 className='h-4 w-4' /></button></li>)}</ul>
            <div className='mt-4 text-right text-xl font-bold'>{formatPrice(total, 'USD')}</div>
            <p className='mt-1 text-right text-xs text-slate-500'>{labels.estimate}</p>
            <label className='mt-4 block text-sm font-medium text-slate-700'>{labels.note}<textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} rows={2} className='mt-2 w-full rounded-xl border border-slate-300 p-3 outline-none focus:border-teal-500' /></label>
            <Button className='mt-4' onClick={send} isLoading={sending}>{labels.send}</Button>
          </>}
        </aside>}
        {showCta && <div className='mt-8 text-center'><Link to={ctaTo}><Button>{ctaLabel || t('pricing.cta')}</Button></Link></div>}
      </div>
    </section>
  )
}

export default PriceListSection
