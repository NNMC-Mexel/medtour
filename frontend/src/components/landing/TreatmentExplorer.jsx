import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Activity, ArrowRight, Brain, Heart, HeartPulse, Microscope, ScanLine, Search, Stethoscope, Syringe } from 'lucide-react'
import { localizeDepartment } from '../../data/treatmentDepartments'
import Reveal from './Reveal'

const iconMap = { Activity, Brain, Heart, HeartPulse, Microscope, ScanLine, Stethoscope, Syringe }

function TreatmentExplorer({ copy, lang, departments }) {
  const [query, setQuery] = useState('')
  const visible = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase(lang)
    return departments.filter((department) => {
      if (!normalized) return true
      const item = localizeDepartment(department, lang)
      return `${item.displayTitle} ${item.displayShort} ${(item.services || []).join(' ')}`.toLocaleLowerCase(lang).includes(normalized)
    }).slice(0, 8)
  }, [departments, lang, query])

  return (
    <section id='specializations' className='scroll-mt-24 bg-[#f4f7fb] py-24 lg:py-28'>
      <div className='mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
        <Reveal className='grid gap-8 lg:grid-cols-[1fr_.9fr] lg:items-end'>
          <div><p className='medtour-kicker'>{copy.medEyebrow}</p><h2 className='medtour-title mt-4'>{copy.medTitle}</h2><p className='mt-5 max-w-2xl text-lg leading-8 text-[#647089]'>{copy.medText}</p></div>
          <label className='relative block lg:ml-auto lg:w-full lg:max-w-md'>
            <span className='sr-only'>{copy.searchLabel}</span>
            <Search className='pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-[#7f899e]' />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.searchPlaceholder} className='h-15 w-full rounded-2xl border border-[#dbe2ec] bg-white pl-13 pr-5 text-[#111d3f] shadow-sm outline-none transition placeholder:text-[#9ba4b5] focus:border-[#0a9a87] focus:ring-4 focus:ring-[#0a9a87]/10' />
          </label>
        </Reveal>

        {visible.length > 0 ? (
          <div className='mt-12 grid auto-rows-[minmax(230px,auto)] gap-4 sm:grid-cols-2 lg:grid-cols-4'>
            {visible.map((department, index) => {
              const item = localizeDepartment(department, lang)
              const Icon = iconMap[department.icon] || Stethoscope
              const featured = index === 0 || index === 5
              return (
                <Reveal key={department.slug} delay={(index % 4) * 70} className={featured ? 'lg:col-span-2' : ''}>
                  <Link to={`/treatments/${department.slug}`} className={`group relative flex h-full min-h-[230px] flex-col overflow-hidden rounded-[1.75rem] border p-6 transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_70px_rgba(17,29,63,.12)] ${featured ? 'border-[#122148] bg-[#111d3f] text-white' : 'border-[#dfe5ee] bg-white text-[#111d3f]'}`}>
                    <div className='flex items-start justify-between gap-5'>
                      <span className={`flex h-13 w-13 items-center justify-center rounded-2xl ${featured ? 'bg-[#52d1bb] text-[#0b1735]' : 'bg-[#e8f7f4] text-[#078778]'}`}><Icon className='h-6 w-6' strokeWidth={1.8} /></span>
                      <ArrowRight className={`h-5 w-5 transition group-hover:translate-x-1 ${featured ? 'text-white/45' : 'text-[#a0a8b8]'}`} />
                    </div>
                    <div className='mt-auto pt-10'><h3 className='text-xl font-semibold sm:text-2xl'>{item.displayTitle}</h3><p className={`mt-3 line-clamp-2 text-sm leading-6 ${featured ? 'text-white/62' : 'text-[#687289]'}`}>{item.displayShort}</p><p className={`mt-5 text-xs font-bold uppercase tracking-[.14em] ${featured ? 'text-[#52d1bb]' : 'text-[#087f72]'}`}>{(item.programs || []).length} {copy.programs}</p></div>
                  </Link>
                </Reveal>
              )
            })}
          </div>
        ) : <div className='mt-12 rounded-[1.75rem] border border-dashed border-[#cbd4e1] bg-white px-6 py-14 text-center text-[#667089]'>{copy.searchEmpty}</div>}

        <div className='mt-9 text-center'><Link to='/specializations' className='inline-flex items-center gap-2 font-semibold text-[#087f72] transition hover:text-[#0b1735]'>{copy.allDirections}<ArrowRight className='h-5 w-5' /></Link></div>
      </div>
    </section>
  )
}

export default TreatmentExplorer
