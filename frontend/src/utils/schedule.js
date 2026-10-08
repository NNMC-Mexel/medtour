const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const DEFAULT_WORKING_INTERVALS = [
  { start: "09:00", end: "12:00" },
  { start: "14:00", end: "18:00" },
];

export const ISO_WEEK_DAYS = [1, 2, 3, 4, 5, 6, 7];
export const SCHEDULE_TYPES = {
  RECURRING: "recurring",
  ONE_TIME: "one_time",
};
export const SCHEDULE_TIME_MODES = {
  SAME: "same",
  INDIVIDUAL: "individual",
};

export const isValidTime = (time) =>
  typeof time === "string" && TIME_RE.test(time);

export const timeToMinutes = (time) => {
  if (!isValidTime(time)) return null;
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

export const minutesToTime = (minutes) => {
  const normalized = Math.max(0, Math.min(23 * 60 + 59, minutes));
  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
};

const parseIntervals = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

export const normalizeWorkingIntervals = (value) =>
  parseIntervals(value)
    .map((interval) => ({
      start: interval?.start || interval?.startTime,
      end: interval?.end || interval?.endTime,
    }))
    .filter((interval) => {
      const start = timeToMinutes(interval.start);
      const end = timeToMinutes(interval.end);
      return start !== null && end !== null && start < end;
    })
    .sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));

const cloneIntervals = (intervals) =>
  normalizeWorkingIntervals(intervals).map((interval) => ({ ...interval }));

const parseJsonObject = (value) => {
  if (!value) return null;
  if (typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : null;
  } catch {
    return null;
  }
};

export const parseWorkingDays = (value, fallback = [1, 2, 3, 4, 5]) => {
  const rawDays = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];
  const days = [...new Set(
    rawDays
      .map((day) => Number(day))
      .map((day) => (day === 0 ? 7 : day))
      .filter((day) => ISO_WEEK_DAYS.includes(day)),
  )].sort((a, b) => a - b);
  return days.length > 0 ? days : [...fallback];
};

export const toLocalDateKey = (value) => {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const getIsoWeekDay = (value = new Date()) => {
  if (typeof value === "number" && ISO_WEEK_DAYS.includes(value)) return value;
  const dateKey = toLocalDateKey(value);
  if (!dateKey) return null;
  const [year, month, day] = dateKey.split("-").map(Number);
  const weekDay = new Date(year, month - 1, day).getDay();
  return weekDay === 0 ? 7 : weekDay;
};

const nextDateKey = (dateKey) =>
  new Date(Date.parse(`${dateKey}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);

// Отпуск — периоды без приёма, даты включительно. Действуют поверх любого
// типа графика. Прошедшие периоды отбрасываются, чтобы не копились, а
// пересекающиеся и идущие подряд — склеиваются в один.
export const normalizeVacations = (value, today = toLocalDateKey(new Date())) =>
  (Array.isArray(value) ? value : [])
    .map((entry) => {
      const from = toLocalDateKey(entry?.from);
      const to = toLocalDateKey(entry?.to);
      return from <= to ? { from, to } : { from: to, to: from };
    })
    .filter((entry) => DATE_RE.test(entry.from) && DATE_RE.test(entry.to) && entry.to >= today)
    .sort((a, b) => a.from.localeCompare(b.from))
    .reduce((merged, entry) => {
      const last = merged[merged.length - 1];
      if (last && entry.from <= nextDateKey(last.to)) {
        if (entry.to > last.to) last.to = entry.to;
      } else {
        merged.push({ ...entry });
      }
      return merged;
    }, []);

const findVacation = (vacations, date) => {
  const dateKey = toLocalDateKey(date);
  return (vacations || []).find((entry) => entry.from <= dateKey && dateKey <= entry.to) || null;
};

export const createRecurringSchedule = (
  days = [1, 2, 3, 4, 5],
  intervals = DEFAULT_WORKING_INTERVALS,
) => {
  const normalizedIntervals = cloneIntervals(intervals);
  const week = {};
  parseWorkingDays(days).forEach((day) => {
    week[String(day)] = normalizedIntervals.map((interval) => ({ ...interval }));
  });
  return {
    version: 1,
    type: SCHEDULE_TYPES.RECURRING,
    timeMode: SCHEDULE_TIME_MODES.SAME,
    timezone: "Asia/Almaty",
    week,
    dates: [],
    vacations: [],
  };
};

export const normalizeScheduleConfig = (value) => {
  const raw = parseJsonObject(value);
  if (!raw || !Object.values(SCHEDULE_TYPES).includes(raw.type)) return null;

  const week = {};
  ISO_WEEK_DAYS.forEach((day) => {
    const intervals = cloneIntervals(raw.week?.[String(day)] ?? raw.week?.[day]);
    if (intervals.length > 0) week[String(day)] = intervals;
  });

  const seenDates = new Set();
  const dates = (Array.isArray(raw.dates) ? raw.dates : [])
    .map((entry) => ({
      date: toLocalDateKey(entry?.date),
      intervals: cloneIntervals(entry?.intervals),
    }))
    .filter((entry) => {
      if (!entry.date || entry.intervals.length === 0 || seenDates.has(entry.date)) return false;
      seenDates.add(entry.date);
      return true;
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    version: 1,
    type: raw.type,
    timeMode: Object.values(SCHEDULE_TIME_MODES).includes(raw.timeMode)
      ? raw.timeMode
      : SCHEDULE_TIME_MODES.SAME,
    timezone: "Asia/Almaty",
    week,
    dates,
    vacations: normalizeVacations(raw.vacations),
  };
};

export const legacyWorkingHoursToIntervals = ({
  workStartTime = "09:00",
  workEndTime = "18:00",
  breakStart = "12:00",
  breakEnd = "14:00",
} = {}) => {
  const workStart = timeToMinutes(workStartTime);
  const workEnd = timeToMinutes(workEndTime);
  const pauseStart = timeToMinutes(breakStart);
  const pauseEnd = timeToMinutes(breakEnd);

  if (workStart === null || workEnd === null || workStart >= workEnd) {
    return DEFAULT_WORKING_INTERVALS;
  }

  if (
    pauseStart === null ||
    pauseEnd === null ||
    pauseStart >= pauseEnd ||
    pauseStart <= workStart ||
    pauseEnd >= workEnd
  ) {
    return [{ start: workStartTime, end: workEndTime }];
  }

  return [
    { start: workStartTime, end: breakStart },
    { start: breakEnd, end: workEndTime },
  ].filter((interval) => timeToMinutes(interval.start) < timeToMinutes(interval.end));
};

export const getDoctorWorkingIntervals = (doctor = {}) => {
  const scheduleConfig = normalizeScheduleConfig(doctor.scheduleConfig);
  if (scheduleConfig) {
    if (scheduleConfig.type === SCHEDULE_TYPES.RECURRING) {
      const firstDay = ISO_WEEK_DAYS.find((day) => scheduleConfig.week[String(day)]?.length);
      if (firstDay) return cloneIntervals(scheduleConfig.week[String(firstDay)]);
    } else if (scheduleConfig.dates[0]?.intervals?.length) {
      return cloneIntervals(scheduleConfig.dates[0].intervals);
    }
  }

  const intervals = normalizeWorkingIntervals(doctor.workingIntervals);
  if (intervals.length > 0) return intervals;

  return legacyWorkingHoursToIntervals({
    workStartTime: doctor.workStartTime ?? "09:00",
    workEndTime: doctor.workEndTime ?? "18:00",
    breakStart: doctor.breakStart ?? "12:00",
    breakEnd: doctor.breakEnd ?? "14:00",
  });
};

export const getDoctorScheduleConfig = (doctor = {}) => {
  const stored = normalizeScheduleConfig(doctor.scheduleConfig);
  if (stored) return stored;
  return createRecurringSchedule(
    parseWorkingDays(doctor.workingDays),
    getDoctorWorkingIntervals({ ...doctor, scheduleConfig: null }),
  );
};

export const getDoctorIntervalsForDate = (doctor = {}, date = new Date()) => {
  const stored = normalizeScheduleConfig(doctor.scheduleConfig);
  if (!stored) {
    const isoDay = getIsoWeekDay(date);
    const workingDays = parseWorkingDays(doctor.workingDays);
    return workingDays.includes(isoDay)
      ? getDoctorWorkingIntervals({ ...doctor, scheduleConfig: null })
      : [];
  }

  if (findVacation(stored.vacations, date)) return [];

  if (stored.type === SCHEDULE_TYPES.ONE_TIME) {
    const dateKey = toLocalDateKey(date);
    return cloneIntervals(
      stored.dates.find((entry) => entry.date === dateKey)?.intervals || [],
    );
  }

  return cloneIntervals(stored.week[String(getIsoWeekDay(date))] || []);
};

export const isDoctorWorkingOnDate = (doctor = {}, date = new Date()) =>
  getDoctorIntervalsForDate(doctor, date).length > 0;

// Период отпуска, в который попадает дата, или null.
export const getDoctorVacationForDate = (doctor = {}, date = new Date()) =>
  findVacation(normalizeScheduleConfig(doctor.scheduleConfig)?.vacations, date);

export const scheduleConfigToLegacyFields = (value) => {
  const config = normalizeScheduleConfig(value);
  if (!config) {
    return {
      workingDays: "1,2,3,4,5",
      workingIntervals: cloneIntervals(DEFAULT_WORKING_INTERVALS),
    };
  }

  if (config.type === SCHEDULE_TYPES.RECURRING) {
    const workingDays = ISO_WEEK_DAYS.filter((day) => config.week[String(day)]?.length);
    const firstIntervals = config.week[String(workingDays[0])] || DEFAULT_WORKING_INTERVALS;
    return {
      workingDays: workingDays.join(","),
      workingIntervals: cloneIntervals(firstIntervals),
    };
  }

  const workingDays = [...new Set(config.dates.map((entry) => getIsoWeekDay(entry.date)))]
    .filter(Boolean)
    .sort((a, b) => a - b);
  return {
    workingDays: workingDays.join(","),
    workingIntervals: cloneIntervals(config.dates[0]?.intervals || DEFAULT_WORKING_INTERVALS),
  };
};

export const validateScheduleConfig = (value) => {
  const raw = parseJsonObject(value);
  if (!raw || !Object.values(SCHEDULE_TYPES).includes(raw.type)) {
    return { schedule: null, error: "invalid" };
  }

  if (raw.type === SCHEDULE_TYPES.RECURRING) {
    const activeDays = ISO_WEEK_DAYS.filter((day) => Array.isArray(raw.week?.[String(day)]));
    if (activeDays.length === 0) return { schedule: normalizeScheduleConfig(raw), error: "no_days" };
    for (const day of activeDays) {
      const validation = validateWorkingIntervals(raw.week[String(day)]);
      if (validation.error) {
        return { schedule: normalizeScheduleConfig(raw), error: validation.error, day };
      }
    }
  } else {
    const rawDates = Array.isArray(raw.dates) ? raw.dates : [];
    if (rawDates.length === 0) return { schedule: normalizeScheduleConfig(raw), error: "no_dates" };
    const dateKeys = rawDates.map((entry) => toLocalDateKey(entry?.date));
    if (dateKeys.some((date) => !date)) {
      return { schedule: normalizeScheduleConfig(raw), error: "invalid_date" };
    }
    if (new Set(dateKeys).size !== dateKeys.length) {
      return { schedule: normalizeScheduleConfig(raw), error: "duplicate_date" };
    }
    for (let index = 0; index < rawDates.length; index += 1) {
      const validation = validateWorkingIntervals(rawDates[index]?.intervals);
      if (validation.error) {
        return { schedule: normalizeScheduleConfig(raw), error: validation.error, dateIndex: index };
      }
    }
  }

  const rawVacations = Array.isArray(raw.vacations) ? raw.vacations : [];
  if (rawVacations.some((entry) => !DATE_RE.test(toLocalDateKey(entry?.from)) || !DATE_RE.test(toLocalDateKey(entry?.to)))) {
    return { schedule: normalizeScheduleConfig(raw), error: "invalid_vacation" };
  }

  return { schedule: normalizeScheduleConfig(raw), error: null };
};

export const validateWorkingIntervals = (value) => {
  const rawIntervals = parseIntervals(value);
  const normalized = normalizeWorkingIntervals(rawIntervals);

  if (rawIntervals.length === 0) {
    return { intervals: [], error: "empty" };
  }

  if (normalized.length !== rawIntervals.length) {
    return { intervals: normalized, error: "invalid" };
  }

  for (let i = 1; i < normalized.length; i += 1) {
    const prevEnd = timeToMinutes(normalized[i - 1].end);
    const nextStart = timeToMinutes(normalized[i].start);
    if (nextStart <= prevEnd) {
      return { intervals: normalized, error: "overlap" };
    }
  }

  return { intervals: normalized, error: null };
};

export const generateSlotsFromIntervals = (intervals, slotDuration = 30) => {
  const duration = Number(slotDuration) || 30;
  const normalized = normalizeWorkingIntervals(intervals);
  const slots = [];

  normalized.forEach((interval) => {
    const start = timeToMinutes(interval.start);
    const end = timeToMinutes(interval.end);
    for (let current = start; current + duration <= end; current += duration) {
      slots.push(minutesToTime(current));
    }
  });

  return slots;
};
