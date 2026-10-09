import { CalendarDays, FileCheck2, FolderLock, HeartHandshake, MessageCircleMore, PlaneTakeoff, ShieldCheck, Stethoscope } from 'lucide-react'
import Reveal from './Reveal'

const icons = [FolderLock, Stethoscope, FileCheck2, CalendarDays, MessageCircleMore, PlaneTakeoff]

function PlatformShowcase({ copy }) {
  return (
    <section id='platform' className='scroll-mt-24 overflow-hidden bg-mt-night py-24 text-white lg:py-32'>
      <div className='mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
        <Reveal className='mx-auto max-w-3xl text-center'><p className='medtour-kicker text-mt-glow'>{copy.platformEyebrow}</p><h2 className='mt-4 text-4xl font-semibold tracking-[-.04em] sm:text-5xl lg:text-6xl'>{copy.platformTitle}</h2><p className='mx-auto mt-6 max-w-2xl text-lg leading-8 text-white/62'>{copy.platformText}</p></Reveal>

        <Reveal className='relative mt-16' delay={100}>
          <div className='absolute -left-24 top-20 h-80 w-80 rounded-full bg-mt-accent/18 blur-3xl' aria-hidden='true' />
          <div className='absolute -right-32 bottom-0 h-80 w-80 rounded-full bg-mt-blue/20 blur-3xl' aria-hidden='true' />
          <div className='relative mx-auto max-w-5xl rounded-[2rem] border border-white/12 bg-white/[.07] p-3 shadow-[0_40px_120px_rgba(0,0,0,.28)] backdrop-blur sm:p-5'>
            <div className='overflow-hidden rounded-[1.5rem] bg-[#f7f9fc] text-mt-ink'>
              <div className='flex items-center justify-between border-b border-[#e3e8f0] px-5 py-4'><div className='flex gap-2' aria-hidden='true'><span className='h-2.5 w-2.5 rounded-full bg-mt-coral' /><span className='h-2.5 w-2.5 rounded-full bg-[#f2bd5c]' /><span className='h-2.5 w-2.5 rounded-full bg-[#53c9ad]' /></div><span className='text-xs font-semibold text-[#8791a5]'>{copy.platformMockLabel}</span><ShieldCheck className='h-5 w-5 text-mt-accent' /></div>
              <div className='grid min-h-[450px] md:grid-cols-[220px_1fr]'>
                <aside className='hidden border-r border-[#e3e8f0] bg-white p-5 md:block'><div className='h-9 rounded-xl bg-mt-ink' /><div className='mt-8 space-y-3'>{copy.platformFeatures.slice(0, 4).map((item, index) => <div key={item} className={`rounded-xl px-3 py-3 text-xs font-medium ${index === 0 ? 'bg-mt-mint text-mt-accent-strong' : 'text-[#788298]'}`}>{item}</div>)}</div></aside>
                <div className='p-5 sm:p-7'><div className='flex items-start justify-between'><div><p className='text-xs font-bold uppercase tracking-[.16em] text-mt-accent'>{copy.platformCaseLabel}</p><h3 className='mt-2 text-2xl font-semibold'>{copy.platformCaseTitle}</h3></div><span className='rounded-full bg-mt-mint px-3 py-1.5 text-xs font-semibold text-mt-accent-strong'>{copy.platformStatus}</span></div><div className='mt-7 grid gap-4 sm:grid-cols-2'><div className='rounded-2xl border border-[#e1e7ef] bg-white p-5'><FolderLock className='h-6 w-6 text-mt-blue' /><p className='mt-5 font-semibold'>{copy.platformDocumentTitle}</p><div className='mt-4 h-2 rounded-full bg-[#edf1f6]'><div className='h-full w-3/4 rounded-full bg-mt-blue' /></div><p className='mt-3 text-xs text-[#8a93a5]'>{copy.platformDocumentText}</p></div><div className='rounded-2xl border border-[#e1e7ef] bg-white p-5'><HeartHandshake className='h-6 w-6 text-mt-accent' /><p className='mt-5 font-semibold'>{copy.platformCoordinatorTitle}</p><div className='mt-4 flex items-center gap-3'><span className='h-10 w-10 rounded-full bg-[#dce6f5]' /><div className='space-y-2'><span className='block h-2 w-28 rounded bg-[#d8dfe9]' /><span className='block h-2 w-20 rounded bg-[#eef1f5]' /></div></div></div></div><div className='mt-4 rounded-2xl bg-mt-ink p-5 text-white'><div className='flex items-center gap-3'><PlaneTakeoff className='h-5 w-5 text-mt-glow' /><span className='text-sm font-semibold'>{copy.platformTripTitle}</span></div><div className='mt-5 grid grid-cols-3 gap-2'>{copy.platformTripSteps.map((step, index) => <div key={step} className='text-center'><span className={`mx-auto block h-2.5 w-2.5 rounded-full ${index < 2 ? 'bg-mt-glow' : 'bg-white/20'}`} /><span className='mt-2 block text-[10px] text-white/55'>{step}</span></div>)}</div></div></div>
              </div>
            </div>
          </div>
          <div className='landing-float-card absolute -left-3 top-36 hidden items-center gap-3 rounded-2xl border border-white/15 bg-mt-ink-soft/90 px-4 py-3 shadow-xl backdrop-blur-xl xl:flex'><span className='flex h-10 w-10 items-center justify-center rounded-xl bg-mt-glow text-mt-night'><FileCheck2 className='h-5 w-5' /></span><span className='text-xs font-semibold text-white/80'>{copy.platformFeatures[2]}</span></div>
          <div className='landing-float-card absolute -right-4 bottom-24 hidden items-center gap-3 rounded-2xl border border-white/15 bg-mt-ink-soft/90 px-4 py-3 shadow-xl backdrop-blur-xl xl:flex'><span className='flex h-10 w-10 items-center justify-center rounded-xl bg-mt-coral text-white'><MessageCircleMore className='h-5 w-5' /></span><span className='text-xs font-semibold text-white/80'>{copy.platformFeatures[4]}</span></div>
        </Reveal>

        <div className='mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>{copy.platformFeatures.map((item, index) => { const Icon = icons[index]; return <Reveal key={item} delay={(index % 3) * 60} className='flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[.05] px-5 py-4 text-sm text-white/72'><Icon className='h-5 w-5 shrink-0 text-mt-glow' />{item}</Reveal> })}</div>

        <Reveal className='mt-16 grid gap-6 rounded-[2rem] border border-white/12 bg-white/[.06] p-7 md:grid-cols-[.8fr_1.2fr] md:items-center lg:p-10'>
          <div><p className='medtour-kicker text-mt-glow'>{copy.trustEyebrow}</p><h3 className='mt-3 text-3xl font-semibold tracking-[-.03em]'>{copy.trustTitle}</h3></div>
          <div className='grid gap-4 sm:grid-cols-3'>{copy.trust.map((item) => <div key={item} className='rounded-2xl bg-[#07112b] p-5'><ShieldCheck className='h-6 w-6 text-mt-glow' /><p className='mt-4 text-sm leading-6 text-white/70'>{item}</p></div>)}</div>
        </Reveal>
      </div>
    </section>
  )
}

export default PlatformShowcase
