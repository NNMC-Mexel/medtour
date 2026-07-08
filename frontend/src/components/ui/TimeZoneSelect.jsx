import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '../../utils/helpers'
import {
  foldTimezoneText,
  getTimezoneLabel,
  getTimezoneOptions,
  normalizeTimezoneValue,
} from '../../utils/timezones'

function TimeZoneSelect({
  label,
  name,
  value,
  onChange,
  error,
  required,
  disabled,
  leftIcon,
  placeholder,
  containerClassName,
  className,
}) {
  const { t } = useTranslation()
  const rootRef = useRef(null)
  const searchRef = useRef(null)
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')

  const normalizedValue = normalizeTimezoneValue(value)
  const selectedLabel = getTimezoneLabel(normalizedValue) || value || ''
  const resolvedPlaceholder = placeholder || 'Select timezone'

  const options = useMemo(() => getTimezoneOptions(), [])
  const filteredOptions = useMemo(() => {
    const search = foldTimezoneText(query)
    if (!search) return options

    return options.filter((option) => (
      foldTimezoneText(option.label).includes(search)
      || foldTimezoneText(option.value).includes(search)
    ))
  }, [options, query])

  useEffect(() => {
    if (!isOpen) return undefined

    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setIsOpen(false)
        setQuery('')
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [isOpen])

  useEffect(() => {
    if (isOpen) searchRef.current?.focus()
  }, [isOpen])

  const handleSelect = (timezone) => {
    onChange?.({ target: { name, value: timezone } })
    setIsOpen(false)
    setQuery('')
  }

  return (
    <div ref={rootRef} className={cn('space-y-1.5', containerClassName)}>
      {label && (
        <label className="block text-sm font-medium text-slate-700">
          {label}
          {required && <span className="text-rose-500 ml-0.5">*</span>}
        </label>
      )}

      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen((current) => !current)}
          className={cn(
            'w-full min-h-[46px] px-4 py-2.5 rounded-xl border bg-white text-left transition-all duration-200',
            'focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent',
            'disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed',
            error ? 'border-rose-300 focus:ring-rose-500' : 'border-slate-200 hover:border-slate-300',
            leftIcon && 'pl-10',
            className
          )}
        >
          <span className={cn('block truncate pr-8', !selectedLabel && 'text-slate-400')}>
            {selectedLabel || resolvedPlaceholder}
          </span>
        </button>

        {leftIcon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
            {leftIcon}
          </div>
        )}
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />

        {isOpen && !disabled && (
          <div className="absolute z-30 mt-2 w-full rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="p-2 border-b border-slate-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  ref={searchRef}
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t('common.country_search_placeholder')}
                  autoComplete="new-password"
                  autoCorrect="off"
                  spellCheck="false"
                  data-lpignore="true"
                  data-form-type="other"
                  className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            <div className="max-h-64 overflow-y-auto py-1">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleSelect(option.value)}
                    className={cn(
                      'flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-teal-50',
                      normalizedValue === option.value ? 'bg-teal-50 text-teal-700' : 'text-slate-700'
                    )}
                  >
                    <span className="truncate">{option.label}</span>
                  </button>
                ))
              ) : (
                <p className="px-3 py-4 text-sm text-slate-500">
                  {t('common.country_no_results')}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm text-rose-600">{error}</p>
      )}
    </div>
  )
}

export default TimeZoneSelect
