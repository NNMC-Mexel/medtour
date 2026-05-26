import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Building2,
  ChevronRight,
  Compass,
  Globe2,
  HeartPulse,
  History,
  Landmark,
  Leaf,
  MapPinned,
  Mountain,
  Plane,
  Rocket,
  Route,
  Sparkles,
  Tent,
  Trees,
  Utensils,
  Waves,
} from 'lucide-react'
import Button from '../components/ui/Button'
import { tourismPageCopy, tourismRegions, tourismTypes } from '../data/kazakhstanTourism'
import { cn } from '../utils/helpers'

const typeIcons = {
  city: Building2,
  nature: Trees,
  mountains: Mountain,
  culture: Landmark,
  history: History,
  sacred: Sparkles,
  wellness: HeartPulse,
  beach: Waves,
  adventure: Tent,
  eco: Leaf,
  gastronomy: Utensils,
  space: Rocket,
}

function localize(value, lang) {
  if (!value || typeof value === 'string') return value || ''
  return value[lang] || value.ru || value.en || ''
}

function TourismPage() {
  const { i18n } = useTranslation()
  const lang = i18n.language?.split('-')?.[0] || 'ru'
  const copy = tourismPageCopy[lang] || tourismPageCopy.ru
  const [selectedType, setSelectedType] = useState('all')

  const typeOptions = useMemo(() => {
    const usedTypes = new Set(tourismRegions.flatMap((region) => region.types))
    return Object.keys(tourismTypes).filter((type) => usedTypes.has(type))
  }, [])

  const filteredRegions = useMemo(() => {
    if (selectedType === 'all') return tourismRegions
    return tourismRegions.filter((region) => region.types.includes(selectedType))
  }, [selectedType])

  return (
    <div className='bg-white text-slate-900'>
      <section className='relative min-h-[760px] overflow-hidden pt-28 text-white'>
        <div className='absolute inset-0'>
          <img
            src='/kazakhstan-tourism-hero.png'
            alt=''
            className='h-full w-full object-cover'
          />
          <div className='absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-900/55 to-slate-950/20' />
          <div className='absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-white to-transparent' />
        </div>

        <div className='relative mx-auto flex min-h-[640px] max-w-7xl items-center px-4 sm:px-6 lg:px-8'>
          <div className='max-w-3xl py-20'>
            <span className='inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium backdrop-blur'>
              <Globe2 className='h-4 w-4 text-teal-200' />
              {copy.heroBadge}
            </span>
            <h1 className='mt-6 text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl'>
              {copy.heroTitle}
            </h1>
            <p className='mt-6 max-w-2xl text-lg leading-8 text-white/82 sm:text-xl'>
              {copy.heroText}
            </p>
            <div className='mt-8 flex flex-col gap-3 sm:flex-row'>
              <a href='#regions'>
                <Button size='lg' className='bg-teal-500 text-white hover:bg-teal-600'>
                  {copy.heroCta}
                  <ChevronRight className='ml-2 h-5 w-5' />
                </Button>
              </a>
              <a href='#history'>
                <Button
                  size='lg'
                  className='border border-white/35 bg-white/10 text-white backdrop-blur hover:bg-white/20'
                >
                  {copy.secondaryCta}
                </Button>
              </a>
            </div>

            <div className='mt-12 grid gap-4 sm:grid-cols-3'>
              {copy.quickFacts.map((item) => (
                <div key={item.label} className='border-l border-white/25 pl-4'>
                  <div className='text-3xl font-bold'>{item.value}</div>
                  <div className='mt-1 text-sm leading-5 text-white/70'>{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <nav className='sticky top-20 z-30 border-b border-slate-200 bg-white/95 backdrop-blur'>
        <div className='mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 py-3 sm:px-6 lg:px-8'>
          {[
            { href: '#overview', label: copy.subnav.overview },
            { href: '#history', label: copy.subnav.history },
            { href: '#regions', label: copy.subnav.regions },
          ].map((item) => (
            <a
              key={item.href}
              href={item.href}
              className='whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-teal-50 hover:text-teal-700'
            >
              {item.label}
            </a>
          ))}
        </div>
      </nav>

      <section id='overview' className='scroll-mt-32 py-20'>
        <div className='mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
          <div className='grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-end'>
            <div>
              <span className='inline-flex items-center gap-2 rounded-full bg-teal-50 px-4 py-1 text-sm font-medium text-teal-700'>
                <Compass className='h-4 w-4' />
                {copy.overviewBadge}
              </span>
              <h2 className='mt-4 text-3xl font-bold text-slate-900 sm:text-4xl'>
                {copy.overviewTitle}
              </h2>
            </div>
            <p className='text-lg leading-8 text-slate-600'>{copy.overviewText}</p>
          </div>

          <div className='mt-10 grid gap-5 md:grid-cols-3'>
            {copy.overviewCards.map((card, index) => {
              const Icon = [MapPinned, Building2, Landmark][index] || Compass
              return (
                <div key={card.title} className='rounded-2xl border border-slate-200 bg-slate-50 p-6'>
                  <div className='flex h-12 w-12 items-center justify-center rounded-xl bg-white text-teal-700 shadow-sm'>
                    <Icon className='h-6 w-6' />
                  </div>
                  <h3 className='mt-5 text-lg font-semibold text-slate-900'>{card.title}</h3>
                  <p className='mt-3 leading-7 text-slate-600'>{card.text}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section id='history' className='relative isolate scroll-mt-32 overflow-hidden bg-slate-950 py-20 text-white'>
        <div className='absolute inset-0 -z-10'>
          <img
            src='/tourism/kazakh-history-bg.jpg'
            alt=''
            loading='lazy'
            className='h-full w-full object-cover object-[72%_50%] opacity-78'
          />
          <div className='absolute inset-0 bg-slate-950/54' />
          <div className='absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/88 to-slate-950/48' />
          <div className='absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-slate-950/64' />
          <div className='absolute inset-y-0 left-0 w-[58%] bg-gradient-to-r from-slate-950 via-slate-950/92 to-transparent' />
        </div>

        <div className='relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
          <div className='max-w-3xl'>
            <span className='inline-flex items-center gap-2 rounded-full bg-white/12 px-4 py-1 text-sm font-medium text-teal-100 ring-1 ring-white/10 backdrop-blur'>
              <History className='h-4 w-4' />
              {copy.historyBadge}
            </span>
            <h2 className='mt-4 text-3xl font-bold sm:text-4xl'>{copy.historyTitle}</h2>
            <p className='mt-4 text-lg leading-8 text-slate-300'>{copy.historyIntro}</p>
          </div>

          <div className='mt-12 grid gap-6 lg:grid-cols-3'>
            {copy.historyItems.map((item) => (
              <div key={item.title} className='rounded-2xl border border-white/12 bg-slate-950/55 p-6 shadow-2xl shadow-black/20 backdrop-blur-md'>
                <div className='text-sm font-semibold uppercase tracking-wide text-teal-200'>{item.period}</div>
                <h3 className='mt-4 text-xl font-semibold'>{item.title}</h3>
                <p className='mt-4 leading-7 text-slate-300'>{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id='regions' className='scroll-mt-32 bg-slate-50 py-20'>
        <div className='mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
          <div className='flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between'>
            <div className='max-w-3xl'>
              <span className='inline-flex items-center gap-2 rounded-full bg-white px-4 py-1 text-sm font-medium text-teal-700 shadow-sm'>
                <Route className='h-4 w-4' />
                {copy.regionsBadge}
              </span>
              <h2 className='mt-4 text-3xl font-bold text-slate-900 sm:text-4xl'>{copy.regionsTitle}</h2>
              <p className='mt-4 text-lg leading-8 text-slate-600'>{copy.regionsText}</p>
            </div>
            <Link to='/register'>
              <Button size='lg' className='w-full sm:w-auto' leftIcon={<Plane className='h-5 w-5' />}>
                {copy.heroCta}
              </Button>
            </Link>
          </div>

          <div className='mt-8 flex gap-2 overflow-x-auto pb-2'>
            <button
              type='button'
              onClick={() => setSelectedType('all')}
              className={cn(
                'whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition-colors',
                selectedType === 'all'
                  ? 'border-teal-600 bg-teal-600 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-teal-200 hover:text-teal-700',
              )}
            >
              {copy.allTypes}
            </button>
            {typeOptions.map((type) => {
              const Icon = typeIcons[type] || Compass
              return (
                <button
                  key={type}
                  type='button'
                  onClick={() => setSelectedType(type)}
                  className={cn(
                    'inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition-colors',
                    selectedType === type
                      ? 'border-teal-600 bg-teal-600 text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-teal-200 hover:text-teal-700',
                  )}
                >
                  <Icon className='h-4 w-4' />
                  {localize(tourismTypes[type], lang)}
                </button>
              )
            })}
          </div>

          <div className='mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3'>
            {filteredRegions.map((region) => (
              <article
                key={region.id}
                className='group flex min-h-[460px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl'
              >
                <div className='relative h-44 overflow-hidden bg-slate-200'>
                  <img
                    src={region.image}
                    alt={localize(region.name, lang)}
                    loading='lazy'
                    className='h-full w-full object-cover transition-transform duration-500 group-hover:scale-105'
                  />
                  <div className='absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/20 to-transparent' />
                  <div className='absolute bottom-0 left-0 right-0 p-5 text-white'>
                    <h3 className='text-2xl font-semibold'>{localize(region.name, lang)}</h3>
                    <p className='mt-1 text-sm text-white/75'>
                      {copy.centerLabel}: {localize(region.center, lang)}
                    </p>
                  </div>
                  <div className='absolute right-5 top-5 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-white/90 text-teal-700 shadow-sm backdrop-blur'>
                    <MapPinned className='h-5 w-5' />
                  </div>
                </div>

                <div className='flex flex-1 flex-col p-6'>
                  <div className='flex flex-wrap gap-2'>
                    {region.types.map((type) => (
                      <span key={type} className='rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600'>
                        {localize(tourismTypes[type], lang)}
                      </span>
                    ))}
                  </div>

                  <p className='mt-4 flex-1 leading-7 text-slate-600'>{localize(region.summary, lang)}</p>

                  <div className='mt-5 border-t border-slate-100 pt-4'>
                    <div className='text-sm font-semibold text-slate-900'>{copy.highlightsLabel}</div>
                    <ul className='mt-3 space-y-2'>
                      {region.highlights.map((item) => (
                        <li key={item} className='flex gap-2 text-sm leading-6 text-slate-600'>
                          <span className='mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-teal-500' />
                          {localize(item, lang)}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

export default TourismPage
