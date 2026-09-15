import { Link } from 'react-router-dom'
import { ArrowRight, Clock3 } from 'lucide-react'
import Reveal from './Reveal'

function ArticlesSection({ copy }) {
  return (
    <section className='bg-white py-24 lg:py-32'>
      <div className='mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
        <Reveal className='flex flex-col justify-between gap-5 sm:flex-row sm:items-end'><div><p className='medtour-kicker'>{copy.blogEyebrow}</p><h2 className='medtour-title mt-4'>{copy.blogTitle}</h2></div><Link to='/blog' className='inline-flex items-center gap-2 font-semibold text-[#087f72]'>{copy.blogCta}<ArrowRight className='h-5 w-5' /></Link></Reveal>
        <div className='mt-12 grid gap-5 lg:grid-cols-2 lg:grid-rows-2'>
          {copy.articles.map((article, index) => <Reveal key={article.title} delay={index * 70} className={index === 0 ? 'lg:row-span-2' : ''}><Link to='/blog' className={`group grid h-full overflow-hidden rounded-[1.8rem] border border-[#dfe5ee] bg-[#f8fafc] ${index === 0 ? 'grid-rows-[300px_auto] lg:grid-rows-[390px_auto]' : 'sm:grid-cols-[220px_1fr]'}`}><div className='overflow-hidden'><img src={article.image} alt='' loading='lazy' className='h-full min-h-[220px] w-full object-cover transition duration-700 group-hover:scale-[1.035]' /></div><div className='flex flex-col p-6'><div className='flex items-center justify-between gap-4 text-xs font-bold uppercase tracking-[.12em] text-[#087f72]'><span>{article.category}</span><span className='flex items-center gap-1 text-[#8993a5]'><Clock3 className='h-3.5 w-3.5' />{article.read}</span></div><h3 className={`${index === 0 ? 'mt-5 text-2xl sm:text-3xl' : 'mt-4 text-xl'} font-semibold leading-snug text-[#111d3f] transition group-hover:text-[#087f72]`}>{article.title}</h3><ArrowRight className='mt-auto h-5 w-5 self-end text-[#9ca6b7] transition group-hover:translate-x-1 group-hover:text-[#087f72]' /></div></Link></Reveal>)}
        </div>
      </div>
    </section>
  )
}

export default ArticlesSection
