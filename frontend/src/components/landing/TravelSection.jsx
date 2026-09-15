import { Link } from 'react-router-dom'
import { ArrowRight, BedDouble, Check, HeartHandshake, Languages, MapPin, PlaneLanding, Stethoscope } from 'lucide-react'
import Reveal from './Reveal'

const icons = [PlaneLanding, BedDouble, Languages, Stethoscope, HeartHandshake]

function TravelSection({ copy }) {
  return (
    <>
      <section className='bg-white py-24 lg:py-32'>
        <div className='mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
          <Reveal className='max-w-3xl'><p className='medtour-kicker'>{copy.ecosystemEyebrow}</p><h2 className='medtour-title mt-4'>{copy.ecosystemTitle}</h2><p className='mt-5 text-lg leading-8 text-[#647089]'>{copy.ecosystemText}</p></Reveal>
          <div className='relative mt-14 grid gap-4 lg:grid-cols-5 lg:gap-0 before:absolute before:left-[10%] before:right-[10%] before:top-8 before:hidden before:border-t before:border-dashed before:border-[#b9c6d6] lg:before:block'>
            {copy.ecosystemSteps.map((item, index) => { const Icon = icons[index]; return <Reveal key={item.title} delay={index * 70} className='relative flex gap-4 rounded-2xl border border-[#e0e6ef] bg-[#f8fafc] p-5 lg:block lg:border-0 lg:bg-transparent lg:px-4 lg:text-center'><span className='relative z-10 flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#111d3f] text-[#52d1bb] lg:mx-auto'><Icon className='h-7 w-7' /></span><div><h3 className='mt-1 font-semibold text-[#111d3f] lg:mt-6'>{item.title}</h3><p className='mt-2 text-sm leading-6 text-[#6c768b]'>{item.text}</p></div></Reveal> })}
          </div>
        </div>
      </section>

      <section className='bg-[#f4f7fb] py-24 lg:py-32'>
        <div className='mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
          <Reveal className='grid gap-8 lg:grid-cols-[.9fr_1.1fr] lg:items-end'><div><p className='medtour-kicker'>{copy.routeEyebrow}</p><h2 className='medtour-title mt-4'>{copy.routeTitle}</h2></div><div><p className='text-lg leading-8 text-[#647089]'>{copy.routeText}</p><Link to='/tourism' className='mt-5 inline-flex items-center gap-2 font-semibold text-[#087f72]'>{copy.routeCta}<ArrowRight className='h-5 w-5' /></Link></div></Reveal>
          <div className='mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-12 lg:auto-rows-[260px]'>
            {copy.routes.map((route, index) => <Reveal key={route.title} delay={(index % 2) * 80} className={`${index === 0 ? 'lg:col-span-7 lg:row-span-2' : index === 1 ? 'lg:col-span-5' : index === 2 ? 'lg:col-span-5' : 'lg:col-span-12'} min-h-[360px] lg:min-h-0`}><Link to='/tourism' className='group relative block h-full overflow-hidden rounded-[2rem]'><img src={route.image} alt={route.title} loading='lazy' className='h-full w-full object-cover transition duration-700 group-hover:scale-[1.035]' /><div className='absolute inset-0 bg-gradient-to-t from-[#061027]/95 via-[#061027]/18 to-transparent' /><div className='absolute inset-x-0 bottom-0 p-7 text-white'><p className='flex items-center gap-2 text-xs font-bold uppercase tracking-[.14em] text-[#63dcc6]'><MapPin className='h-4 w-4' />{route.tag}</p><h3 className='mt-3 text-3xl font-semibold'>{route.title}</h3><p className={`mt-3 max-w-2xl text-sm leading-6 text-white/70 ${index > 0 ? 'line-clamp-2' : ''}`}>{route.text}</p></div></Link></Reveal>)}
          </div>
          <Reveal className='mt-6 rounded-[1.7rem] border border-[#dce3ec] bg-white p-6 sm:p-8'><div className='flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between'><h3 className='text-xl font-semibold text-[#111d3f]'>{copy.servicesTitle}</h3><div className='flex flex-wrap gap-2'>{copy.services.map((service) => <span key={service} className='inline-flex items-center gap-2 rounded-full bg-[#edf3f8] px-4 py-2 text-sm text-[#49546d]'><Check className='h-4 w-4 text-[#0a9a87]' />{service}</span>)}</div></div></Reveal>
        </div>
      </section>
    </>
  )
}

export default TravelSection
