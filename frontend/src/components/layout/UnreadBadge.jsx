import { useTranslation } from 'react-i18next'

/**
 * Число непрочитанных на пункте меню «Сообщения». Сам кружок скрыт от
 * скринридера, число дублируется текстом.
 */
export default function UnreadBadge({ count, className = '' }) {
  const { t } = useTranslation()
  if (!count) return null
  return (
    <>
      <span
        aria-hidden="true"
        className={`absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-white ${className}`}
      >
        {count > 99 ? '99+' : count}
      </span>
      <span className="sr-only">{t('chat.unread_count', { count })}</span>
    </>
  )
}
