import {
  CalendarCheck2,
  CalendarRange,
  Clock3,
  Copy,
  Plus,
  Trash2,
  TreePalm,
} from 'lucide-react'
import { useState } from 'react'
import { differenceInCalendarDays, format, parseISO } from 'date-fns'
import { enUS, kk, ru } from 'date-fns/locale'
import { useTranslation } from 'react-i18next'
import Button from '../ui/Button'
import VacationRangePicker from './VacationRangePicker'
import {
  DEFAULT_WORKING_INTERVALS,
  ISO_WEEK_DAYS,
  SCHEDULE_TIME_MODES,
  SCHEDULE_TYPES,
  createRecurringSchedule,
  minutesToTime,
  timeToMinutes,
  normalizeVacations,
  toLocalDateKey,
} from '../../utils/schedule'
import { cn } from '../../utils/helpers'

const cloneIntervals = (intervals = DEFAULT_WORKING_INTERVALS) =>
  intervals.map((interval) => ({ ...interval }))

const getNextInterval = (intervals) => {
  const lastEnd = timeToMinutes(intervals[intervals.length - 1]?.end)
  if (lastEnd === null || lastEnd > 22 * 60 + 29) {
    return { start: '09:00', end: '18:00' }
  }
  const nextStart = lastEnd + 30
  return {
    start: minutesToTime(nextStart),
    end: minutesToTime(Math.min(nextStart + 60, 23 * 60 + 59)),
  }
}

const getNextAvailableDate = (dates = []) => {
  const occupied = new Set(dates.map((entry) => entry.date))
  const candidate = new Date()
  for (let index = 0; index < 366; index += 1) {
    const date = toLocalDateKey(candidate)
    if (!occupied.has(date)) return date
    candidate.setDate(candidate.getDate() + 1)
  }
  return ''
}

function IntervalEditor({ intervals, onChange, label, compact = false }) {
  const { t } = useTranslation()
  const lastEndMinutes = timeToMinutes(intervals[intervals.length - 1]?.end)
  const canAddInterval = lastEndMinutes === null || lastEndMinutes <= 22 * 60 + 29

  const updateInterval = (index, field, value) => {
    onChange(intervals.map((interval, currentIndex) => (
      currentIndex === index ? { ...interval, [field]: value } : interval
    )))
  }

  const removeInterval = (index) => {
    onChange(intervals.filter((_, currentIndex) => currentIndex !== index))
  }

  return (
    <div className='space-y-2'>
      {label && <p className='text-sm font-medium text-slate-700'>{label}</p>}
      <div className='space-y-2'>
        {intervals.map((interval, index) => (
          <div
            key={index}
            className={cn(
              'grid items-center gap-2',
              compact ? 'grid-cols-[minmax(92px,1fr)_16px_minmax(92px,1fr)_36px]' : 'grid-cols-[1fr_20px_1fr_40px]',
            )}>
            <input
              type='time'
              step='900'
              value={interval.start}
              aria-label={t('admin_doc.schedule_interval_start_aria', { number: index + 1 })}
              onChange={(event) => updateInterval(index, 'start', event.target.value)}
              className='min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 transition hover:border-slate-300 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal-500'
            />
            <span className='text-center text-slate-400' aria-hidden='true'>—</span>
            <input
              type='time'
              step='900'
              value={interval.end}
              aria-label={t('admin_doc.schedule_interval_end_aria', { number: index + 1 })}
              onChange={(event) => updateInterval(index, 'end', event.target.value)}
              className='min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 transition hover:border-slate-300 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal-500'
            />
            <button
              type='button'
              onClick={() => removeInterval(index)}
              disabled={intervals.length === 1}
              title={t('admin_doc.schedule_remove_interval')}
              aria-label={t('admin_doc.schedule_remove_interval')}
              className='inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400'>
              <Trash2 className='h-4 w-4' />
            </button>
          </div>
        ))}
      </div>
      <button
        type='button'
        onClick={() => onChange([...intervals, getNextInterval(intervals)])}
        disabled={!canAddInterval}
        className='inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-teal-700 transition hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent'>
        <Plus className='h-3.5 w-3.5' />
        {t('admin_doc.schedule_add_interval')}
      </button>
    </div>
  )
}

function VacationSection({ vacations, onChange }) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'kk' ? kk : i18n.language === 'en' ? enUS : ru
  const [picking, setPicking] = useState(false)
  const formatKey = (key) => format(parseISO(key), 'd MMM yyyy', { locale })

  const addVacation = (vacation) => {
    onChange(normalizeVacations([...vacations, vacation]))
    setPicking(false)
  }

  return (
    <div className='space-y-3 border-t border-slate-200 pt-5'>
      <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
        <div className='flex items-start gap-2.5'>
          <TreePalm className='mt-0.5 h-5 w-5 shrink-0 text-teal-600' />
          <div>
            <p className='text-sm font-semibold text-slate-800'>{t('admin_doc.vacation_title')}</p>
            <p className='mt-0.5 text-xs text-slate-500'>{t('admin_doc.vacation_hint')}</p>
          </div>
        </div>
        {!picking && (
          <Button type='button' variant='outline' size='sm' leftIcon={<Plus className='h-4 w-4' />} onClick={() => setPicking(true)}>
            {t('admin_doc.vacation_add')}
          </Button>
        )}
      </div>

      {vacations.length > 0 && (
        <ul className='space-y-2'>
          {vacations.map((vacation) => {
            const days = differenceInCalendarDays(parseISO(vacation.to), parseISO(vacation.from)) + 1
            const current = vacation.from <= toLocalDateKey(new Date())
            return (
              <li
                key={`${vacation.from}:${vacation.to}`}
                className='flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5'>
                <div className='min-w-0 flex-1'>
                  <p className='text-sm font-medium text-slate-800'>
                    {vacation.from === vacation.to
                      ? formatKey(vacation.from)
                      : `${formatKey(vacation.from)} — ${formatKey(vacation.to)}`}
                  </p>
                  <p className='text-xs text-slate-500'>
                    {t('admin_doc.vacation_days', { count: days })}
                    {current && ` · ${t('admin_doc.vacation_now')}`}
                  </p>
                </div>
                <button
                  type='button'
                  onClick={() => onChange(vacations.filter((entry) => entry !== vacation))}
                  title={t('admin_doc.vacation_remove')}
                  aria-label={t('admin_doc.vacation_remove')}
                  className='inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600'>
                  <Trash2 className='h-4 w-4' />
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {picking && (
        <VacationRangePicker
          vacations={vacations}
          onSave={addVacation}
          onCancel={() => setPicking(false)}
        />
      )}
    </div>
  )
}

export default function AdminScheduleBuilder({ value, onChange }) {
  const { t } = useTranslation()
  const config = value?.type ? value : createRecurringSchedule()
  const recurringDays = ISO_WEEK_DAYS.filter((day) => config.week?.[String(day)]?.length)
  const firstRecurringIntervals = cloneIntervals(
    config.week?.[String(recurringDays[0])] || DEFAULT_WORKING_INTERVALS,
  )
  const dayLabels = ISO_WEEK_DAYS.map((day) => ({
    day,
    short: t(`admin_doc.schedule_day_${day}_short`),
    full: t(`admin_doc.schedule_day_${day}`),
  }))

  const emit = (next) => onChange({
    version: 1,
    timezone: 'Asia/Almaty',
    week: {},
    dates: [],
    vacations: [],
    timeMode: SCHEDULE_TIME_MODES.SAME,
    ...next,
  })

  const setScheduleType = (type) => {
    if (type === config.type) return
    if (type === SCHEDULE_TYPES.ONE_TIME) {
      emit({
        ...config,
        type,
        dates: config.dates?.length
          ? config.dates
          : [{ date: getNextAvailableDate(), intervals: firstRecurringIntervals }],
      })
      return
    }
    const recurring = recurringDays.length
      ? config.week
      : createRecurringSchedule().week
    emit({ ...config, type, week: recurring })
  }

  const setTimeMode = (timeMode) => {
    if (timeMode === config.timeMode) return
    const week = { ...config.week }
    if (timeMode === SCHEDULE_TIME_MODES.SAME) {
      recurringDays.forEach((day) => {
        week[String(day)] = cloneIntervals(firstRecurringIntervals)
      })
    }
    emit({ ...config, timeMode, week })
  }

  const toggleDay = (day) => {
    const week = { ...config.week }
    if (week[String(day)]?.length) {
      delete week[String(day)]
    } else {
      week[String(day)] = cloneIntervals(firstRecurringIntervals)
    }
    emit({ ...config, week })
  }

  const updateSameIntervals = (intervals) => {
    const week = { ...config.week }
    recurringDays.forEach((day) => {
      week[String(day)] = cloneIntervals(intervals)
    })
    emit({ ...config, week })
  }

  const updateDayIntervals = (day, intervals) => {
    emit({
      ...config,
      week: { ...config.week, [String(day)]: intervals },
    })
  }

  const updateDate = (index, patch) => {
    emit({
      ...config,
      dates: (config.dates || []).map((entry, currentIndex) => (
        currentIndex === index ? { ...entry, ...patch } : entry
      )),
    })
  }

  const addDate = () => {
    emit({
      ...config,
      dates: [
        ...(config.dates || []),
        {
          date: getNextAvailableDate(config.dates),
          intervals: cloneIntervals(
            config.dates?.[config.dates.length - 1]?.intervals || firstRecurringIntervals,
          ),
        },
      ],
    })
  }

  const removeDate = (index) => {
    emit({
      ...config,
      dates: config.dates.filter((_, currentIndex) => currentIndex !== index),
    })
  }

  return (
    <section className='overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/70'>
      <div className='border-b border-slate-200 bg-white px-4 py-4 sm:px-5'>
        <div className='flex items-start gap-3'>
          <div className='mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700'>
            <CalendarRange className='h-5 w-5' />
          </div>
          <div>
            <h3 className='font-semibold text-slate-900'>{t('admin_doc.schedule_title')}</h3>
            <p className='mt-0.5 text-sm text-slate-500'>{t('admin_doc.schedule_subtitle')}</p>
          </div>
        </div>
      </div>

      <div className='space-y-5 p-4 sm:p-5'>
        <div>
          <p className='mb-2 text-sm font-medium text-slate-700'>{t('admin_doc.schedule_type_label')}</p>
          <div className='grid gap-2 sm:grid-cols-2' role='group' aria-label={t('admin_doc.schedule_type_label')}>
            <button
              type='button'
              aria-pressed={config.type === SCHEDULE_TYPES.RECURRING}
              onClick={() => setScheduleType(SCHEDULE_TYPES.RECURRING)}
              className={cn(
                'flex items-start gap-3 rounded-xl border p-3 text-left transition',
                config.type === SCHEDULE_TYPES.RECURRING
                  ? 'border-teal-500 bg-teal-50 text-teal-900 ring-1 ring-teal-500'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
              )}>
              <CalendarRange className='mt-0.5 h-5 w-5 shrink-0' />
              <span>
                <span className='block text-sm font-semibold'>{t('admin_doc.schedule_type_recurring')}</span>
                <span className='mt-0.5 block text-xs font-normal opacity-75'>{t('admin_doc.schedule_type_recurring_hint')}</span>
              </span>
            </button>
            <button
              type='button'
              aria-pressed={config.type === SCHEDULE_TYPES.ONE_TIME}
              onClick={() => setScheduleType(SCHEDULE_TYPES.ONE_TIME)}
              className={cn(
                'flex items-start gap-3 rounded-xl border p-3 text-left transition',
                config.type === SCHEDULE_TYPES.ONE_TIME
                  ? 'border-teal-500 bg-teal-50 text-teal-900 ring-1 ring-teal-500'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
              )}>
              <CalendarCheck2 className='mt-0.5 h-5 w-5 shrink-0' />
              <span>
                <span className='block text-sm font-semibold'>{t('admin_doc.schedule_type_one_time')}</span>
                <span className='mt-0.5 block text-xs font-normal opacity-75'>{t('admin_doc.schedule_type_one_time_hint')}</span>
              </span>
            </button>
          </div>
        </div>

        {config.type === SCHEDULE_TYPES.RECURRING ? (
          <div className='space-y-5'>
            <div>
              <p className='mb-2 text-sm font-medium text-slate-700'>{t('admin_doc.schedule_time_mode_label')}</p>
              <div className='inline-flex w-full rounded-xl bg-slate-200/70 p-1 sm:w-auto'>
                <button
                  type='button'
                  aria-pressed={config.timeMode === SCHEDULE_TIME_MODES.SAME}
                  onClick={() => setTimeMode(SCHEDULE_TIME_MODES.SAME)}
                  className={cn(
                    'flex-1 rounded-lg px-3 py-2 text-sm font-medium transition sm:flex-none',
                    config.timeMode === SCHEDULE_TIME_MODES.SAME
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900',
                  )}>
                  {t('admin_doc.schedule_time_same')}
                </button>
                <button
                  type='button'
                  aria-pressed={config.timeMode === SCHEDULE_TIME_MODES.INDIVIDUAL}
                  onClick={() => setTimeMode(SCHEDULE_TIME_MODES.INDIVIDUAL)}
                  className={cn(
                    'flex-1 rounded-lg px-3 py-2 text-sm font-medium transition sm:flex-none',
                    config.timeMode === SCHEDULE_TIME_MODES.INDIVIDUAL
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900',
                  )}>
                  {t('admin_doc.schedule_time_individual')}
                </button>
              </div>
            </div>

            {config.timeMode === SCHEDULE_TIME_MODES.SAME ? (
              <div className='grid gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(340px,1.2fr)]'>
                <div>
                  <p className='mb-2 text-sm font-medium text-slate-700'>{t('admin_doc.schedule_days_label')}</p>
                  <div className='grid grid-cols-4 gap-2 sm:grid-cols-7 lg:grid-cols-4'>
                    {dayLabels.map(({ day, short, full }) => {
                      const active = recurringDays.includes(day)
                      return (
                        <button
                          type='button'
                          key={day}
                          title={full}
                          aria-label={full}
                          aria-pressed={active}
                          onClick={() => toggleDay(day)}
                          className={cn(
                            'rounded-xl border px-2 py-2.5 text-sm font-semibold transition',
                            active
                              ? 'border-teal-600 bg-teal-600 text-white shadow-sm'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-teal-300 hover:text-teal-700',
                          )}>
                          {short}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div className='rounded-xl border border-slate-200 bg-white p-3.5'>
                  <div className='mb-3 flex items-center gap-2 text-sm font-medium text-slate-700'>
                    <Clock3 className='h-4 w-4 text-teal-600' />
                    {t('admin_doc.schedule_hours_label')}
                  </div>
                  <IntervalEditor intervals={firstRecurringIntervals} onChange={updateSameIntervals} />
                </div>
              </div>
            ) : (
              <div className='overflow-hidden rounded-xl border border-slate-200 bg-white'>
                <div className='hidden grid-cols-[170px_1fr] gap-4 border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:grid'>
                  <span>{t('admin_doc.schedule_table_day')}</span>
                  <span>{t('admin_doc.schedule_table_hours')}</span>
                </div>
                <div className='divide-y divide-slate-100'>
                  {dayLabels.map(({ day, full }) => {
                    const intervals = config.week?.[String(day)] || []
                    const active = intervals.length > 0
                    return (
                      <div key={day} className={cn('grid gap-3 px-3 py-3 sm:grid-cols-[158px_1fr] sm:px-4', !active && 'bg-slate-50/60')}>
                        <label className='flex cursor-pointer items-center gap-3 self-start sm:pt-2.5'>
                          <input
                            type='checkbox'
                            checked={active}
                            onChange={() => toggleDay(day)}
                            className='h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500'
                          />
                          <span className={cn('text-sm font-semibold', active ? 'text-slate-800' : 'text-slate-500')}>{full}</span>
                        </label>
                        {active ? (
                          <IntervalEditor
                            compact
                            intervals={intervals}
                            onChange={(nextIntervals) => updateDayIntervals(day, nextIntervals)}
                          />
                        ) : (
                          <p className='self-center text-sm text-slate-400'>{t('admin_doc.schedule_day_off')}</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className='space-y-3'>
            <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
              <div>
                <p className='text-sm font-semibold text-slate-800'>{t('admin_doc.schedule_dates_title')}</p>
                <p className='mt-0.5 text-xs text-slate-500'>{t('admin_doc.schedule_dates_hint')}</p>
              </div>
              <Button type='button' variant='outline' size='sm' leftIcon={<Plus className='h-4 w-4' />} onClick={addDate}>
                {t('admin_doc.schedule_add_date')}
              </Button>
            </div>

            {(config.dates || []).length === 0 ? (
              <button
                type='button'
                onClick={addDate}
                className='w-full rounded-xl border-2 border-dashed border-slate-300 bg-white px-4 py-8 text-sm font-medium text-slate-500 transition hover:border-teal-400 hover:bg-teal-50/50 hover:text-teal-700'>
                <Plus className='mx-auto mb-2 h-5 w-5' />
                {t('admin_doc.schedule_add_first_date')}
              </button>
            ) : (
              <div className='space-y-3'>
                {config.dates.map((entry, index) => (
                  <div key={index} className='rounded-xl border border-slate-200 bg-white p-3.5'>
                    <div className='mb-3 flex items-end gap-2'>
                      <label className='min-w-0 flex-1 space-y-1.5'>
                        <span className='block text-xs font-semibold uppercase tracking-wide text-slate-500'>{t('admin_doc.schedule_date_label')}</span>
                        <input
                          type='date'
                          min={toLocalDateKey(new Date())}
                          value={entry.date}
                          onChange={(event) => updateDate(index, { date: event.target.value })}
                          className='w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 transition hover:border-slate-300 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal-500'
                        />
                      </label>
                      <button
                        type='button'
                        onClick={() => removeDate(index)}
                        title={t('admin_doc.schedule_remove_date')}
                        aria-label={t('admin_doc.schedule_remove_date')}
                        className='inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600'>
                        <Trash2 className='h-4 w-4' />
                      </button>
                    </div>
                    <IntervalEditor
                      compact
                      label={t('admin_doc.schedule_hours_label')}
                      intervals={entry.intervals}
                      onChange={(intervals) => updateDate(index, { intervals })}
                    />
                    {index > 0 && (
                      <button
                        type='button'
                        onClick={() => updateDate(index, { intervals: cloneIntervals(config.dates[index - 1].intervals) })}
                        className='mt-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700'>
                        <Copy className='h-3.5 w-3.5' />
                        {t('admin_doc.schedule_copy_previous')}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <VacationSection
          vacations={normalizeVacations(config.vacations)}
          onChange={(vacations) => emit({ ...config, vacations })}
        />
      </div>
    </section>
  )
}
