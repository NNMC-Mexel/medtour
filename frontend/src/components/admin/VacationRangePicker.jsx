import { useState } from 'react'
import {
  addMonths,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { enUS, kk, ru } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import Button from '../ui/Button'
import { toLocalDateKey } from '../../utils/schedule'
import { cn } from '../../utils/helpers'

// Выбор периода как при бронировании отеля: первый клик — начало,
// второй — конец. Клик раньше начала переносит начало.
function MonthGrid({ month, from, to, hovered, onPick, onHover, busy, locale, today }) {
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  })
  const weekDays = days.slice(0, 7).map((day) => format(day, 'EEEEEE', { locale }))
  const rangeEnd = to || (from && hovered && hovered > from ? hovered : null)

  return (
    <div className='min-w-0'>
      <p className='mb-2 text-center text-sm font-semibold capitalize text-slate-800'>
        {format(month, 'LLLL yyyy', { locale })}
      </p>
      <div className='grid grid-cols-7 text-center text-[11px] font-medium uppercase text-slate-400'>
        {weekDays.map((label) => <span key={label} className='py-1'>{label}</span>)}
      </div>
      <div className='grid grid-cols-7' onMouseLeave={() => onHover(null)}>
        {days.map((day) => {
          const key = toLocalDateKey(day)
          if (!isSameMonth(day, month)) return <span key={key} aria-hidden='true' />

          const disabled = key < today
          const isStart = key === from
          const isEnd = key === rangeEnd
          const inRange = from && rangeEnd && key > from && key < rangeEnd
          const isBusy = busy(key)

          return (
            <button
              type='button'
              key={key}
              disabled={disabled}
              aria-pressed={isStart || isEnd || Boolean(inRange)}
              aria-label={format(day, 'd MMMM yyyy', { locale })}
              onClick={() => onPick(key)}
              onMouseEnter={() => onHover(key)}
              className={cn(
                'relative h-9 text-sm transition',
                inRange && 'bg-teal-100 text-teal-900',
                isStart && rangeEnd && 'rounded-l-lg bg-teal-100',
                isEnd && 'rounded-r-lg bg-teal-100',
                disabled && 'cursor-not-allowed text-slate-300',
              )}>
              <span
                className={cn(
                  'mx-auto flex h-9 w-9 items-center justify-center rounded-lg',
                  (isStart || isEnd)
                    ? 'bg-teal-600 font-semibold text-white'
                    : !disabled && !inRange && 'hover:bg-slate-100',
                  isBusy && !isStart && !isEnd && !inRange && 'bg-amber-50 text-amber-700',
                  key === today && !isStart && !isEnd && 'font-semibold underline underline-offset-4',
                )}>
                {format(day, 'd')}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function VacationRangePicker({ vacations = [], onSave, onCancel }) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'kk' ? kk : i18n.language === 'en' ? enUS : ru
  const today = toLocalDateKey(new Date())
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [from, setFrom] = useState(null)
  const [to, setTo] = useState(null)
  const [hovered, setHovered] = useState(null)

  const pick = (key) => {
    if (!from || to || key < from) {
      setFrom(key)
      setTo(null)
      return
    }
    setTo(key)
  }

  const busy = (key) => vacations.some((entry) => entry.from <= key && key <= entry.to)
  const end = to || from
  const previewEnd = to || (from && hovered && hovered > from ? hovered : from)
  const dayCount = from ? differenceInCalendarDays(parseISO(end), parseISO(from)) + 1 : 0
  const formatKey = (key) => format(parseISO(key), 'd MMM yyyy', { locale })

  return (
    <div className='rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4'>
      <div className='mb-3 flex items-center justify-between'>
        <button
          type='button'
          onClick={() => setMonth((current) => addMonths(current, -1))}
          disabled={isSameMonth(month, new Date())}
          aria-label={t('common.previous')}
          className='rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30'>
          <ChevronLeft className='h-4 w-4' />
        </button>
        <p className='text-sm text-slate-500'>
          {!from
            ? t('admin_doc.vacation_pick_start')
            : !to
              ? t('admin_doc.vacation_pick_end')
              : t('admin_doc.vacation_days', { count: dayCount })}
        </p>
        <button
          type='button'
          onClick={() => setMonth((current) => addMonths(current, 1))}
          aria-label={t('common.next')}
          className='rounded-lg p-2 text-slate-600 transition hover:bg-slate-100'>
          <ChevronRight className='h-4 w-4' />
        </button>
      </div>

      <div className='grid gap-6 sm:grid-cols-2'>
        {[month, addMonths(month, 1)].map((shown, index) => (
          <div key={shown.toISOString()} className={cn(index === 1 && 'hidden sm:block')}>
            <MonthGrid
              month={shown}
              from={from}
              to={to}
              hovered={hovered}
              onPick={pick}
              onHover={setHovered}
              busy={busy}
              locale={locale}
              today={today}
            />
          </div>
        ))}
      </div>

      <div className='mt-4 flex flex-col gap-3 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-between'>
        <p className='text-sm font-medium text-slate-700'>
          {from ? `${formatKey(from)} — ${formatKey(previewEnd)}` : ' '}
        </p>
        <div className='flex gap-2'>
          <Button type='button' variant='secondary' size='sm' onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button
            type='button'
            size='sm'
            disabled={!from}
            onClick={() => onSave({ from, to: end })}>
            {t('admin_doc.vacation_save')}
          </Button>
        </div>
      </div>
    </div>
  )
}
