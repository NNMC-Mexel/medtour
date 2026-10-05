import { Link, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Capacitor } from '@capacitor/core'
import { SearchX } from 'lucide-react'
import Button from '../components/ui/Button'
import useSeo from '../components/seo/useSeo'

/**
 * Неизвестный адрес. Раньше любой адрес молча уводил на главную, и поисковики
 * видели копию сайта под мусорными URL; теперь — честное «не найдено» с
 * noindex (код 404 отдаёт веб-сервер, см. frontend/Caddyfile).
 */
export default function NotFoundPage() {
  const { t } = useTranslation()
  useSeo({ title: t('seo.not_found_title'), description: t('seo.not_found_text'), noindex: true })

  // В приложении нет публичного сайта — ведём на вход, как раньше.
  if (Capacitor.isNativePlatform()) return <Navigate to='/login' replace />

  return (
    <section className='flex min-h-[60vh] items-center justify-center bg-slate-50 px-4 pb-16 pt-28'>
      <div className='max-w-md text-center'>
        <div className='mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-50 text-teal-600'>
          <SearchX className='h-8 w-8' />
        </div>
        <p className='text-sm font-semibold uppercase tracking-wide text-teal-600'>404</p>
        <h1 className='mt-2 text-2xl font-bold text-slate-900'>{t('seo.not_found_title').split(' — ')[0]}</h1>
        <p className='mt-3 text-slate-600'>{t('seo.not_found_text')}</p>
        <Link to='/' className='mt-6 inline-block'>
          <Button>{t('seo.not_found_home')}</Button>
        </Link>
      </div>
    </section>
  )
}
