import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Clock, Star } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getMediaUrl } from '../../services/api'
import { treatmentUi } from '../../data/treatmentDepartments'
import { cn, getDoctorField, getInitials, getSpecName, isDoctorOnline } from '../../utils/helpers'

const colors = [
  'from-teal-400 to-teal-700', 'from-sky-400 to-sky-700', 'from-violet-400 to-violet-700',
  'from-rose-400 to-rose-700', 'from-amber-400 to-amber-700', 'from-indigo-400 to-indigo-700',
]

function DoctorTreatmentCard({ doctor }) {
  const { t, i18n } = useTranslation()
  const name = getDoctorField(doctor, 'fullName', i18n.language) || doctor.fullName
  const localizedSpecialization = i18n.language === 'en'
    ? doctor.specialization?.nameEn
    : i18n.language === 'kk'
      ? doctor.specialization?.nameKk
      : getSpecName(doctor.specialization, i18n.language)
  const specialization = localizedSpecialization || t('common.specialist')
  const photoUrl = getMediaUrl(doctor.photo)
  const color = colors[(name?.charCodeAt(0) || 0) % colors.length]
  const experience = doctor.experience || 0
  const rating = Math.min(doctor.rating || 0, 5)
  const yearWord = experience === 1 ? t('common.year_1') : experience >= 2 && experience <= 4 ? t('common.year_2_4') : t('common.year_many')

  return (
    <Link
      to={`/doctors/${doctor.documentId || doctor.id}`}
      className='group block h-full rounded-3xl bg-white border border-slate-200 overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300'
    >
      <div className='relative aspect-[4/4.6] overflow-hidden bg-slate-100'>
        {photoUrl ? (
          <img src={photoUrl} alt={name} className='h-full w-full object-cover object-top group-hover:scale-[1.03] transition-transform duration-500' />
        ) : (
          <div className={cn('h-full w-full bg-gradient-to-br flex items-center justify-center text-5xl font-bold text-white', color)}>
            {getInitials(name)}
          </div>
        )}
        {isDoctorOnline(doctor) && (
          <span className='absolute bottom-4 right-4 inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white shadow-lg'>
            <span className='h-1.5 w-1.5 rounded-full bg-white animate-pulse' />
            {t('common.online')}
          </span>
        )}
      </div>
      <div className='p-5'>
        <h3 className='text-lg font-semibold text-slate-900 line-clamp-1 group-hover:text-teal-700 transition-colors'>{name}</h3>
        <p className='mt-1 text-sm font-medium text-teal-600'>{specialization}</p>
        <div className='mt-4 flex items-center gap-4 text-sm text-slate-600'>
          <span className='inline-flex items-center gap-1.5'>
            <Star className='h-4 w-4 fill-amber-400 text-amber-400' />
            <b className='text-slate-900'>{rating.toFixed(1)}</b>
          </span>
          <span className='inline-flex items-center gap-1.5'>
            <Clock className='h-4 w-4' />
            {experience} {yearWord}
          </span>
        </div>
      </div>
    </Link>
  )
}

export default function TreatmentDoctorsCarousel({ doctors }) {
  const { i18n } = useTranslation()
  const language = ['ru', 'en', 'kk'].includes(i18n.language) ? i18n.language : 'ru'
  const navigationLabels = treatmentUi[language]
  const [index, setIndex] = useState(0)
  const [perView, setPerView] = useState(3)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    const update = () => setPerView(window.innerWidth < 640 ? 1 : window.innerWidth < 1024 ? 2 : 3)
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const canSlide = doctors.length > perView
  const safeIndex = doctors.length > 0 ? index % doctors.length : 0
  useEffect(() => {
    if (!canSlide || paused) return undefined
    const timer = window.setInterval(() => setIndex((value) => (value + 1) % doctors.length), 4500)
    return () => window.clearInterval(timer)
  }, [canSlide, doctors.length, paused])

  const visibleDoctors = useMemo(() => {
    if (!canSlide) return doctors
    return Array.from({ length: perView }, (_, offset) => doctors[(safeIndex + offset) % doctors.length])
  }, [canSlide, doctors, safeIndex, perView])

  const previous = () => setIndex((value) => (value - 1 + doctors.length) % doctors.length)
  const next = () => setIndex((value) => (value + 1) % doctors.length)

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className='grid gap-6 sm:grid-cols-2 lg:grid-cols-3' aria-live={paused ? 'polite' : 'off'}>
        {visibleDoctors.map((doctor, offset) => (
          <DoctorTreatmentCard key={`${doctor.documentId || doctor.id}-${safeIndex}-${offset}`} doctor={doctor} />
        ))}
      </div>
      {canSlide && (
        <div className='mt-8 flex items-center justify-between'>
          <div className='flex gap-1.5' aria-hidden='true'>
            {doctors.map((doctor, dotIndex) => (
              <span key={doctor.documentId || doctor.id} className={cn('h-1.5 rounded-full transition-all', dotIndex === safeIndex ? 'w-8 bg-teal-600' : 'w-1.5 bg-slate-300')} />
            ))}
          </div>
          <div className='flex gap-2'>
            <button type='button' onClick={previous} aria-label={navigationLabels.previousDoctors} className='h-11 w-11 rounded-full border border-slate-200 bg-white flex items-center justify-center hover:border-teal-400 hover:text-teal-700 transition-colors'>
              <ArrowLeft className='h-5 w-5' />
            </button>
            <button type='button' onClick={next} aria-label={navigationLabels.nextDoctors} className='h-11 w-11 rounded-full border border-slate-200 bg-white flex items-center justify-center hover:border-teal-400 hover:text-teal-700 transition-colors'>
              <ArrowRight className='h-5 w-5' />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
