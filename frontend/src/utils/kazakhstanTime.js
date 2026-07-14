export const KAZAKHSTAN_TIME_ZONE = 'Asia/Almaty'
const KAZAKHSTAN_OFFSET_MINUTES = 5 * 60

const pad = (value) => String(value).padStart(2, '0')

// Calendar controls use synthetic local-noon Date objects. Reading their local
// fields keeps the selected YYYY-MM-DD stable regardless of the device timezone.
export const getCalendarDateKey = (date) => (
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
)

// Convert a real instant to its calendar date in Kazakhstan (UTC+5).
export const getKazakhstanDateKey = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value)
  const shifted = new Date(date.getTime() + KAZAKHSTAN_OFFSET_MINUTES * 60 * 1000)
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`
}

export const getKazakhstanCalendarToday = () => {
  const [year, month, day] = getKazakhstanDateKey().split('-').map(Number)
  return new Date(year, month - 1, day, 12, 0, 0, 0)
}

export const getKazakhstanMinutesNow = () => {
  const shifted = new Date(Date.now() + KAZAKHSTAN_OFFSET_MINUTES * 60 * 1000)
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes()
}

// Doctor working hours and slot labels are defined in Kazakhstan time.
// Convert that wall-clock value to one unambiguous UTC instant.
export const buildKazakhstanDateTime = (calendarDate, time) => {
  if (!calendarDate || !time) return null
  const [hours, minutes] = time.split(':').map(Number)
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null
  return new Date(Date.UTC(
    calendarDate.getFullYear(),
    calendarDate.getMonth(),
    calendarDate.getDate(),
    hours,
    minutes - KAZAKHSTAN_OFFSET_MINUTES,
    0,
    0,
  ))
}

const localeFor = (language) => language === 'kk' ? 'kk-KZ' : language === 'en' ? 'en-US' : 'ru-RU'

export const getDeviceTimeZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || KAZAKHSTAN_TIME_ZONE
  } catch {
    return KAZAKHSTAN_TIME_ZONE
  }
}

export const getDateKeyInTimeZone = (value, timeZone) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value))
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

export const formatDateInTimeZone = (value, timeZone, language = 'ru') => new Intl.DateTimeFormat(localeFor(language), {
  timeZone,
  day: '2-digit',
  month: 'long',
  year: 'numeric',
}).format(new Date(value))

export const formatShortDateInTimeZone = (value, timeZone, language = 'ru') => new Intl.DateTimeFormat(localeFor(language), {
  timeZone,
  day: '2-digit',
  month: '2-digit',
}).format(new Date(value))

export const formatTimeInTimeZone = (value, timeZone, language = 'ru') => new Intl.DateTimeFormat(localeFor(language), {
  timeZone,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
}).format(new Date(value))

export const formatDateTimeInTimeZone = (value, timeZone, language = 'ru') => (
  `${formatDateInTimeZone(value, timeZone, language)}, ${formatTimeInTimeZone(value, timeZone, language)}`
)

export const formatKazakhstanDate = (value, language = 'ru') => formatDateInTimeZone(value, KAZAKHSTAN_TIME_ZONE, language)

export const formatKazakhstanTime = (value, language = 'ru') => formatTimeInTimeZone(value, KAZAKHSTAN_TIME_ZONE, language)

export const formatKazakhstanDateTime = (value, language = 'ru') => `${formatKazakhstanDate(value, language)}, ${formatKazakhstanTime(value, language)}`
