import { createElement } from 'react'
import { useTranslation } from 'react-i18next'
import { Check } from 'lucide-react'
import { cn } from '../../utils/helpers'
import {
  SPECIALIZATION_ICONS,
  getSpecializationIconEntry,
  getSpecializationIconLabel,
  resolveSpecializationIcon,
} from '../../config/specializationIcons'

/**
 * Выбор иконки специализации из реестра вместо ввода текстового ключа.
 * Первая плитка — «по названию»: ключ очищается, и сайт берёт иконку по
 * названию специализации, как для записей без иконки.
 */
export default function SpecializationIconPicker({ value, onChange, name }) {
  const { t, i18n } = useTranslation()
  const selected = getSpecializationIconEntry(value)
  const AutoIcon = resolveSpecializationIcon('', name)
  const legacyKey = value && !selected ? value : null

  const tileClass = (active) => cn(
    'relative flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-xl border p-2 text-center text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500',
    active
      ? 'border-teal-600 bg-teal-50 text-teal-800'
      : 'border-slate-200 bg-white text-slate-600 hover:border-teal-300 hover:bg-slate-50',
  )

  return (
    <fieldset className='space-y-2'>
      <legend className='mb-1.5 block text-sm font-medium text-slate-700'>{t('admin_spec.label_icon')}</legend>
      <div role='radiogroup' aria-label={t('admin_spec.label_icon')} className='grid max-h-72 grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-5'>
        <button
          type='button'
          role='radio'
          aria-checked={!selected}
          onClick={() => onChange('')}
          className={tileClass(!selected)}
        >
          {createElement(AutoIcon, { className: 'h-6 w-6', 'aria-hidden': 'true' })}
          <span className='line-clamp-2 leading-tight'>{t('admin_spec.icon_auto')}</span>
          {!selected && <Check className='absolute right-1.5 top-1.5 h-3.5 w-3.5 text-teal-600' aria-hidden='true' />}
        </button>
        {SPECIALIZATION_ICONS.map((entry) => {
          const active = selected?.key === entry.key
          const label = getSpecializationIconLabel(entry, i18n.language)
          return (
            <button
              key={entry.key}
              type='button'
              role='radio'
              aria-checked={active}
              title={label}
              onClick={() => onChange(entry.key)}
              className={tileClass(active)}
            >
              <entry.Icon className='h-6 w-6' aria-hidden='true' />
              <span className='line-clamp-2 leading-tight'>{label}</span>
              {active && <Check className='absolute right-1.5 top-1.5 h-3.5 w-3.5 text-teal-600' aria-hidden='true' />}
            </button>
          )
        })}
      </div>
      <p className='text-xs text-slate-500'>
        {legacyKey ? t('admin_spec.icon_legacy_hint', { key: legacyKey }) : t('admin_spec.icon_hint')}
      </p>
    </fieldset>
  )
}
