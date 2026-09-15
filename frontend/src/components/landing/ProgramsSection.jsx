import { useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CalendarClock, ClipboardPlus, HeartPulse } from 'lucide-react'
import { localizeDepartment } from '../../data/treatmentDepartments'
import Reveal from './Reveal'

const navigationLabels = {
  ru: ['Предыдущие программы', 'Следующие программы'],
  en: ['Previous programs', 'Next programs'],
  kk: ['Алдыңғы бағдарламалар', 'Келесі бағдарламалар'],
}

function ProgramsSection({ copy, lang, departments }) {
  const railRef = useRef(null)
  const programs = useMemo(() => {
    const all = departments.flatMap((department) => {
      const localized = localizeDepartment(department, lang)
      return (localized.programs || []).map((program) => ({
        ...program,
        department: localized.displayTitle,
        slug: department.slug,
      }))
    })
    const checks = all.filter((program) => /check|чек|скрининг|screen|профилакти/i.test(`${program.name} ${program.text}`))
    return (checks.length >= 3 ? checks : all).slice(0, 6)
  }, [departments, lang])

  if (!programs.length) return null

  const labels = navigationLabels[lang] || navigationLabels.ru
  const scroll = (direction) => railRef.current?.scrollBy({ left: direction * 410, behavior: 'smooth' })

  return (
    <section className='bg-[#f4f7fb] py-20 lg:py-24'>
      <div className='mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
        <Reveal className='grid gap-7 lg:grid-cols-[1fr_1fr] lg:items-end'>
          <div>
            <p className='medtour-kicker'>{copy.programsEyebrow}</p>
            <h2 className='mt-4 max-w-[620px] text-[clamp(2.35rem,4.2vw,3.55rem)] font-semibold leading-[1.06] tracking-[-.045em] text-[#101b3f]'>{copy.programsTitle}</h2>
          </div>
          <div className='lg:justify-self-end'>
            <p className='max-w-xl text-lg leading-8 text-[#647089]'>{copy.programsText}</p>
            {programs.length > 3 ? (
              <div className='mt-6 hidden gap-2 sm:flex lg:justify-end'>
                <button type='button' onClick={() => scroll(-1)} aria-label={labels[0]} className='flex h-11 w-11 items-center justify-center rounded-full border border-[#cfd8e5] bg-white text-[#42506b] transition hover:border-[#0a9a87] hover:text-[#0a9a87] focus-visible:ring-4 focus-visible:ring-[#0a9a87]/15'><ArrowLeft className='h-5 w-5' /></button>
                <button type='button' onClick={() => scroll(1)} aria-label={labels[1]} className='flex h-11 w-11 items-center justify-center rounded-full border border-[#cfd8e5] bg-white text-[#42506b] transition hover:border-[#0a9a87] hover:text-[#0a9a87] focus-visible:ring-4 focus-visible:ring-[#0a9a87]/15'><ArrowRight className='h-5 w-5' /></button>
              </div>
            ) : null}
          </div>
        </Reveal>

        <div ref={railRef} className='landing-scrollbar mt-10 flex snap-x snap-mandatory items-stretch gap-5 overflow-x-auto pb-5'>
          {programs.map((program, index) => (
            <Reveal key={`${program.slug}-${program.name}`} delay={(index % 3) * 60} className='flex w-[84vw] max-w-[390px] shrink-0 snap-start'>
              <Link to={`/treatments/${program.slug}`} className={`group flex min-h-[350px] w-full flex-col rounded-[1.8rem] border p-7 transition hover:-translate-y-1 hover:shadow-[0_24px_65px_rgba(17,29,63,.12)] ${index === 0 ? 'border-[#111d3f] bg-[#111d3f] text-white' : 'border-[#dce3ec] bg-white text-[#111d3f]'}`}>
                <div className='flex items-start justify-between'>
                  <span className={`flex h-13 w-13 items-center justify-center rounded-2xl ${index === 0 ? 'bg-[#52d1bb] text-[#0b1735]' : 'bg-[#e8f7f4] text-[#087f72]'}`}>
                    {index % 2 ? <ClipboardPlus className='h-6 w-6' /> : <HeartPulse className='h-6 w-6' />}
                  </span>
                  <ArrowRight className='h-5 w-5 opacity-50 transition group-hover:translate-x-1' />
                </div>
                <p className={`mt-8 text-xs font-bold uppercase tracking-[.14em] ${index === 0 ? 'text-[#52d1bb]' : 'text-[#087f72]'}`}>{program.department}</p>
                <h3 className='mt-3 text-[1.35rem] font-semibold leading-snug'>{program.name}</h3>
                {program.text ? <p className={`mt-3 line-clamp-3 text-sm leading-6 ${index === 0 ? 'text-white/62' : 'text-[#687289]'}`}>{program.text}</p> : null}
                <div className={`mt-auto flex min-h-5 flex-wrap items-center gap-x-4 gap-y-2 border-t pt-5 text-xs ${index === 0 ? 'border-white/10 text-white/55' : 'border-[#e6ebf2] text-[#788298]'}`}>
                  {program.duration ? <span className='flex items-center gap-1.5'><CalendarClock className='h-4 w-4' />{program.duration}</span> : null}
                  {program.stay ? <span>{program.stay}</span> : null}
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
        {programs.length > 1 ? <p className='mt-1 text-center text-xs text-[#8893a7] sm:hidden'>{labels[1]} →</p> : null}
      </div>
    </section>
  )
}

export default ProgramsSection
