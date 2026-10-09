import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '../../utils/helpers'

const DROPDOWN_GAP = 6
const DROPDOWN_MIN_HEIGHT = 180
const DROPDOWN_MAX_HEIGHT = 320

const toArray = (value) => {
  if (Array.isArray(value)) return value.map(String)
  if (value === null || value === undefined || value === '') return []
  return [String(value)]
}

/**
 * Выпадающий список с поиском.
 *
 * Список рендерится в портал с fixed-позиционированием: внутри модалки
 * `overflow-y: auto` обрезал абсолютно спозиционированное меню, и нижние поля
 * формы («Место работы», «Длительность слота») открывались «в никуда».
 */
function SearchableSelect({
  options = [],
  value,
  onChange,
  multiple = false,
  label,
  required = false,
  error,
  hint,
  disabled = false,
  placeholder,
  searchPlaceholder,
  noResultsText,
  ariaLabel,
  className,
  containerClassName,
  id,
}) {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [position, setPosition] = useState(null)
  const triggerRef = useRef(null)
  const dropdownRef = useRef(null)
  const searchRef = useRef(null)
  const generatedId = useId()
  const fieldId = id || `select-${generatedId.replace(/:/g, '')}`
  const listboxId = `${fieldId}-listbox`
  const errorId = `${fieldId}-error`
  const hintId = `${fieldId}-hint`

  const resolvedPlaceholder = placeholder ?? t('common.select_placeholder')
  const resolvedSearchPlaceholder = searchPlaceholder ?? t('common.select_search')
  const resolvedNoResults = noResultsText ?? t('common.select_no_results')

  const selectedValues = useMemo(() => toArray(value), [value])
  const selectedOptions = useMemo(
    () =>
      selectedValues
        .map((selected) => options.find((option) => String(option.value) === selected))
        .filter(Boolean),
    [options, selectedValues],
  )

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    if (!normalizedQuery) return options
    return options.filter((option) =>
      String(option.label ?? '').toLocaleLowerCase().includes(normalizedQuery),
    )
  }, [options, query])

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return

    const rect = trigger.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom - DROPDOWN_GAP - 8
    const spaceAbove = rect.top - DROPDOWN_GAP - 8
    const openUp = spaceBelow < DROPDOWN_MIN_HEIGHT && spaceAbove > spaceBelow

    setPosition({
      left: rect.left,
      width: rect.width,
      top: openUp ? undefined : rect.bottom + DROPDOWN_GAP,
      bottom: openUp ? window.innerHeight - rect.top + DROPDOWN_GAP : undefined,
      maxHeight: Math.max(DROPDOWN_MIN_HEIGHT, Math.min(DROPDOWN_MAX_HEIGHT, openUp ? spaceAbove : spaceBelow)),
    })
  }, [])

  useLayoutEffect(() => {
    if (isOpen) updatePosition()
  }, [isOpen, updatePosition])

  useEffect(() => {
    if (!isOpen) return

    const handleOutsideClick = (event) => {
      if (triggerRef.current?.contains(event.target)) return
      if (dropdownRef.current?.contains(event.target)) return
      setIsOpen(false)
      setQuery('')
    }

    // Меню живёт в портале, поэтому за прокруткой любого предка (тело модалки,
    // страница) следим на фазе перехвата и пересчитываем координаты.
    const handleReflow = () => updatePosition()

    document.addEventListener('pointerdown', handleOutsideClick)
    window.addEventListener('scroll', handleReflow, true)
    window.addEventListener('resize', handleReflow)
    const focusFrame = requestAnimationFrame(() => searchRef.current?.focus())

    return () => {
      cancelAnimationFrame(focusFrame)
      document.removeEventListener('pointerdown', handleOutsideClick)
      window.removeEventListener('scroll', handleReflow, true)
      window.removeEventListener('resize', handleReflow)
    }
  }, [isOpen, updatePosition])

  const closeDropdown = useCallback((refocus = true) => {
    setIsOpen(false)
    setQuery('')
    if (refocus) requestAnimationFrame(() => triggerRef.current?.focus())
  }, [])

  const selectOption = (option) => {
    const optionValue = String(option.value)

    if (!multiple) {
      onChange(option.value)
      closeDropdown()
      return
    }

    const next = selectedValues.includes(optionValue)
      ? selectedValues.filter((selected) => selected !== optionValue)
      : [...selectedValues, optionValue]
    onChange(next)
    // Список остаётся открытым для следующего выбора, поэтому возвращаем фокус
    // в поиск: иначе он застревал на кнопке варианта и Escape ничего не делал.
    requestAnimationFrame(() => searchRef.current?.focus())
  }

  const removeValue = (optionValue) => {
    if (!multiple) {
      onChange('')
      return
    }
    onChange(selectedValues.filter((selected) => selected !== String(optionValue)))
  }

  const openDropdown = () => {
    if (disabled) return
    setQuery('')
    setIsOpen(true)
  }

  const handleTriggerKeyDown = (event) => {
    if (isOpen) return
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openDropdown()
    }
  }

  // Обработчик висит на контейнере списка, а не только на поле поиска: фокус
  // может стоять на кнопке варианта, и Escape оттуда тоже должен закрывать
  // список (а не «проваливаться» в модалку и не оставаться без реакции).
  const handleDropdownKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      closeDropdown()
      return
    }

    if (event.key === 'Tab') {
      // Как у нативного select: Tab закрывает список и возвращает фокус на поле,
      // иначе фокус ушёл бы из портала за пределы модалки.
      event.preventDefault()
      closeDropdown()
      return
    }

    // Навигация стрелками и выбор по Enter — только из поля поиска: на кнопке
    // варианта Enter и так срабатывает как клик.
    if (event.target !== searchRef.current) return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (filteredOptions.length === 0) return
      setActiveIndex((current) => Math.min(current + 1, filteredOptions.length - 1))
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (filteredOptions.length === 0) return
      setActiveIndex((current) => Math.max(current - 1, 0))
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      if (filteredOptions[activeIndex]) selectOption(filteredOptions[activeIndex])
    }
  }

  const triggerLabel = multiple
    ? selectedOptions.length > 0
      ? t('common.select_selected_count', { count: selectedOptions.length })
      : resolvedPlaceholder
    : selectedOptions[0]?.label || resolvedPlaceholder

  const hasSelection = selectedOptions.length > 0
  const describedBy = [error ? errorId : null, hint && !error ? hintId : null].filter(Boolean).join(' ') || undefined

  const dropdown = isOpen && position && (
    <div
      ref={dropdownRef}
      data-select-dropdown='true'
      onKeyDown={handleDropdownKeyDown}
      style={{
        position: 'fixed',
        left: position.left,
        width: position.width,
        top: position.top,
        bottom: position.bottom,
      }}
      className='z-[200] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl animate-scaleIn'>
      <div className='border-b border-slate-100 p-2'>
        <div className='relative'>
          <Search className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400' />
          <input
            ref={searchRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setActiveIndex(0)
            }}
            placeholder={resolvedSearchPlaceholder}
            aria-label={resolvedSearchPlaceholder}
            aria-controls={listboxId}
            className='w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-teal-400 focus:bg-white focus:ring-2 focus:ring-teal-500/20'
          />
        </div>
      </div>

      <div
        id={listboxId}
        role='listbox'
        aria-multiselectable={multiple || undefined}
        style={{ maxHeight: position.maxHeight }}
        className='overflow-y-auto p-1.5'>
        {filteredOptions.length > 0 ? (
          filteredOptions.map((option, index) => {
            const isSelected = selectedValues.includes(String(option.value))
            const isActive = index === activeIndex
            return (
              <button
                key={option.value}
                type='button'
                role='option'
                aria-selected={isSelected}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => selectOption(option)}
                className={cn(
                  'flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors',
                  isSelected ? 'bg-teal-50 font-medium text-teal-700' : 'text-slate-700',
                  isActive && !isSelected && 'bg-slate-50',
                )}>
                <span className='truncate'>{option.label}</span>
                {isSelected && <Check className='h-4 w-4 shrink-0 text-teal-600' />}
              </button>
            )
          })
        ) : (
          <p className='px-3 py-6 text-center text-sm text-slate-500'>{resolvedNoResults}</p>
        )}
      </div>
    </div>
  )

  return (
    <div className={cn('space-y-1.5', containerClassName, className)}>
      {label && (
        <label htmlFor={fieldId} className='block text-sm font-medium text-slate-700'>
          {label}
          {required && <span className='ml-0.5 text-rose-500'>*</span>}
        </label>
      )}

      <button
        ref={triggerRef}
        id={fieldId}
        type='button'
        role='combobox'
        disabled={disabled}
        aria-label={ariaLabel || (label ? undefined : resolvedPlaceholder)}
        aria-expanded={isOpen}
        aria-controls={isOpen ? listboxId : undefined}
        aria-haspopup='listbox'
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy}
        onKeyDown={handleTriggerKeyDown}
        onClick={() => (isOpen ? closeDropdown(false) : openDropdown())}
        className={cn(
          'flex w-full items-center justify-between gap-3 rounded-xl border bg-white px-4 py-2.5 text-left text-sm transition-all',
          'focus:border-transparent focus:outline-none focus:ring-2',
          disabled && 'cursor-not-allowed bg-slate-50 text-slate-400',
          error
            ? 'border-rose-300 focus:ring-rose-500'
            : 'border-slate-200 hover:border-slate-300 focus:ring-teal-500',
        )}>
        <span className={cn('truncate', !hasSelection ? 'text-slate-400' : 'text-slate-700')}>
          {triggerLabel}
        </span>
        <ChevronDown
          className={cn('h-5 w-5 shrink-0 text-slate-400 transition-transform', isOpen && 'rotate-180')}
        />
      </button>

      {multiple && selectedOptions.length > 0 && (
        <ul className='flex flex-wrap gap-1.5 pt-0.5'>
          {selectedOptions.map((option) => (
            <li key={option.value}>
              <span className='inline-flex items-center gap-1 rounded-lg bg-teal-50 py-1 pl-2.5 pr-1 text-xs font-medium text-teal-700'>
                {option.label}
                <button
                  type='button'
                  disabled={disabled}
                  onClick={() => removeValue(option.value)}
                  aria-label={t('common.remove_filter')}
                  title={t('common.remove_filter')}
                  className='rounded p-0.5 text-teal-600 transition hover:bg-teal-100 hover:text-teal-800 disabled:cursor-not-allowed disabled:opacity-50'>
                  <X className='h-3.5 w-3.5' />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p id={errorId} role='alert' className='text-sm text-rose-600'>
          {error}
        </p>
      )}
      {hint && !error && <p id={hintId} className='text-sm text-slate-500'>{hint}</p>}

      {typeof document !== 'undefined' && dropdown ? createPortal(dropdown, document.body) : null}
    </div>
  )
}

export default SearchableSelect
