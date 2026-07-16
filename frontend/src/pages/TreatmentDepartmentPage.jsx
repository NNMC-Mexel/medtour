import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Activity, ArrowLeft, ArrowRight, Brain, Check, CheckCircle2, Clock3, Heart, HeartPulse,
  Loader2, ScanLine, ShieldCheck, Stethoscope, Syringe, Venus,
} from 'lucide-react'
import Button from '../components/ui/Button'
import TreatmentDoctorsCarousel from '../components/treatments/TreatmentDoctorsCarousel'
import { contentAPI, doctorsAPI, getMediaUrl, normalizeResponse } from '../services/api'
import {
  doctorBelongsToTreatmentDepartment,
  getTreatmentDepartment,
  localizeDepartment,
  mergeTreatmentDepartments,
  treatmentUi,
} from '../data/treatmentDepartments'

const icons = { Activity, Brain, Heart, HeartPulse, ScanLine, Stethoscope, Syringe, Venus }
const accents = {
  teal: 'from-teal-500 to-cyan-500', sky: 'from-sky-500 to-cyan-500', violet: 'from-violet-500 to-indigo-500',
  amber: 'from-amber-500 to-orange-500', rose: 'from-rose-500 to-red-500', indigo: 'from-indigo-500 to-violet-500',
  pink: 'from-pink-500 to-rose-500', red: 'from-red-500 to-rose-600',
}

function resolveHeroImage(image) {
  if (typeof image === 'string' && image.startsWith('/treatments/')) return image
  return getMediaUrl(image) || image
}

function SectionHeading({ eyebrow, title, text, dark = false }) {
  return (
    <div className='max-w-3xl mb-10'>
      {eyebrow && <p className={`mb-3 text-sm font-semibold uppercase tracking-[0.18em] ${dark ? 'text-teal-300' : 'text-teal-700'}`}>{eyebrow}</p>}
      <h2 className={`text-3xl sm:text-4xl font-bold ${dark ? 'text-white' : 'text-slate-950'}`}>{title}</h2>
      {text && <p className={`mt-4 text-lg leading-8 ${dark ? 'text-white/70' : 'text-slate-600'}`}>{text}</p>}
    </div>
  )
}

export default function TreatmentDepartmentPage() {
  const { slug } = useParams()
  const { i18n } = useTranslation()
  const [cmsDepartments, setCmsDepartments] = useState(null)
  const availableDepartments = useMemo(() => mergeTreatmentDepartments(cmsDepartments), [cmsDepartments])
  const department = getTreatmentDepartment(slug, availableDepartments)
  const language = ['ru', 'en', 'kk'].includes(i18n.language) ? i18n.language : 'ru'
  const ui = treatmentUi[language]
  const localized = localizeDepartment(department, language)
  const [doctors, setDoctors] = useState([])
  const [loadingDoctors, setLoadingDoctors] = useState(true)

  useEffect(() => {
    let active = true
    contentAPI.getGlobal()
      .then((response) => {
        const { data } = normalizeResponse(response)
        if (active) setCmsDepartments(data?.treatmentDepartments || [])
      })
      .catch((error) => {
        console.error('Error loading treatment department content:', error)
        if (active) setCmsDepartments([])
      })
    return () => { active = false }
  }, [slug])

  useEffect(() => {
    if (!department) return undefined
    let active = true
    doctorsAPI.getAll()
      .then((response) => {
        const { data } = normalizeResponse(response)
        if (active) setDoctors((data || []).filter((doctor) => doctorBelongsToTreatmentDepartment(doctor, department)))
      })
      .catch((error) => console.error('Error loading department doctors:', error))
      .finally(() => { if (active) setLoadingDoctors(false) })
    return () => { active = false }
  }, [department])

  const Icon = department ? icons[department.icon] || Stethoscope : Stethoscope
  const accent = department ? accents[department.accent] || accents.teal : accents.teal
  const stats = useMemo(() => department ? [
    { value: `${localized.programs.length}`, label: ui.specialists },
    { value: '1–3', label: language === 'en' ? 'days for assessment' : language === 'kk' ? 'күнде диагностика' : 'дня на диагностику' },
    { value: '24/7', label: language === 'en' ? 'patient support' : language === 'kk' ? 'сүйемелдеу' : 'сопровождение' },
  ] : [], [department, language, localized, ui.specialists])

  // Custom departments exist only in CMS. Wait for the global-content request
  // before deciding that a slug is unknown; otherwise they are redirected on
  // the first render while the request is still in flight.
  if (!department && cmsDepartments === null) {
    return <div className='flex min-h-[60vh] items-center justify-center'><Loader2 className='h-8 w-8 animate-spin text-teal-600' /></div>
  }
  if (!department) return <Navigate to='/#specializations' replace />

  return (
    <main className='bg-white text-slate-900'>
      <section className='relative min-h-[720px] flex items-end overflow-hidden'>
        <img src={resolveHeroImage(department.heroImage)} alt='' className='absolute inset-0 h-full w-full object-cover' />
        <div className='absolute inset-0 bg-gradient-to-r from-slate-950/95 via-slate-950/76 to-slate-900/25' />
        <div className={`absolute inset-0 bg-gradient-to-tr ${accent} opacity-20 mix-blend-screen`} />
        <div className='relative max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pb-16 pt-36 sm:pb-20'>
          <Link to='/#specializations' className='inline-flex items-center gap-2 text-sm font-medium text-white/75 hover:text-white transition-colors'>
            <ArrowLeft className='h-4 w-4' /> {ui.back}
          </Link>
          <div className='mt-10 max-w-4xl'>
            <span className='inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur-md'>
              <Icon className='h-4 w-4 text-teal-200' /> {ui.badge}
            </span>
            <h1 className='mt-6 text-4xl sm:text-6xl lg:text-7xl font-bold leading-[1.05] text-white'>{localized.displayTitle}</h1>
            <p className='mt-6 max-w-2xl text-lg sm:text-xl leading-8 text-white/80'>{localized.displayShort}</p>
            <div className='mt-8 flex flex-col sm:flex-row gap-3'>
              <Button as={Link} to='/register' size='lg' rightIcon={<ArrowRight className='h-5 w-5' />}>{ui.request}</Button>
              <Button as='a' href='#programs' size='lg' variant='outline' className='border-white/40 bg-white/10 text-white hover:bg-white/20'>{ui.programs}</Button>
            </div>
          </div>
          <div className='mt-12 grid max-w-3xl grid-cols-3 gap-3 sm:gap-8 border-t border-white/20 pt-8'>
            {stats.map((stat) => <div key={stat.label}><p className='text-2xl sm:text-3xl font-bold text-white'>{stat.value}</p><p className='mt-1 text-xs sm:text-sm text-white/60'>{stat.label}</p></div>)}
          </div>
        </div>
      </section>

      <section className='py-20 sm:py-28'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20'>
          <div>
            <p className='text-sm font-semibold uppercase tracking-[0.18em] text-teal-700'>{ui.sourceNote}</p>
            <h2 className='mt-4 text-3xl sm:text-4xl font-bold text-slate-950'>{localized.displayTitle}</h2>
            <p className='mt-6 text-lg leading-8 text-slate-600'>{localized.summary}</p>
            <div className='mt-8 rounded-3xl border border-teal-100 bg-teal-50 p-6 flex gap-4'>
              <ShieldCheck className='h-7 w-7 flex-none text-teal-700' />
              <p className='text-sm leading-6 text-slate-700'>{ui.journeyLead}</p>
            </div>
          </div>
          <div>
            <h3 className='text-2xl font-bold text-slate-950'>{ui.services}</h3>
            <p className='mt-3 text-slate-600'>{ui.servicesLead}</p>
            <div className='mt-8 grid sm:grid-cols-2 gap-4'>
              {localized.services.map((service) => (
                <div key={service} className='flex gap-3 rounded-2xl border border-slate-200 p-4'>
                  <CheckCircle2 className='mt-0.5 h-5 w-5 flex-none text-teal-600' />
                  <span className='font-medium leading-6 text-slate-800'>{service}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id='programs' className='py-20 sm:py-28 bg-slate-50'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
          <SectionHeading eyebrow={ui.badge} title={ui.programs} text={ui.programsLead} />
          <div className='grid gap-6 md:grid-cols-2'>
            {localized.programs.map((program, index) => (
              <article key={program.name} className='rounded-3xl border border-slate-200 bg-white p-7 sm:p-8 shadow-sm hover:shadow-lg transition-shadow'>
                <div className='flex items-start justify-between gap-4'>
                  <span className={`h-12 w-12 rounded-2xl bg-gradient-to-br ${accent} flex items-center justify-center text-lg font-bold text-white`}>{String(index + 1).padStart(2, '0')}</span>
                  {(program.duration || program.stay) && <Clock3 className='h-5 w-5 text-slate-400' />}
                </div>
                <h3 className='mt-6 text-xl font-bold text-slate-950'>{program.name}</h3>
                <p className='mt-3 leading-7 text-slate-600'>{program.text}</p>
                {(program.duration || program.stay) && (
                  <div className='mt-6 flex flex-wrap gap-2'>
                    {program.duration && <span className='rounded-full bg-slate-100 px-3 py-1.5 text-sm text-slate-700'><b>{ui.duration}:</b> {program.duration}</span>}
                    {program.stay && <span className='rounded-full bg-teal-50 px-3 py-1.5 text-sm text-teal-800'><b>{ui.stay}:</b> {program.stay}</span>}
                  </div>
                )}
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className='py-20 sm:py-28'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-8'>
          <div className='rounded-[2rem] bg-slate-950 p-8 sm:p-10 text-white'>
            <h2 className='text-3xl font-bold'>{ui.conditions}</h2>
            <div className='mt-8 grid gap-4'>
              {localized.conditions.map((condition) => <div key={condition} className='flex gap-3 text-white/80'><Check className='h-5 w-5 flex-none text-teal-300' />{condition}</div>)}
            </div>
          </div>
          <div className='rounded-[2rem] border border-slate-200 bg-white p-8 sm:p-10'>
            <h2 className='text-3xl font-bold text-slate-950'>{ui.technology}</h2>
            <div className='mt-8 grid gap-4'>
              {localized.technology.map((item) => <div key={item} className='flex gap-3 text-slate-700'><Activity className='h-5 w-5 flex-none text-teal-600' />{item}</div>)}
            </div>
          </div>
        </div>
      </section>

      <section className='py-20 sm:py-28 bg-gradient-to-br from-teal-950 to-slate-950 text-white'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
          <SectionHeading eyebrow={ui.badge} title={ui.journey} text={ui.journeyLead} dark />
          <div className='grid gap-6 md:grid-cols-2 lg:grid-cols-4'>
            {localized.journey.map((step, index) => (
              <div key={step} className='relative rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm'>
                <span className='text-4xl font-bold text-teal-300/50'>{String(index + 1).padStart(2, '0')}</span>
                <p className='mt-6 font-semibold leading-6 text-white'>{step}</p>
              </div>
            ))}
          </div>
          <div className='mt-14 rounded-3xl bg-white p-7 sm:p-9 text-slate-900'>
            <h3 className='text-2xl font-bold'>{ui.benefits}</h3>
            <div className='mt-6 grid gap-4 sm:grid-cols-2'>
              {localized.benefits.map((benefit) => <div key={benefit} className='flex gap-3'><CheckCircle2 className='h-5 w-5 flex-none text-teal-600' /><span>{benefit}</span></div>)}
            </div>
          </div>
        </div>
      </section>

      <section className='py-20 sm:py-28 bg-slate-50'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
          <SectionHeading eyebrow={localized.displayTitle} title={ui.doctors} text={ui.doctorsLead} />
          {loadingDoctors ? <div className='flex justify-center py-16'><Loader2 className='h-8 w-8 animate-spin text-teal-600' /></div>
            : doctors.length > 0 ? <TreatmentDoctorsCarousel doctors={doctors} />
              : <div className='rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-600'>{ui.noDoctors}</div>}
        </div>
      </section>

      <section className='py-20 bg-white'>
        <div className='max-w-5xl mx-auto px-4 sm:px-6 lg:px-8'>
          <div className={`rounded-[2rem] bg-gradient-to-r ${accent} p-8 sm:p-12 text-white shadow-2xl`}>
            <h2 className='text-3xl sm:text-4xl font-bold'>{ui.ctaTitle}</h2>
            <p className='mt-4 max-w-2xl text-lg leading-8 text-white/85'>{ui.ctaText}</p>
            <Button as={Link} to='/register' size='lg' variant='inverse' className='mt-8' rightIcon={<ArrowRight className='h-5 w-5' />}>{ui.discuss}</Button>
          </div>
        </div>
      </section>
    </main>
  )
}
