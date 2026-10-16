import { Headset, Phone } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { contactHref, messengersOnNumber } from '../../config/siteContent'

const TONES = {
  footer: {
    label: 'text-xs font-semibold uppercase tracking-[.12em] text-slate-400',
    number: 'text-sm text-slate-300 hover:text-white',
    tag: 'text-xs text-teal-400 hover:text-white',
    icon: 'text-teal-500',
  },
  accent: {
    // На accent-strong стандартной палитры даже белый даёт ~5:1 — без прозрачности.
    label: 'text-xs font-bold uppercase tracking-[.16em] text-white',
    number: 'text-base font-semibold text-white underline-offset-4 hover:underline',
    tag: 'text-xs font-semibold text-white underline decoration-white/40 underline-offset-2 hover:decoration-white',
    icon: 'text-mt-glow-soft',
  },
}

/**
 * Телефоны из Admin > Контент сайта > Контакты: call-центр ННМЦ и координатор
 * (мобильный, он же WhatsApp/Telegram, и городской). Пустые номера скрыты;
 * если номеров нет вовсе, не выводится и heading.
 */
function ContactPhones({ contacts, tone = 'footer', className = 'space-y-4', heading = null }) {
  const { t } = useTranslation()
  const styles = TONES[tone]
  const groups = [
    { id: 'callCenter', icon: Phone, label: t('footer.call_center'), numbers: [contacts.phone] },
    { id: 'coordinator', icon: Headset, label: t('footer.coordinator'), numbers: [contacts.coordinatorMobile, contacts.coordinatorPhone] },
  ]
    .map((group) => ({ ...group, numbers: group.numbers.filter((number) => contactHref('phone', number)) }))
    .filter((group) => group.numbers.length)

  if (!groups.length) return null
  return (
    <>
      {heading}
      <ul className={className}>
        {groups.map(({ id, icon: Icon, label, numbers }) => (
          <li key={id} className='flex items-start gap-3'>
            <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${styles.icon}`} />
            <div className='min-w-0'>
              <p className={styles.label}>{label}</p>
              {numbers.map((number) => {
                const messengers = messengersOnNumber(contacts, number)
                return (
                  <div key={number} className='mt-1'>
                    <a href={contactHref('phone', number)} className={`whitespace-nowrap transition-colors ${styles.number}`}>{number}</a>
                    {messengers.length > 0 && (
                      <p className='flex gap-3'>
                        {messengers.map(({ kind, label: messenger, href }) => (
                          <a key={kind} href={href} target='_blank' rel='noreferrer' className={`transition-colors ${styles.tag}`}>{messenger}</a>
                        ))}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}

export default ContactPhones
