import { format } from 'date-fns'
import {
  createRecurringSchedule,
  scheduleConfigToLegacyFields,
  validateScheduleConfig,
} from './schedule'

const VALIDATION_MESSAGE_KEYS = {
  no_days: 'admin_doc.err_schedule_no_days',
  no_dates: 'admin_doc.err_schedule_no_dates',
  invalid_date: 'admin_doc.err_schedule_invalid_date',
  duplicate_date: 'admin_doc.err_schedule_duplicate_date',
  invalid_vacation: 'admin_doc.err_schedule_invalid_vacation',
  empty: 'schedule.err_interval_empty',
  invalid: 'schedule.err_interval_invalid',
  overlap: 'schedule.err_interval_overlap',
}

/**
 * Готовит поля расписания для сохранения. scheduleConfig — основной формат;
 * прежние поля (workingDays, workStartTime, …) заполняются из него, чтобы
 * старые экраны и интеграции видели согласованные значения. Длительность
 * консультации равна длине слота: её задаёт расписание.
 * Возвращает { payload } или { errorKey } для toast.
 */
export const buildSchedulePayload = (scheduleConfig, slotDuration) => {
  const validation = validateScheduleConfig(scheduleConfig)
  if (validation.error) {
    return { errorKey: VALIDATION_MESSAGE_KEYS[validation.error] || 'schedule.save_error' }
  }

  const schedule = validation.schedule || createRecurringSchedule()
  const legacy = scheduleConfigToLegacyFields(schedule)
  const intervals = legacy.workingIntervals
  const firstGap = intervals.length > 1 ? { start: intervals[0].end, end: intervals[1].start } : null
  const slot = Number(slotDuration) || 30

  return {
    payload: {
      scheduleConfig: schedule,
      workingIntervals: intervals,
      workingDays: legacy.workingDays,
      workStartTime: intervals[0]?.start || '09:00',
      workEndTime: intervals[intervals.length - 1]?.end || '18:00',
      breakStart: firstGap?.start || '',
      breakEnd: firstGap?.end || '',
      slotDuration: slot,
      consultationDuration: slot,
    },
  }
}

/**
 * Выполняет сохранение; если сервер ответил 409 schedule_conflicts (часть
 * будущих записей выпадает из нового графика), показывает их и после
 * подтверждения повторяет запрос с acknowledgeScheduleConflicts.
 * Возвращает false, если пользователь отказался.
 */
export const saveWithScheduleConflictConfirm = async (request, payload, t) => {
  try {
    await request(payload)
    return true
  } catch (error) {
    const details = error?.response?.data?.error?.details
    if (error?.response?.status !== 409 || details?.code !== 'schedule_conflicts') throw error

    const conflicts = details.conflicts || []
    const preview = conflicts
      .slice(0, 5)
      .map((conflict) => `• ${format(new Date(conflict.dateTime), 'dd.MM.yyyy HH:mm')}${conflict.patientName ? ` — ${conflict.patientName}` : ''}`)
      .join('\n')
    const more = conflicts.length > 5 ? `\n${t('schedule.conflicts_more', { count: conflicts.length - 5 })}` : ''
    const confirmed = window.confirm(
      `${t('schedule.conflicts_title', { count: conflicts.length })}\n\n${preview}${more}\n\n${t('schedule.conflicts_question')}`,
    )
    if (!confirmed) return false

    await request({ ...payload, acknowledgeScheduleConflicts: true })
    return true
  }
}
