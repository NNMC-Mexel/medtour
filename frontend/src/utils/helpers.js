import { format, formatDistanceToNow, isToday, isTomorrow, isYesterday, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale/ru'
import { enUS } from 'date-fns/locale/en-US'
import { kk } from 'date-fns/locale/kk'
import { getDoctorIntervalsForDate, timeToMinutes } from './schedule'
import { getKazakhstanCalendarToday, getKazakhstanMinutesNow } from './kazakhstanTime'

const getDateLocale = (lang) => {
  if (lang === 'en') return enUS
  if (lang === 'kk') return kk
  return ru
}

// Date formatting
// Second arg can be a lang code ('ru'|'en'|'kk') OR a format string for backward-compat.
export const formatDate = (date, langOrFormat = 'dd MMMM yyyy', extraFormat) => {
  const parsed = typeof date === 'string' ? parseISO(date) : date
  const isLang = ['ru', 'en', 'kk'].includes(langOrFormat)
  const locale = isLang ? getDateLocale(langOrFormat) : ru
  const fmt = isLang ? (extraFormat || 'dd MMMM yyyy') : langOrFormat
  return format(parsed, fmt, { locale })
}

export const formatTime = (date) => {
  const parsed = typeof date === 'string' ? parseISO(date) : date
  return format(parsed, 'HH:mm', { locale: ru })
}

export const formatDateTime = (date, lang = 'ru') => {
  const parsed = typeof date === 'string' ? parseISO(date) : date
  return format(parsed, 'dd MMM yyyy, HH:mm', { locale: getDateLocale(lang) })
}

export const formatRelativeDate = (date, lang = 'ru', labels = { today: 'Сегодня', tomorrow: 'Завтра', yesterday: 'Вчера' }) => {
  const parsed = typeof date === 'string' ? parseISO(date) : date

  if (isToday(parsed)) return `${labels.today}, ${formatTime(parsed)}`
  if (isTomorrow(parsed)) return `${labels.tomorrow}, ${formatTime(parsed)}`
  if (isYesterday(parsed)) return `${labels.yesterday}, ${formatTime(parsed)}`

  return formatDateTime(parsed, lang)
}

export const formatTimeAgo = (date, lang = 'ru') => {
  const parsed = typeof date === 'string' ? parseISO(date) : date
  return formatDistanceToNow(parsed, { addSuffix: true, locale: getDateLocale(lang) })
}

// Name formatting
export const getInitials = (name) => {
  if (!name) return '??'
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export const getFullName = (user) => {
  if (!user) return 'Неизвестный'
  if (user.fullName) return user.fullName
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username || 'Неизвестный'
}

// Phone formatting
export const formatPhone = (phone) => {
  if (!phone) return ''
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length === 11) {
    return `+7 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7, 9)}-${cleaned.slice(9)}`
  }
  return phone
}

// Status formatting
export const appointmentStatusMap = {
  pending: { label: 'Ожидает', color: 'bg-amber-100 text-amber-800' },
  confirmed: { label: 'Подтверждено', color: 'bg-blue-100 text-blue-800' },
  in_progress: { label: 'В процессе', color: 'bg-green-100 text-green-800' },
  completed: { label: 'Завершено', color: 'bg-gray-100 text-gray-800' },
  cancelled: { label: 'Отменено', color: 'bg-red-100 text-red-800' },
  no_show: { label: 'Звонок не состоялся', color: 'bg-orange-100 text-orange-800' },
}

export const getStatusInfo = (status) => {
  return appointmentStatusMap[status] || { label: status, color: 'bg-gray-100 text-gray-800' }
}

// Price formatting
export const formatPrice = (price) => {
  return new Intl.NumberFormat('ru-KZ', {
    style: 'currency',
    currency: 'KZT',
    minimumFractionDigits: 0,
  }).format(price)
}

// Get localised specialization name from API object (uses nameEn / nameKk from Strapi)
export const getSpecName = (spec, lang) => {
  if (!spec) return ''
  const name = typeof spec === 'object' ? spec.name : spec
  if (!name) return ''
  if (lang === 'en') return (typeof spec === 'object' && spec.nameEn) || name
  if (lang === 'kk') return (typeof spec === 'object' && spec.nameKk) || name
  return name
}

// Целое число из пользовательского ввода: только цифры, без ведущих нулей.
// `type="number"` принимает 'e', '+' и '-', а колесо мыши меняет значение при прокрутке формы.
export const toDigits = (value, maxLength = 12) =>
  String(value ?? '')
    .replace(/\D/g, '')
    .replace(/^0+(?=\d)/, '')
    .slice(0, maxLength)

// Все специальности врача. Основное поле `specialization` осталось для
// совместимости (карточки, письма, старые записи), полный список приходит в
// `specializations`. Врачи, заведённые до появления списка, читаются по старому полю.
export const getDoctorSpecializations = (doctor) => {
  const list = Array.isArray(doctor?.specializations) ? doctor.specializations.filter(Boolean) : []
  if (list.length > 0) return list
  return doctor?.specialization ? [doctor.specialization] : []
}

// Локализованные названия всех специальностей врача.
export const getDoctorSpecNames = (doctor, lang) =>
  getDoctorSpecializations(doctor)
    .map((spec) => getSpecName(spec, lang))
    .filter(Boolean)

// Строка для карточки: «Терапевт, Кардиолог».
export const getDoctorSpecLabel = (doctor, lang) => getDoctorSpecNames(doctor, lang).join(', ')

// Совпадение врача с выбранной специальностью: фильтры передают то id, то название.
export const doctorMatchesSpec = (doctor, selected) => {
  if (!selected) return true
  const needle = String(selected)
  return getDoctorSpecializations(doctor).some((spec) => {
    if (typeof spec !== 'object') return String(spec) === needle
    return String(spec.id ?? '') === needle || String(spec.documentId ?? '') === needle || spec.name === selected
  })
}

// Get localized field from any entity (doctor, user/patient) with fallback to Russian.
// Usage: getLocalizedField(entity, 'fullName', 'en') → English name or Russian fallback
export const getLocalizedField = (entity, field, lang) => {
  if (lang && lang !== 'ru') {
    const val = entity?.i18n?.[lang]?.[field]
    if (val && val.trim()) return val
  }
  return entity?.[field] || ''
}

// Backward-compatible alias
export const getDoctorField = getLocalizedField

// ClassNames helper
export const cn = (...classes) => {
  return classes.filter(Boolean).join(' ')
}

// Generate unique ID
export const generateId = () => {
  return Math.random().toString(36).substr(2, 9)
}

// Debounce function
export const debounce = (func, wait) => {
  let timeout
  return (...args) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func.apply(this, args), wait)
  }
}

// Validation helpers
export const isValidEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export const isValidPhone = (phone) => {
  const cleaned = phone.replace(/\D/g, '')
  return cleaned.length >= 7 && cleaned.length <= 15
}

export const isValidIIN = (iin) => {
  return /^\d{12}$/.test(iin)
}

// Политика паролей — зеркало серверной (server/src/utils/password-policy.ts).
// Клиентская проверка только для UX: сервер проверяет сам.
export const PASSWORD_MIN_LENGTH = 8

// i18n-ключ первого нарушенного правила или null, если пароль подходит.
export const getPasswordError = (password) => {
  const value = String(password || '')
  if (!value) return 'password_policy.required'
  if (value.length < PASSWORD_MIN_LENGTH) return 'password_policy.too_short'
  if (new TextEncoder().encode(value).length > 72) return 'password_policy.too_long'
  if (value !== value.trim()) return 'password_policy.whitespace_edges'
  if (!/\p{Lu}/u.test(value)) return 'password_policy.needs_uppercase'
  if (!/\p{Ll}/u.test(value)) return 'password_policy.needs_lowercase'
  if (!/\d/.test(value)) return 'password_policy.needs_digit'
  if (!/[^\p{L}\p{N}]/u.test(value)) return 'password_policy.needs_special'
  return null
}

// Принимает ли врач сейчас: по его графику (интервалы, отпуск) и по времени
// клиники в Казахстане, а не по часам устройства посетителя.
export const isDoctorOnline = (doctor) => {
  if (doctor.isActive === false) return false
  const minutes = getKazakhstanMinutesNow()
  return getDoctorIntervalsForDate(doctor, getKazakhstanCalendarToday()).some((interval) => {
    const start = timeToMinutes(interval.start)
    const end = timeToMinutes(interval.end)
    return start !== null && end !== null && minutes >= start && minutes < end
  })
}
