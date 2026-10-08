/**
 * Расписание врача — серверная сторона.
 *
 * Хранение (поля doctor):
 *   - scheduleConfig  — основной формат: недельный (`recurring`, интервалы по
 *     дням ISO 1..7) или разовый (`one_time`, интервалы по датам) график плюс
 *     отпуска `vacations` (даты включительно, действуют поверх любого графика);
 *   - workingIntervals/workingDays/workStartTime/... — прежние поля. Пока
 *     scheduleConfig не задан, расписание строится из них, поэтому старые
 *     карточки врачей работают без миграции.
 *
 * Все времена — клиническое время Asia/Almaty (UTC+5).
 * Клиентское зеркало: frontend/src/utils/schedule.js.
 */

export type WorkingInterval = { start: string; end: string };

type ScheduleConfig = {
  type: 'recurring' | 'one_time';
  week?: Record<string, WorkingInterval[]>;
  dates?: Array<{ date: string; intervals: WorkingInterval[] }>;
  vacations?: Array<{ from: string; to: string }>;
};

export const SCHEDULE_FIELDS = [
  'scheduleConfig',
  'workingIntervals',
  'workingDays',
  'workStartTime',
  'workEndTime',
  'breakStart',
  'breakEnd',
  'slotDuration',
];

const ACTIVE_APPOINTMENT_STATUSES = ['pending', 'confirmed', 'in_progress'];
const KZ_OFFSET_MS = 5 * 60 * 60 * 1000;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const timeToMinutes = (value: unknown): number | null => {
  if (typeof value !== 'string' || !TIME_RE.test(value)) return null;
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
};

const parseJson = (value: unknown): any => {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const parseScheduleConfig = (value: unknown): ScheduleConfig | null => {
  const parsed = parseJson(value);
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) && ['recurring', 'one_time'].includes(parsed.type)
    ? parsed as ScheduleConfig
    : null;
};

export const normalizeDoctorIntervals = (value: unknown): WorkingInterval[] => {
  const intervals = parseJson(value);
  if (!Array.isArray(intervals)) return [];
  return intervals
    .map((interval: any) => ({
      start: interval?.start || interval?.startTime,
      end: interval?.end || interval?.endTime,
    }))
    .filter((interval) => {
      const start = timeToMinutes(interval.start);
      const end = timeToMinutes(interval.end);
      return start !== null && end !== null && start < end;
    })
    .sort((left, right) => (timeToMinutes(left.start) as number) - (timeToMinutes(right.start) as number));
};

const getLegacyIntervals = (doctor: any): WorkingInterval[] => {
  const stored = normalizeDoctorIntervals(doctor?.workingIntervals);
  if (stored.length > 0) return stored;

  const workStartTime = doctor?.workStartTime || '09:00';
  const workEndTime = doctor?.workEndTime || '18:00';
  const breakStart = doctor?.breakStart;
  const breakEnd = doctor?.breakEnd;
  const workStart = timeToMinutes(workStartTime);
  const workEnd = timeToMinutes(workEndTime);
  const pauseStart = timeToMinutes(breakStart);
  const pauseEnd = timeToMinutes(breakEnd);

  if (workStart === null || workEnd === null || workStart >= workEnd) return [];
  if (pauseStart === null || pauseEnd === null || pauseStart >= pauseEnd || pauseStart <= workStart || pauseEnd >= workEnd) {
    return [{ start: workStartTime, end: workEndTime }];
  }
  return [
    { start: workStartTime, end: breakStart },
    { start: breakEnd, end: workEndTime },
  ];
};

const getLegacyWorkingDays = (doctor: any): number[] => {
  const source = typeof doctor?.workingDays === 'string' && doctor.workingDays.trim()
    ? doctor.workingDays.split(',')
    : Array.isArray(doctor?.workingDays)
      ? doctor.workingDays
      : [1, 2, 3, 4, 5];
  return source
    .map((day: unknown) => Number(day))
    .map((day: number) => (day === 0 ? 7 : day))
    .filter((day: number) => day >= 1 && day <= 7);
};

export const isVacationDate = (doctor: any, dateKey: string) => {
  const config = parseScheduleConfig(doctor?.scheduleConfig);
  return Array.isArray(config?.vacations) && config.vacations.some((vacation) =>
    DATE_RE.test(String(vacation?.from)) &&
    DATE_RE.test(String(vacation?.to)) &&
    vacation.from <= dateKey &&
    dateKey <= vacation.to);
};

/** Рабочие интервалы врача на дату (YYYY-MM-DD в клиническом времени). */
export const getDoctorIntervalsForScheduleDate = (doctor: any, dateKey: string, isoWeekDay: number): WorkingInterval[] => {
  const config = parseScheduleConfig(doctor?.scheduleConfig);
  if (isVacationDate(doctor, dateKey)) return [];
  if (config?.type === 'one_time') {
    const entry = Array.isArray(config.dates) ? config.dates.find((item) => item?.date === dateKey) : null;
    return normalizeDoctorIntervals(entry?.intervals);
  }
  if (config?.type === 'recurring') {
    return normalizeDoctorIntervals(config.week?.[String(isoWeekDay)]);
  }
  return getLegacyWorkingDays(doctor).includes(isoWeekDay) ? getLegacyIntervals(doctor) : [];
};

/** Разбор момента времени в клинические дату, день недели и минуты. */
export const toClinicTime = (value: Date | string) => {
  const kzDate = new Date(new Date(value).getTime() + KZ_OFFSET_MS);
  return {
    dateKey: kzDate.toISOString().slice(0, 10),
    isoWeekDay: kzDate.getUTCDay() === 0 ? 7 : kzDate.getUTCDay(),
    minutes: kzDate.getUTCHours() * 60 + kzDate.getUTCMinutes(),
  };
};

export const findContainingInterval = (intervals: WorkingInterval[], startMinutes: number, durationMinutes: number) =>
  intervals.find((interval) => {
    const intervalStart = timeToMinutes(interval.start);
    const intervalEnd = timeToMinutes(interval.end);
    return intervalStart !== null && intervalEnd !== null &&
      startMinutes >= intervalStart && startMinutes + durationMinutes <= intervalEnd;
  }) || null;

/**
 * Проверяет, что время приёма — один из слотов, которые видит пациент:
 * внутри рабочего интервала, с шагом slotDuration от его начала.
 * `allowOutsideSchedule` — сотрудники могут записать вне графика; тогда
 * требуется лишь шаг сетки от начала рабочего дня.
 */
export const checkAppointmentSlot = (
  doctor: any,
  dateTime: Date,
  { allowOutsideSchedule = false }: { allowOutsideSchedule?: boolean } = {},
): 'ok' | 'outside_schedule' | 'misaligned' => {
  const slotMinutes = Number(doctor?.slotDuration) || 30;
  if (!Number.isInteger(slotMinutes) || slotMinutes < 5 || slotMinutes > 240) return 'misaligned';
  if (dateTime.getUTCSeconds() !== 0 || dateTime.getUTCMilliseconds() !== 0) return 'misaligned';

  const { dateKey, isoWeekDay, minutes } = toClinicTime(dateTime);
  const intervals = getDoctorIntervalsForScheduleDate(doctor, dateKey, isoWeekDay);
  const interval = findContainingInterval(intervals, minutes, slotMinutes);

  if (interval) {
    return (minutes - (timeToMinutes(interval.start) as number)) % slotMinutes === 0 ? 'ok' : 'misaligned';
  }
  if (!allowOutsideSchedule) return 'outside_schedule';

  const anchor = timeToMinutes(intervals[0]?.start) ?? timeToMinutes(doctor?.workStartTime) ?? 9 * 60;
  return (((minutes - anchor) % slotMinutes) + slotMinutes) % slotMinutes === 0 ? 'ok' : 'misaligned';
};

/** Сравнение полей расписания без оглядки на формат (JSON приходит объектом или строкой). */
const normalizeScheduleValue = (value: unknown) => {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'string') {
    const trimmed = value.trim();
    try {
      return JSON.stringify(JSON.parse(trimmed));
    } catch {
      return trimmed;
    }
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

/** Меняет ли запрос расписание на самом деле, а не просто присылает те же поля. */
export const scheduleActuallyChanges = (current: any, body: any) =>
  SCHEDULE_FIELDS.some((field) =>
    field in body && normalizeScheduleValue(body[field]) !== normalizeScheduleValue(current?.[field]));

/**
 * Будущие активные записи врача, которые НЕ попадают в новое расписание.
 * Без этой проверки график менялся молча: запись оставалась «подтверждена»
 * вне рабочих часов или в отпуске, и о ней никто не узнавал.
 */
export const findScheduleConflicts = async (strapi: any, doctorDocId: string, candidateDoctor: any) => {
  const appointments = await strapi.documents('api::appointment.appointment').findMany({
    status: 'published',
    filters: {
      doctor: { documentId: doctorDocId },
      dateTime: { $gte: new Date().toISOString() },
      statuse: { $in: ACTIVE_APPOINTMENT_STATUSES },
    },
    populate: { patient: { fields: ['id', 'fullName'] } },
    limit: 500,
  });

  const slotMinutes = Number(candidateDoctor?.slotDuration) || 30;
  const conflicts: any[] = [];
  for (const appointment of appointments as any[]) {
    const dateTime = new Date(appointment.dateTime);
    if (Number.isNaN(dateTime.getTime())) continue;
    const { dateKey, isoWeekDay, minutes } = toClinicTime(dateTime);
    const intervals = getDoctorIntervalsForScheduleDate(candidateDoctor, dateKey, isoWeekDay);
    if (!findContainingInterval(intervals, minutes, slotMinutes)) {
      conflicts.push({
        documentId: appointment.documentId,
        dateTime: appointment.dateTime,
        statuse: appointment.statuse,
        patientName: appointment.patient?.fullName || '',
        reason: isVacationDate(candidateDoctor, dateKey) ? 'vacation' : 'outside_hours',
      });
    }
  }
  return conflicts.sort((a, b) => String(a.dateTime).localeCompare(String(b.dateTime)));
};

/**
 * Структурная проверка входящего scheduleConfig: формат, непересекающиеся
 * интервалы, корректные даты. Возвращает код ошибки или null.
 */
export const validateScheduleConfigInput = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  const config = parseJson(value);
  if (!config || typeof config !== 'object' || Array.isArray(config)) return 'invalid';
  if (!['recurring', 'one_time'].includes(config.type)) return 'invalid';

  const checkIntervals = (raw: unknown) => {
    if (!Array.isArray(raw) || raw.length === 0 || raw.length > 12) return 'invalid_intervals';
    const normalized = normalizeDoctorIntervals(raw);
    if (normalized.length !== raw.length) return 'invalid_intervals';
    for (let index = 1; index < normalized.length; index += 1) {
      if ((timeToMinutes(normalized[index].start) as number) <= (timeToMinutes(normalized[index - 1].end) as number)) {
        return 'overlapping_intervals';
      }
    }
    return null;
  };

  if (config.type === 'recurring') {
    const week = config.week && typeof config.week === 'object' ? config.week : {};
    const days = Object.keys(week);
    if (days.some((day) => !/^[1-7]$/.test(day))) return 'invalid';
    for (const day of days) {
      const error = checkIntervals(week[day]);
      if (error) return error;
    }
  } else {
    const dates = Array.isArray(config.dates) ? config.dates : [];
    if (dates.length > 366) return 'invalid';
    const seen = new Set<string>();
    for (const entry of dates) {
      if (!DATE_RE.test(String(entry?.date)) || seen.has(entry.date)) return 'invalid_date';
      seen.add(entry.date);
      const error = checkIntervals(entry.intervals);
      if (error) return error;
    }
  }

  const vacations = config.vacations === undefined ? [] : config.vacations;
  if (!Array.isArray(vacations) || vacations.length > 100) return 'invalid_vacation';
  if (vacations.some((vacation: any) =>
    !DATE_RE.test(String(vacation?.from)) || !DATE_RE.test(String(vacation?.to)) || vacation.from > vacation.to)) {
    return 'invalid_vacation';
  }
  return null;
};
