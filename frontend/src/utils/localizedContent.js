// Переводы записей, которые админ редактирует в модалках (новости, сторис,
// акции, видеоотзывы, описания специализаций, врачи).
//
// Русский текст хранится в обычных полях записи, переводы — в JSON-поле
// `i18n` вида { kk: { title: '…' }, en: { title: '…' } }. Пустой перевод на
// сайте заменяется русским (getLocalizedField), поэтому хранить пустые строки
// не нужно.
import { CONTENT_LOCALES } from '../config/contentLocales'

export const TRANSLATION_LOCALES = CONTENT_LOCALES.filter((locale) => locale !== 'ru')

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

/** Копия `i18n` записи с гарантированными объектами для каждого перевода. */
export function readI18n(value) {
  const source = isPlainObject(value) ? value : {}
  const result = {}
  for (const [locale, entry] of Object.entries(source)) {
    if (isPlainObject(entry)) result[locale] = { ...entry }
  }
  for (const locale of TRANSLATION_LOCALES) {
    if (!result[locale]) result[locale] = {}
  }
  return result
}

export function setI18nValue(i18n, locale, key, value) {
  return { ...i18n, [locale]: { ...(i18n?.[locale] || {}), [key]: value } }
}

/**
 * Готовит `i18n` к сохранению: обрезает пробелы у редактируемых полей и убирает
 * пустые. Поля, которые модалка не редактирует (например, заполненные
 * бэкфиллом), сохраняются как есть.
 */
export function compactI18n(i18n, keys) {
  const result = {}
  for (const [locale, entry] of Object.entries(readI18n(i18n))) {
    const next = { ...entry }
    for (const key of keys) {
      const text = typeof next[key] === 'string' ? next[key].trim() : ''
      if (text) next[key] = text
      else delete next[key]
    }
    if (Object.keys(next).length > 0) result[locale] = next
  }
  return result
}

/** Сколько переводимых полей с русским текстом не переведены на `locale`. */
export function countMissingTranslations(getValue, fields, locale) {
  return fields.filter((field) => {
    const source = String(getValue('ru', field.key) ?? '').trim()
    const translated = String(getValue(locale, field.key) ?? '').trim()
    return source && !translated
  }).length
}

/** Чтение поля формы: русский — в самом поле, переводы — в form.i18n. */
export const formLocaleGetter = (form) => (locale, key) =>
  locale === 'ru' ? form[key] : form.i18n?.[locale]?.[key]

/** Запись поля формы для setForm-стейта по тому же правилу. */
export const formLocaleSetter = (setForm) => (locale, key, value) =>
  setForm((prev) => (locale === 'ru'
    ? { ...prev, [key]: value }
    : { ...prev, i18n: setI18nValue(prev.i18n, locale, key, value) }))
