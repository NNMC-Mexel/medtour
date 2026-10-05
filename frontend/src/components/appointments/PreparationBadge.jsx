import { FileCheck2, FileWarning } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '../../utils/helpers'

/**
 * Готовность пациента к консультации: есть ли его документы в кейсе.
 * Сервер добавляет appointment.preparation в выдачу для врача и сотрудников.
 */
export default function PreparationBadge({ preparation, className }) {
  const { t } = useTranslation()
  if (!preparation || preparation.status === 'no_case') return null

  const uploaded = preparation.status === 'documents_uploaded'
  const Icon = uploaded ? FileCheck2 : FileWarning
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs font-medium',
        uploaded ? 'text-emerald-700' : 'text-amber-700',
        className,
      )}
    >
      <Icon className='h-3.5 w-3.5 shrink-0' />
      {uploaded
        ? t('preparation.documents_uploaded', { count: preparation.documentsCount })
        : t('preparation.documents_missing')}
    </span>
  )
}
