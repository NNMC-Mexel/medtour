import { ArrowDown, FileText, ShieldCheck, UserRoundCheck } from 'lucide-react'
import Reveal from './Reveal'

const items = {
  ru: [
    ['Врачи и клиники', 'Подбор под медицинскую задачу'],
    ['Документы', 'В защищённом кабинете пациента'],
    ['Координатор', 'Один контакт на всём маршруте'],
  ],
  en: [
    ['Doctors and clinics', 'Matched to your medical needs'],
    ['Medical records', 'In your secure patient account'],
    ['Coordinator', 'One contact throughout the journey'],
  ],
  kk: [
    ['Дәрігерлер мен клиникалар', 'Медициналық міндетке сай таңдау'],
    ['Құжаттар', 'Қорғалған пациент кабинетінде'],
    ['Үйлестіруші', 'Бүкіл бағыттағы бір байланыс'],
  ],
}

const icons = [UserRoundCheck, FileText, ShieldCheck]

function VisualBridge({ lang }) {
  const content = items[lang] || items.ru
  return (
    <div className='relative z-10 mx-auto -mt-16 max-w-7xl px-4 sm:px-6 lg:px-8'>
      <Reveal className='grid overflow-hidden rounded-[2rem] border border-white/60 bg-white/92 shadow-[0_28px_80px_rgba(12,26,60,.14)] backdrop-blur-xl md:grid-cols-[1fr_1fr_1fr_auto]'>
        {content.map(([title, text], index) => {
          const Icon = icons[index]
          return (
            <div key={title} className='flex items-start gap-4 border-b border-[#e5eaf2] p-6 md:border-b-0 md:border-r lg:p-7'>
              <span className='flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#e7f7f4] text-[#087f72]'><Icon className='h-5 w-5' /></span>
              <span><strong className='block text-sm text-[#111d3f]'>{title}</strong><span className='mt-1 block text-xs leading-5 text-[#667089]'>{text}</span></span>
            </div>
          )
        })}
        <a href='#process' aria-label='Scroll to patient journey' className='hidden w-20 items-center justify-center text-[#0a9a87] transition hover:bg-[#e7f7f4] md:flex'><ArrowDown className='h-6 w-6' /></a>
      </Reveal>
    </div>
  )
}

export default VisualBridge
