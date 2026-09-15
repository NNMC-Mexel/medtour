import { useEffect, useRef, useState } from 'react'
import { ClipboardCheck, FileUp, HeartHandshake, Plane, Stethoscope, UserRoundSearch } from 'lucide-react'
import Reveal from './Reveal'

const icons = [FileUp, UserRoundSearch, ClipboardCheck, Plane, Stethoscope, HeartHandshake]

function JourneySection({ copy }) {
  const [active, setActive] = useState(0)
  const stepRefs = useRef([])

  useEffect(() => {
    const observers = stepRefs.current.map((node, index) => {
      if (!node) return null
      const observer = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) setActive(index)
      }, { rootMargin: '-28% 0px -62% 0px', threshold: 0 })
      observer.observe(node)
      return observer
    })
    return () => observers.forEach((observer) => observer?.disconnect())
  }, [copy.steps])

  return (
    <section id='process' className='scroll-mt-24 bg-white py-20 lg:pb-0 lg:pt-24'>
      <div className='mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
        <Reveal className='max-w-3xl'>
          <p className='medtour-kicker'>{copy.processEyebrow}</p>
          <h2 className='mt-4 max-w-[880px] text-[clamp(2.35rem,4.5vw,3.7rem)] font-semibold leading-[1.07] tracking-[-.045em] text-[#101b3f]'>{copy.processTitle}</h2>
          <p className='mt-5 max-w-2xl text-lg leading-8 text-[#647089]'>{copy.processText}</p>
        </Reveal>

        <div className='mt-12 grid gap-8 lg:grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)] lg:gap-12'>
          <div className='relative hidden self-stretch lg:block'>
            <div className='sticky top-28 rounded-[2rem] bg-[#0b1735] p-8 text-white shadow-[0_28px_80px_rgba(11,23,53,.18)]'>
              <p className='text-xs font-bold uppercase tracking-[.18em] text-[#52d1bb]'>{copy.stepLabel} {active + 1} / {copy.steps.length}</p>
              <div className='mt-10 grid grid-cols-[auto_1fr] gap-6'>
                <span className='flex h-16 w-16 items-center justify-center rounded-2xl bg-[#10a08e]'>
                  {(() => { const Icon = icons[active]; return <Icon className='h-8 w-8' /> })()}
                </span>
                <div><h3 className='text-3xl font-semibold tracking-[-.03em]'>{copy.steps[active].title}</h3><p className='mt-4 leading-7 text-white/65'>{copy.steps[active].text}</p></div>
              </div>
              <div className='mt-12 flex gap-2' aria-hidden='true'>
                {copy.steps.map((step, index) => <span key={step.title} className={`h-1.5 flex-1 rounded-full transition-colors duration-500 ${index <= active ? 'bg-[#52d1bb]' : 'bg-white/14'}`} />)}
              </div>
            </div>
          </div>

          <ol className='relative space-y-4 before:absolute before:bottom-10 before:left-[31px] before:top-10 before:w-px before:bg-[#d7e0ec] lg:space-y-5 lg:pb-16'>
            {copy.steps.map((step, index) => {
              const Icon = icons[index]
              return (
                <li
                  key={step.title}
                  ref={(node) => { stepRefs.current[index] = node }}
                  aria-current={index === active ? 'step' : undefined}
                  className={`relative grid min-h-40 grid-cols-[64px_1fr] gap-5 rounded-[1.7rem] border p-5 transition-all duration-500 sm:p-6 lg:min-h-[190px] lg:content-center ${index === active ? 'border-[#0a9a87]/30 bg-[#f0faf8] shadow-[0_18px_55px_rgba(10,154,135,.09)]' : 'border-[#e2e7ef] bg-white'}`}
                >
                  <span className={`relative z-10 flex h-16 w-16 items-center justify-center rounded-2xl transition ${index === active ? 'bg-[#0a9a87] text-white' : 'bg-[#edf2f7] text-[#657189]'}`}><Icon className='h-7 w-7' /></span>
                  <div className='pt-1'><span className='text-xs font-bold uppercase tracking-[.16em] text-[#9aa3b5]'>0{index + 1}</span><h3 className='mt-2 text-xl font-semibold text-[#111d3f] sm:text-2xl'>{step.title}</h3><p className='mt-3 max-w-xl leading-7 text-[#687289]'>{step.text}</p></div>
                </li>
              )
            })}
          </ol>
        </div>
      </div>
    </section>
  )
}

export default JourneySection
