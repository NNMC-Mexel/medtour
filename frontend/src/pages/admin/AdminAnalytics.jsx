import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, Megaphone } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import api from '../../services/api'
import usePersistentFilters from '../../hooks/usePersistentFilters'
import { cn } from '../../utils/helpers'
import { TREATMENT_DEPARTMENTS } from '../../data/treatmentDepartments'

const PERIODS = [7, 30, 90]
const FILTER_DEFAULTS = { period: 30 }
const FILTER_OPTIONS = { validate: { period: (value) => PERIODS.includes(value) } }
const KZ_OFFSET_MS = 5 * 60 * 60 * 1000
const UTM_EXAMPLE = '?utm_source=instagram&utm_medium=paid&utm_campaign=autumn_cardio'

const kzToday = () => new Date(Date.now() + KZ_OFFSET_MS).toISOString().slice(0, 10)
const shiftDay = (day, delta) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + delta * 86_400_000).toISOString().slice(0, 10)

const PAGE_LABELS = {
  '/': 'page_home',
  '/doctors': 'page_doctors',
  '/prices': 'page_prices',
  '/tourism': 'page_tourism',
  '/blog': 'page_blog',
  '/login': 'page_login',
  '/register': 'page_register',
  '/privacy': 'page_privacy',
  '/terms': 'page_terms',
}

// Верх шкалы — «красивое» число, половина которого тоже целая: 2 / 4 / 10 / 20 / 50 / 100 …
const niceMax = (value) => {
  if (value <= 2) return 2
  if (value <= 4) return 4
  if (value <= 10) return 10
  const magnitude = 10 ** Math.floor(Math.log10(value))
  for (const step of [1, 2, 5, 10]) {
    if (value <= step * magnitude) return step * magnitude
  }
  return 10 * magnitude
}

function StatTile({ label, value, hint }) {
  return (
    <Card>
      <CardContent className='p-4 sm:p-5'>
        <p className='text-sm text-slate-500'>{label}</p>
        <p className='mt-1 text-2xl font-semibold text-slate-900 sm:text-3xl'>{value}</p>
        {hint && <p className='mt-1 text-xs text-slate-500'>{hint}</p>}
      </CardContent>
    </Card>
  )
}

function DailyChart({ daily, formatNumber, t, locale }) {
  const [active, setActive] = useState(null)
  const max = niceMax(Math.max(1, ...daily.map((d) => d.visitors)))
  const ticks = [max, max / 2, 0]
  const formatDay = (day, options) =>
    new Date(`${day}T00:00:00Z`).toLocaleDateString(locale, { timeZone: 'UTC', ...options })
  const labelEvery = Math.max(1, Math.ceil(daily.length / 7))
  const point = active != null ? daily[active] : null

  return (
    <div>
      <div className='relative h-56 pl-10' onMouseLeave={() => setActive(null)}>
        {ticks.map((tick) => (
          <div
            key={tick}
            className='absolute left-10 right-0 border-t border-slate-200'
            style={{ bottom: `${(tick / max) * 100}%` }}>
            <span className='absolute -left-10 -translate-y-1/2 w-8 text-right text-xs text-slate-500 tabular-nums'>
              {formatNumber(tick)}
            </span>
          </div>
        ))}
        <div className='absolute inset-0 left-10 flex items-end gap-[2px]' role='list' aria-label={t('admin_analytics.daily_title')}>
          {daily.map((d, index) => (
            <div
              key={d.day}
              role='listitem'
              tabIndex={0}
              aria-label={`${formatDay(d.day, { day: 'numeric', month: 'long' })}: ${d.visitors} ${t('admin_analytics.daily_tooltip_visitors')}`}
              className='flex h-full flex-1 cursor-default items-end justify-center outline-none'
              onMouseEnter={() => setActive(index)}
              onFocus={() => setActive(index)}
              onBlur={() => setActive(null)}>
              <div
                className={cn(
                  'w-full max-w-6 rounded-t-[4px] bg-teal-600 transition-opacity',
                  active != null && active !== index && 'opacity-40',
                )}
                style={{ height: `${(d.visitors / max) * 100}%`, minHeight: d.visitors > 0 ? 2 : 0 }}
              />
            </div>
          ))}
        </div>
        {point && (
          <div
            className='pointer-events-none absolute top-0 z-10 min-w-40 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg'
            // Сдвиг пропорционален позиции столбца: у краёв тултип прижимается
            // к краю графика, а не выходит за него.
            style={{
              left: `calc(2.5rem + (100% - 2.5rem) * ${(active + 0.5) / daily.length})`,
              transform: `translateX(-${((active + 0.5) / daily.length) * 100}%)`,
            }}>
            <p className='mb-1 font-medium text-slate-900'>{formatDay(point.day, { weekday: 'short', day: 'numeric', month: 'long' })}</p>
            <p className='text-slate-600'><strong className='text-slate-900'>{formatNumber(point.visitors)}</strong> {t('admin_analytics.daily_tooltip_visitors')}</p>
            <p className='text-slate-600'><strong className='text-slate-900'>{formatNumber(point.sessions)}</strong> {t('admin_analytics.daily_tooltip_sessions')}</p>
            <p className='text-slate-600'><strong className='text-slate-900'>{formatNumber(point.pageviews)}</strong> {t('admin_analytics.daily_tooltip_pageviews')}</p>
          </div>
        )}
      </div>
      <div className='mt-2 flex h-4 pl-10 text-xs text-slate-500'>
        {daily.map((d, index) => (
          <div key={d.day} className='relative flex-1'>
            {index % labelEvery === 0 && (
              // На узком экране — каждая вторая подпись, иначе даты наезжают друг на друга.
              <span className={cn(
                'absolute left-1/2 -translate-x-1/2 whitespace-nowrap tabular-nums',
                index % (labelEvery * 2) !== 0 && 'hidden sm:inline',
              )}>
                {formatDay(d.day, { day: 'numeric', month: 'short' })}
              </span>
            )}
          </div>
        ))}
      </div>
      <details className='mt-4 text-sm'>
        <summary className='cursor-pointer text-slate-600 hover:text-slate-900'>{t('admin_analytics.daily_table')}</summary>
        <div className='mt-2 max-h-64 overflow-auto'>
          <table className='w-full text-left'>
            <thead className='text-slate-500'>
              <tr>
                <th className='py-1 font-medium'>{t('admin_analytics.col_date')}</th>
                <th className='py-1 text-right font-medium'>{t('admin_analytics.col_visitors')}</th>
                <th className='py-1 text-right font-medium'>{t('admin_analytics.col_sessions')}</th>
                <th className='py-1 text-right font-medium'>{t('admin_analytics.col_pageviews')}</th>
              </tr>
            </thead>
            <tbody className='tabular-nums text-slate-700'>
              {[...daily].reverse().map((d) => (
                <tr key={d.day} className='border-t border-slate-100'>
                  <td className='py-1'>{formatDay(d.day, { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                  <td className='py-1 text-right'>{formatNumber(d.visitors)}</td>
                  <td className='py-1 text-right'>{formatNumber(d.sessions)}</td>
                  <td className='py-1 text-right'>{formatNumber(d.pageviews)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}

/** Таблица, где первая числовая колонка дополнена полосой относительной величины. */
function BarTable({ columns, rows, barKey, formatNumber, empty }) {
  const max = Math.max(1, ...rows.map((row) => row[barKey] || 0))
  if (!rows.length) return <p className='text-sm text-slate-500'>{empty}</p>
  return (
    <div className='overflow-x-auto'>
      {/* На телефоне мельче шрифт и отступы: четыре колонки должны влезать
          в карточку без горизонтальной прокрутки. */}
      <table className='w-full text-left text-xs sm:text-sm'>
        <thead className='text-slate-500'>
          <tr>
            {columns.map((column) => (
              <th key={column.key} className={cn('pb-2 font-medium', column.numeric && 'pl-2 sm:pl-3 text-right')}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className='border-t border-slate-100 align-top'>
              {columns.map((column) => (
                <td key={column.key} className={cn('py-2', column.numeric && 'pl-2 sm:pl-3 text-right tabular-nums text-slate-700')}>
                  {column.numeric ? formatNumber(row[column.key] || 0) : column.render ? column.render(row) : row[column.key]}
                  {column.key === columns[0].key && (
                    <div className='mt-1 h-1.5 w-full max-w-64 rounded-full bg-slate-100'>
                      <div className='h-1.5 rounded-full bg-teal-600' style={{ width: `${((row[barKey] || 0) / max) * 100}%` }} />
                    </div>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function AdminAnalytics() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'kk' ? 'kk-KZ' : i18n.language === 'en' ? 'en-GB' : 'ru-RU'
  const { filters, setFilter } = usePersistentFilters('admin-analytics', FILTER_DEFAULTS, FILTER_OPTIONS)
  const { period } = filters
  const setPeriod = (days) => setFilter('period', days)
  const [data, setData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(false)

  const numberFormat = useMemo(() => new Intl.NumberFormat(locale), [locale])
  const formatNumber = useCallback((value) => numberFormat.format(value), [numberFormat])
  const ta = (key, options) => t(`admin_analytics.${key}`, options)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(false)
    try {
      const to = kzToday()
      const from = shiftDay(to, -(period - 1))
      const response = await api.get('/api/analytics/summary', { params: { from, to } })
      setData(response.data?.data || null)
    } catch (err) {
      console.error('Error loading analytics:', err)
      setError(true)
    } finally {
      setIsLoading(false)
    }
  }, [period])

  useEffect(() => { load() }, [load])

  const pageLabel = (row) => {
    if (row.label) return ta('page_doctor', { name: row.label })
    const treatmentSlug = /^\/treatments\/([^/]+)$/.exec(row.path || '')?.[1]
    if (treatmentSlug) {
      const department = TREATMENT_DEPARTMENTS.find((item) => item.slug === treatmentSlug)
      const lang = ['ru', 'en', 'kk'].includes(i18n.language) ? i18n.language : 'ru'
      return department ? ta('page_treatment', { name: department.title?.[lang] || department.title?.ru }) : null
    }
    return PAGE_LABELS[row.path] ? ta(PAGE_LABELS[row.path]) : null
  }

  const totals = data?.totals
  const bookingRate = totals?.visitors
    ? `${((totals.bookings / totals.visitors) * 100).toFixed(1)}%`
    : '0%'
  const funnelBase = data?.funnel?.[0]?.visitors || 0

  return (
    <div className='space-y-6 animate-fadeIn'>
      <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
        <p className='text-sm text-slate-500'>{ta('staff_note')}</p>
        <div className='inline-flex self-start rounded-xl bg-slate-100 p-1'>
          {PERIODS.map((days) => (
            <button
              key={days}
              type='button'
              onClick={() => setPeriod(days)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm font-medium transition-all',
                period === days ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900',
              )}>
              {ta(`period_${days}`)}
            </button>
          ))}
        </div>
      </div>

      {isLoading && !data ? (
        <div className='flex justify-center py-16'>
          <Loader2 className='h-8 w-8 animate-spin text-teal-600' />
        </div>
      ) : error ? (
        <Card>
          <CardContent className='flex flex-col items-center gap-3 py-10'>
            <p className='text-slate-600'>{ta('load_error')}</p>
            <Button variant='outline' onClick={load}>{ta('retry')}</Button>
          </CardContent>
        </Card>
      ) : data && (
        <div className={cn('space-y-6', isLoading && 'opacity-60')}>
          <div className='grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 lg:gap-4'>
            <StatTile label={ta('stat_visitors')} value={formatNumber(totals.visitors)} hint={ta('stat_visitors_hint')} />
            <StatTile label={ta('stat_sessions')} value={formatNumber(totals.sessions)} hint={ta('stat_sessions_hint')} />
            <StatTile label={ta('stat_pageviews')} value={formatNumber(totals.pageviews)} />
            <StatTile label={ta('stat_signups')} value={formatNumber(totals.signUps)} />
            <StatTile label={ta('stat_leads')} value={formatNumber(totals.leads)} hint={ta('stat_leads_hint')} />
            <StatTile
              label={ta('stat_bookings')}
              value={formatNumber(totals.bookings)}
              hint={ta('stat_bookings_rate', { rate: bookingRate })}
            />
          </div>

          <Card>
            <CardHeader><CardTitle>{ta('daily_title')}</CardTitle></CardHeader>
            <CardContent>
              {totals.sessions === 0
                ? <p className='py-8 text-center text-slate-500'>{ta('empty')}</p>
                : <DailyChart daily={data.daily} formatNumber={formatNumber} t={t} locale={locale} />}
            </CardContent>
          </Card>

          <div className='grid gap-6 lg:grid-cols-2'>
            <Card>
              <CardHeader><CardTitle>{ta('channels_title')}</CardTitle></CardHeader>
              <CardContent>
                <BarTable
                  rows={data.channels}
                  barKey='sessions'
                  formatNumber={formatNumber}
                  empty={ta('empty')}
                  columns={[
                    { key: 'channel', label: ta('col_channel'), render: (row) => ta(`channel_${row.channel}`) },
                    { key: 'sessions', label: ta('col_sessions'), numeric: true },
                    { key: 'signUps', label: ta('col_signups'), numeric: true },
                    { key: 'leads', label: ta('col_leads'), numeric: true },
                    { key: 'bookings', label: ta('col_bookings'), numeric: true },
                  ]}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{ta('funnel_title')}</CardTitle>
                <p className='text-sm text-slate-500'>{ta('funnel_hint')}</p>
              </CardHeader>
              <CardContent className='space-y-3'>
                {data.funnel.map((step) => {
                  const share = funnelBase ? (step.visitors / funnelBase) * 100 : 0
                  return (
                    <div key={step.step}>
                      <div className='flex items-baseline justify-between text-sm'>
                        <span className='text-slate-700'>{ta(`funnel_${step.step}`)}</span>
                        <span className='tabular-nums text-slate-900'>
                          <strong>{formatNumber(step.visitors)}</strong>
                          <span className='ml-2 text-slate-500'>{share.toFixed(share > 0 && share < 10 ? 1 : 0)}%</span>
                        </span>
                      </div>
                      <div className='mt-1 h-2 rounded-full bg-slate-100'>
                        <div className='h-2 rounded-full bg-teal-600' style={{ width: `${share}%` }} />
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>{ta('campaigns_title')}</CardTitle></CardHeader>
            <CardContent className='space-y-4'>
              <BarTable
                rows={data.campaigns}
                barKey='sessions'
                formatNumber={formatNumber}
                empty={ta('no_campaigns')}
                columns={[
                  {
                    key: 'campaign',
                    label: ta('col_campaign'),
                    render: (row) => (
                      <span>
                        <span className='break-all text-slate-900'>{row.campaign}</span>
                        <span className='ml-2 text-xs text-slate-500'>{[row.source, row.medium].filter(Boolean).join(' / ')}</span>
                      </span>
                    ),
                  },
                  { key: 'sessions', label: ta('col_sessions'), numeric: true },
                  { key: 'visitors', label: ta('col_visitors'), numeric: true },
                  { key: 'signUps', label: ta('col_signups'), numeric: true },
                  { key: 'leads', label: ta('col_leads'), numeric: true },
                  { key: 'bookings', label: ta('col_bookings'), numeric: true },
                ]}
              />
              <div className='rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm'>
                <p className='flex items-center gap-2 font-medium text-slate-900'>
                  <Megaphone className='h-4 w-4 text-teal-600' />
                  {ta('utm_title')}
                </p>
                <p className='mt-1 text-slate-600'>{ta('utm_text')}</p>
                <code className='mt-2 block overflow-x-auto whitespace-nowrap rounded-lg bg-white px-3 py-2 text-xs text-slate-800'>
                  https://medtour.nnmc.kz/{UTM_EXAMPLE}
                </code>
                <p className='mt-2 text-xs text-slate-500'>{ta('utm_note')}</p>
              </div>
            </CardContent>
          </Card>

          <div className='grid gap-6 lg:grid-cols-2'>
            <Card>
              <CardHeader><CardTitle>{ta('pages_title')}</CardTitle></CardHeader>
              <CardContent>
                <BarTable
                  rows={data.pages}
                  barKey='views'
                  formatNumber={formatNumber}
                  empty={ta('empty')}
                  columns={[
                    {
                      key: 'path',
                      label: ta('col_page'),
                      render: (row) => {
                        const label = pageLabel(row)
                        return (
                          <span className='break-all'>
                            {label && <span className='mr-2 text-slate-900'>{label}</span>}
                            <span className={cn('font-mono text-xs', label ? 'text-slate-500' : 'text-slate-800')}>{row.path}</span>
                          </span>
                        )
                      },
                    },
                    { key: 'views', label: ta('col_views'), numeric: true },
                    { key: 'visitors', label: ta('col_visitors'), numeric: true },
                  ]}
                />
              </CardContent>
            </Card>

            <div className='space-y-6'>
              <Card>
                <CardHeader><CardTitle>{ta('sources_title')}</CardTitle></CardHeader>
                <CardContent>
                  <BarTable
                    rows={data.sources}
                    barKey='sessions'
                    formatNumber={formatNumber}
                    empty={ta('empty')}
                    columns={[
                      {
                        key: 'source',
                        label: ta('col_source'),
                        render: (row) => (
                          <span>
                            <span className='break-all text-slate-900'>{row.source}</span>
                            <span className='ml-2 text-xs text-slate-500'>{ta(`channel_${row.channel}`)}</span>
                          </span>
                        ),
                      },
                      { key: 'sessions', label: ta('col_sessions'), numeric: true },
                      { key: 'leads', label: ta('col_leads'), numeric: true },
                    ]}
                  />
                </CardContent>
              </Card>
              <div className='grid gap-6 sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2'>
                <Card>
                  <CardHeader><CardTitle>{ta('devices_title')}</CardTitle></CardHeader>
                  <CardContent>
                    <BarTable
                      rows={data.devices}
                      barKey='sessions'
                      formatNumber={formatNumber}
                      empty={ta('empty')}
                      columns={[
                        { key: 'device', label: ta('col_device'), render: (row) => ta(`device_${row.device}`) },
                        { key: 'visitors', label: ta('col_visitors'), numeric: true },
                        { key: 'sessions', label: ta('col_sessions'), numeric: true },
                      ]}
                    />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle>{ta('os_title')}</CardTitle></CardHeader>
                  <CardContent>
                    <BarTable
                      rows={data.os}
                      barKey='sessions'
                      formatNumber={formatNumber}
                      empty={ta('empty')}
                      columns={[
                        { key: 'os', label: ta('col_os') },
                        { key: 'visitors', label: ta('col_visitors'), numeric: true },
                        { key: 'sessions', label: ta('col_sessions'), numeric: true },
                      ]}
                    />
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminAnalytics
