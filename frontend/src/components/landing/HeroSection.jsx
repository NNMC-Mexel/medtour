import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, FileUp, MapPin, MessageSquareText, Route, ScrollText } from 'lucide-react'
import Button from '../ui/Button'

const journeyCopy = {
  ru: ['Опишите ситуацию', 'Прикрепите документы', 'Получите предварительный план', 'Организуем поездку'],
  en: ['Describe your situation', 'Attach medical records', 'Receive a preliminary plan', 'We organize your journey'],
  kk: ['Жағдайды сипаттаңыз', 'Құжаттарды тіркеңіз', 'Алдын ала жоспарды алыңыз', 'Сапарды ұйымдастырамыз'],
}

const icons = [MessageSquareText, FileUp, ScrollText, Route]

function HeroSection({ copy, lang }) {
  const steps = journeyCopy[lang] || journeyCopy.ru
  const [activeStep, setActiveStep] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined
    const timer = window.setInterval(() => setActiveStep((current) => (current + 1) % steps.length), 2200)
    return () => window.clearInterval(timer)
  }, [paused, steps.length])

  return (
    <section className='hero-premium relative min-h-[880px] overflow-hidden bg-[#07132f] text-white lg:min-h-[min(960px,100svh)]'>
      <div className='absolute inset-0'>
        <img src='/astana-medtour-hero.webp' alt={copy.heroLocation} width='1672' height='941' fetchPriority='high' className='hero-astana h-full w-full object-cover object-[67%_center]' />
        <div className='absolute inset-0 bg-[linear-gradient(90deg,rgba(5,16,41,.98)_0%,rgba(5,16,41,.91)_40%,rgba(5,16,41,.32)_72%,rgba(5,16,41,.12)_100%)]' />
        <div className='absolute inset-0 bg-[linear-gradient(0deg,rgba(5,16,41,.76)_0%,transparent_48%,rgba(5,16,41,.12)_100%)]' />
        <div className='medtour-grain absolute inset-0 opacity-25' />
      </div>

      <div className='relative mx-auto grid min-h-[880px] max-w-7xl items-center gap-12 px-4 pb-24 pt-32 sm:px-6 lg:min-h-[min(960px,100svh)] lg:grid-cols-[1.08fr_.92fr] lg:px-8 lg:pt-28'>
        <div className='min-w-0 max-w-3xl'>
          <div className='hero-enter hero-enter-1 inline-flex max-w-full items-start gap-3 rounded-3xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium leading-5 text-white/90 backdrop-blur-md'>
            <span className='mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#42d1b1] shadow-[0_0_18px_#42d1b1]' />
            <span>{copy.heroEyebrow}</span>
          </div>
          <h1 className='hero-enter hero-enter-2 mt-7 max-w-[820px] text-[2.75rem] font-semibold leading-[1.03] tracking-[-0.05em] sm:text-6xl lg:text-[clamp(4rem,5.25vw,5rem)]'>{copy.heroTitle}</h1>
          <p className='hero-enter hero-enter-3 mt-7 max-w-2xl text-lg leading-8 text-white/74 sm:text-xl'>{copy.heroText}</p>
          <div className='hero-enter hero-enter-4 mt-9 flex flex-col gap-3 sm:flex-row'>
            <Link to='/register' className='block sm:inline-block'>
              <Button size='xl' className='landing-primary-cta w-full bg-[#0aa38f] text-white shadow-[0_18px_50px_rgba(10,163,143,.25)] hover:bg-[#078d7b] sm:w-auto'>{copy.heroPrimary}<ArrowRight className='ml-1 h-5 w-5' /></Button>
            </Link>
            <a href='#process' className='block sm:inline-block'><Button size='xl' className='w-full border border-white/30 bg-white/10 text-white backdrop-blur hover:bg-white/16 sm:w-auto'>{copy.heroSecondary}</Button></a>
          </div>
          <div className='hero-enter hero-enter-5 mt-10 grid gap-3 border-t border-white/15 pt-6 sm:grid-cols-3'>
            {copy.trust.map((item) => <div key={item} className='flex items-center gap-2 text-sm text-white/70'><span className='flex h-5 w-5 items-center justify-center rounded-full bg-[#42d1b1]/15 text-[#42d1b1]'><Check className='h-3.5 w-3.5' /></span>{item}</div>)}
          </div>
        </div>

        <div className='hero-card-enter hidden justify-end lg:flex'>
          <div
            className='route-glass w-full max-w-[420px] rounded-[2rem] border border-white/16 bg-[#0a193a]/72 p-7 shadow-2xl backdrop-blur-xl'
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
          >
            <div className='flex items-start justify-between gap-6'>
              <div><p className='text-xs font-bold uppercase tracking-[.2em] text-[#42d1b1]'>{copy.heroCardLabel}</p><h2 className='mt-2 text-2xl font-semibold'>{copy.heroCardTitle}</h2></div>
              <span className='flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0aa38f] text-white'><Route className='h-6 w-6' /></span>
            </div>
            <div className='relative mt-7 space-y-2 before:absolute before:bottom-6 before:left-[21px] before:top-6 before:w-px before:bg-white/12'>
              {steps.map((step, index) => {
                const Icon = icons[index]
                const active = index === activeStep
                const completed = index < activeStep
                return (
                  <button
                    key={step}
                    type='button'
                    onMouseEnter={() => setActiveStep(index)}
                    onFocus={() => setActiveStep(index)}
                    onClick={() => setActiveStep(index)}
                    aria-current={active ? 'step' : undefined}
                    className={`relative flex min-h-16 w-full items-center gap-4 rounded-2xl border px-3 py-3 text-left transition-all duration-500 ${active ? 'translate-x-1 border-[#42d1b1]/45 bg-[#42d1b1]/12' : 'border-transparent hover:bg-white/6'}`}
                  >
                    <span className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all duration-500 ${active ? 'bg-[#42d1b1] text-[#07132f] shadow-[0_0_24px_rgba(66,209,177,.28)]' : completed ? 'bg-white text-[#0aa38f]' : 'bg-white/10 text-white/55'}`}><Icon className='h-5 w-5' /></span>
                    <span><span className='block text-[10px] font-bold uppercase tracking-[.16em] text-white/40'>0{index + 1}</span><span className={`mt-0.5 block text-sm transition-colors ${active ? 'text-white' : 'text-white/66'}`}>{step}</span></span>
                  </button>
                )
              })}
            </div>
            <div className='mt-6 flex items-center justify-between border-t border-white/12 pt-5 text-xs text-white/50'><span className='flex items-center gap-2'><MapPin className='h-4 w-4 text-[#42d1b1]' />{copy.heroLocation}</span><span>{activeStep + 1} / {steps.length}</span></div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default HeroSection
