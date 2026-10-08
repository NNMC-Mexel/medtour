import { useCallback, useEffect, useMemo, useState } from 'react'

const PREFIX = 'mt:view:'

const readStored = (storage, key) => {
  try {
    const raw = storage?.getItem(PREFIX + key)
    const parsed = raw ? JSON.parse(raw) : null
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

const writeStored = (storage, key, value) => {
  try {
    if (value && Object.keys(value).length) storage?.setItem(PREFIX + key, JSON.stringify(value))
    else storage?.removeItem(PREFIX + key)
  } catch {
    // Приватный режим или переполненное хранилище: фильтры просто не запомнятся.
  }
}

const getStorage = (name) => {
  try {
    return typeof window === 'undefined' ? null : window[name]
  } catch {
    return null
  }
}

/**
 * Удаляет сохранённые фильтры всех страниц — при выходе из аккаунта, чтобы
 * следующий пользователь браузера начинал с чистого вида.
 */
export function clearPersistentFilters() {
  for (const storage of [getStorage('localStorage'), getStorage('sessionStorage')]) {
    try {
      Object.keys(storage || {})
        .filter((key) => key.startsWith(PREFIX))
        .forEach((key) => storage.removeItem(key))
    } catch {
      // Хранилище недоступно — чистить нечего.
    }
  }
}

const NO_OPTIONS = {}
const NO_KEYS = []
const NO_VALIDATORS = {}

/**
 * Фильтры списка, которые переживают перезагрузку страницы и возврат на неё.
 *
 * - `defaults` задаёт набор ключей и их типы: сохранённое значение другого
 *   типа или не прошедшее `validate[key]` заменяется значением по умолчанию,
 *   так что устаревшая запись после релиза не ломает страницу.
 * - Ключи из `sessionKeys` живут в sessionStorage — до закрытия вкладки. Туда
 *   идут строки поиска: в них бывают ФИО и email пациентов, которым нечего
 *   делать на диске после конца смены.
 * - Если среди ключей есть `page`, смена любого другого фильтра возвращает
 *   на первую страницу.
 *
 * `defaults` и `options` должны быть константами модуля: хук читает их при
 * каждом рендере и не ждёт, что они поменяются.
 */
export default function usePersistentFilters(key, defaults, options = NO_OPTIONS) {
  const { sessionKeys = NO_KEYS, validate = NO_VALIDATORS } = options

  const [filters, setFilters] = useState(() => {
    const persistent = readStored(getStorage('localStorage'), key) || {}
    const session = readStored(getStorage('sessionStorage'), key) || {}
    const initial = { ...defaults }
    for (const [name, fallback] of Object.entries(defaults)) {
      const value = sessionKeys.includes(name) ? session[name] : persistent[name]
      if (value === undefined || typeof value !== typeof fallback) continue
      if (validate[name] && !validate[name](value)) continue
      initial[name] = value
    }
    return initial
  })

  useEffect(() => {
    const persistent = {}
    const session = {}
    for (const [name, value] of Object.entries(filters)) {
      if (value === defaults[name]) continue
      if (sessionKeys.includes(name)) session[name] = value
      else persistent[name] = value
    }
    writeStored(getStorage('localStorage'), key, persistent)
    writeStored(getStorage('sessionStorage'), key, session)
  }, [defaults, filters, key, sessionKeys])

  const setFilter = useCallback((name, value) => {
    setFilters((prev) => {
      if (prev[name] === value) return prev
      const next = { ...prev, [name]: value }
      if (name !== 'page' && 'page' in defaults) next.page = defaults.page
      return next
    })
  }, [defaults])

  const resetFilters = useCallback(() => {
    setFilters({ ...defaults })
  }, [defaults])

  // «Изменены ли фильтры» — без учёта страницы: кнопка сброса нужна, только
  // когда список действительно сужен.
  const activeCount = useMemo(
    () => Object.keys(defaults)
      .filter((name) => name !== 'page' && filters[name] !== defaults[name])
      .length,
    [defaults, filters],
  )

  return { filters, setFilter, resetFilters, activeCount }
}
