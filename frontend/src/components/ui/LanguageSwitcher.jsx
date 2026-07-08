import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, Globe2 } from 'lucide-react'
import { LANGUAGES } from '../../i18n'
import { cn } from '../../utils/helpers'

function LanguageSwitcher({ variant = 'light', dropUp = false, mode = 'dropdown', className }) {
  const { i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  const currentLanguageCode = String(i18n.resolvedLanguage || i18n.language || '').split('-')[0]
  const current = LANGUAGES.find((l) => l.code === currentLanguageCode) || LANGUAGES[0]
  const mobileLanguages = ['ru', 'kk', 'en']
    .map((code) => LANGUAGES.find((language) => language.code === code))
    .filter(Boolean)

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const changeLanguage = (code) => {
    i18n.changeLanguage(code)
    setOpen(false)
  }

  const isDark = variant === 'dark'

  if (mode === 'segmented') {
    return (
      <div
        className={cn(
          'flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1.5',
          className
        )}
        role="group"
        aria-label="Change language"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-teal-700 shadow-sm">
          <Globe2 className="h-4 w-4" />
        </div>
        <div className="grid flex-1 grid-cols-3 gap-1">
          {mobileLanguages.map((lang) => {
            const isActive = current.code === lang.code
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => changeLanguage(lang.code)}
                className={cn(
                  'min-h-9 rounded-xl px-2 text-sm font-semibold transition-colors',
                  isActive
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900'
                )}
                aria-pressed={isActive}
              >
                {lang.label}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className={cn('relative', className)} ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
          isDark
            ? 'text-white/80 hover:bg-white/10 hover:text-white'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        )}
        aria-label="Change language"
      >
        <span>{current.label}</span>
        <ChevronDown
          className={cn('w-3.5 h-3.5 transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div className={`absolute right-0 w-36 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-50 animate-slideDown ${dropUp ? 'bottom-full mb-1.5' : 'top-full mt-1.5'}`}>
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => changeLanguage(lang.code)}
              className={cn(
                'w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center justify-between',
                current.code === lang.code
                  ? 'bg-teal-50 text-teal-700 font-semibold'
                  : 'text-slate-700 hover:bg-slate-50'
              )}
            >
              <span>{lang.fullLabel}</span>
              <span className="text-xs text-slate-400">{lang.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default LanguageSwitcher
