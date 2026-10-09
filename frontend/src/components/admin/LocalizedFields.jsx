import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Languages } from 'lucide-react'
import Input from '../ui/Input'
import Textarea from '../ui/Textarea'
import { cn } from '../../utils/helpers'
import { LANGUAGES } from '../../i18n'
import { CONTENT_LOCALES } from '../../config/contentLocales'
import { countMissingTranslations } from '../../utils/localizedContent'

/**
 * Вкладки «Русский / Қазақша / English» для переводимых полей модалки.
 *
 * Язык контента выбирается здесь, а не переключением языка всей админки:
 * раньше перевести карточку можно было, только сменив язык интерфейса, а у
 * части разделов переводов не было вовсе.
 *
 * fields: [{ key, label, multiline?, rows?, required?, maxLength?, placeholder? }]
 * getValue(locale, key) / setValue(locale, key, value) — где лежит текст,
 * решает страница (обычные поля для ru, `i18n` или nameKk/nameEn для остальных).
 */
export default function LocalizedFields({ fields, getValue, setValue, className }) {
  const { t } = useTranslation()
  const [locale, setLocale] = useState('ru')
  const baseId = useId()
  const tabs = CONTENT_LOCALES.map((code) => LANGUAGES.find((lang) => lang.code === code) || { code, fullLabel: code })
  const isSource = locale === 'ru'

  return (
    <div className={cn('rounded-xl border border-slate-200', className)}>
      <div
        role='tablist'
        aria-label={t('admin_i18n.tabs_label')}
        className='flex flex-wrap items-center gap-1 border-b border-slate-200 bg-slate-50 p-1.5'
      >
        <Languages className='mx-1.5 h-4 w-4 shrink-0 text-slate-400' aria-hidden='true' />
        {tabs.map((lang) => {
          const active = locale === lang.code
          const missing = lang.code === 'ru' ? 0 : countMissingTranslations(getValue, fields, lang.code)
          return (
            <button
              key={lang.code}
              type='button'
              role='tab'
              id={`${baseId}-tab-${lang.code}`}
              aria-selected={active}
              aria-controls={`${baseId}-panel`}
              onClick={() => setLocale(lang.code)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500',
                active ? 'bg-teal-600 text-white' : 'text-slate-600 hover:bg-white',
              )}
            >
              {lang.fullLabel}
              {lang.code !== 'ru' && (missing > 0 ? (
                <span
                  className={cn('h-1.5 w-1.5 rounded-full', active ? 'bg-white' : 'bg-amber-500')}
                  title={t('admin_i18n.missing', { count: missing })}
                  aria-label={t('admin_i18n.missing', { count: missing })}
                />
              ) : (
                <Check className='h-3.5 w-3.5' aria-label={t('admin_i18n.complete')} />
              ))}
            </button>
          )
        })}
      </div>

      <div id={`${baseId}-panel`} role='tabpanel' aria-labelledby={`${baseId}-tab-${locale}`} className='space-y-4 p-4'>
        {!isSource && <p className='text-xs text-slate-500'>{t('admin_i18n.fallback_hint')}</p>}
        {fields.map((field) => {
          const Component = field.multiline ? Textarea : Input
          const source = String(getValue('ru', field.key) ?? '')
          return (
            <Component
              key={`${locale}-${field.key}`}
              label={field.label}
              required={isSource && field.required}
              rows={field.multiline ? field.rows || 3 : undefined}
              maxLength={field.maxLength}
              value={getValue(locale, field.key) ?? ''}
              onChange={(event) => setValue(locale, field.key, event.target.value)}
              // В переводе подсказкой служит русский текст — видно, что переводить.
              placeholder={isSource ? field.placeholder : source.slice(0, 160) || field.placeholder}
            />
          )
        })}
      </div>
    </div>
  )
}
