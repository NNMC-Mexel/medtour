import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ExternalLink, FileText, Loader2, Upload, X } from 'lucide-react'
import { getMediaUrl, uploadFile } from '../../services/api'

// Сертификаты публичные: их видит любой посетитель страницы врача. Сервер
// принимает только PDF и изображения и не больше 20 файлов
// (server/src/utils/doctor-certificates.ts).
const MAX_CERTIFICATES = 20
const MAX_FILE_BYTES = 20 * 1024 * 1024
const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
const ACCEPT_ATTR = '.pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp'

// Отказ сервера (utils/doctor-certificates.ts) — его код, иначе общий текст.
const serverErrorKey = (error, fallback) => {
  const code = String(error?.response?.data?.error?.details?.code || '')
  return code.startsWith('certificates_') ? `doctor_certificates.${code}` : fallback
}

const isPdf = (file) => String(file?.mime || file?.type || '').toLowerCase() === 'application/pdf'

/** Название без расширения и подчёркиваний, которые ставит санитайзер загрузки. */
const certificateTitle = (file) =>
  String(file?.caption || file?.name || '')
    .replace(/\.[a-z0-9]{2,5}$/i, '')
    .replace(/_+/g, ' ')
    .trim() || '—'

function CertificateThumb({ file, size = 'md' }) {
  const box = size === 'lg' ? 'h-36' : 'h-12 w-12 shrink-0'
  if (isPdf(file)) {
    return (
      <div className={`${box} flex items-center justify-center rounded-lg bg-rose-50 text-rose-600`}>
        <FileText className={size === 'lg' ? 'h-10 w-10' : 'h-6 w-6'} aria-hidden="true" />
      </div>
    )
  }
  return (
    <img
      src={getMediaUrl(file?.formats?.small || file?.formats?.thumbnail || file)}
      alt=""
      loading="lazy"
      className={`${box} rounded-lg object-cover bg-slate-100 ${size === 'lg' ? 'w-full' : ''}`}
    />
  )
}

/**
 * Редактор списка сертификатов. Управляемый: `value` — файлы Strapi,
 * `onChange(next)` получает новый список. Загрузка идёт сразу при выборе
 * файла; привязка к врачу — при сохранении (onChange решает, когда).
 */
export function DoctorCertificatesEditor({ value = [], onChange, disabled = false, busy = false }) {
  const { t } = useTranslation()
  const inputRef = useRef(null)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState('')
  const list = Array.isArray(value) ? value : []
  const locked = disabled || busy || isUploading

  const handleFiles = async (event) => {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    if (files.length === 0) return
    setError('')

    if (list.length + files.length > MAX_CERTIFICATES) {
      setError(t('doctor_certificates.err_too_many', { max: MAX_CERTIFICATES }))
      return
    }
    const wrongType = files.find((file) => !ACCEPTED_TYPES.includes(String(file.type).toLowerCase()))
    if (wrongType) {
      setError(t('doctor_certificates.err_type', { name: wrongType.name }))
      return
    }
    const tooBig = files.find((file) => file.size > MAX_FILE_BYTES)
    if (tooBig) {
      setError(t('doctor_certificates.err_size', { name: tooBig.name }))
      return
    }

    setIsUploading(true)
    try {
      const uploaded = []
      for (const file of files) uploaded.push(await uploadFile(file))
      await onChange([...list, ...uploaded])
    } catch (uploadError) {
      console.error('Certificate upload failed:', uploadError)
      setError(t(serverErrorKey(uploadError, 'doctor_certificates.err_upload')))
    } finally {
      setIsUploading(false)
    }
  }

  const remove = async (fileId) => {
    setError('')
    try {
      await onChange(list.filter((file) => file.id !== fileId))
    } catch (removeError) {
      console.error('Certificate remove failed:', removeError)
      setError(t(serverErrorKey(removeError, 'doctor_certificates.err_save')))
    }
  }

  return (
    <div className="space-y-3">
      {list.length > 0 && (
        <ul className="space-y-2">
          {list.map((file) => (
            <li key={file.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-2">
              <CertificateThumb file={file} />
              <a
                href={getMediaUrl(file)}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800 hover:text-teal-700 hover:underline"
                title={certificateTitle(file)}
              >
                {certificateTitle(file)}
              </a>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => remove(file.id)}
                  disabled={locked}
                  aria-label={t('doctor_certificates.remove', { name: certificateTitle(file) })}
                  title={t('doctor_certificates.remove', { name: certificateTitle(file) })}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {list.length === 0 && disabled && (
        <p className="text-sm text-slate-500">{t('doctor_certificates.empty')}</p>
      )}

      {!disabled && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT_ATTR}
            multiple
            onChange={handleFiles}
            className="hidden"
            data-testid="certificates-input"
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={locked || list.length >= MAX_CERTIFICATES}
            className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-4 py-3 text-sm font-medium text-slate-600 transition-colors hover:border-teal-400 hover:text-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isUploading || busy
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Upload className="h-4 w-4" />}
            {isUploading ? t('doctor_certificates.uploading') : t('doctor_certificates.add')}
          </button>
          <p className="text-xs text-slate-500">{t('doctor_certificates.hint', { max: MAX_CERTIFICATES })}</p>
        </>
      )}

      {error && (
        <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      )}
    </div>
  )
}

/** Сетка сертификатов на публичной странице врача (заголовок даёт страница). */
export function DoctorCertificatesGallery({ certificates }) {
  const { t } = useTranslation()
  const list = Array.isArray(certificates) ? certificates : []
  if (list.length === 0) return null

  return (
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {list.map((file) => (
          <li key={file.id}>
            <a
              href={getMediaUrl(file)}
              target="_blank"
              rel="noopener noreferrer"
              className="group block overflow-hidden rounded-xl border border-slate-200 bg-white transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            >
              <CertificateThumb file={file} size="lg" />
              <span className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-700">
                <span className="min-w-0 flex-1 truncate" title={certificateTitle(file)}>{certificateTitle(file)}</span>
                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-400 group-hover:text-teal-600" aria-hidden="true" />
                <span className="sr-only">{t('doctor_certificates.open')}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
  )
}
