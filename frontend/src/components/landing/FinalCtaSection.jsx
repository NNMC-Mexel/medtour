import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, LockKeyhole, MessageSquareText } from 'lucide-react'
import Button from '../ui/Button'
import useAuthStore from '../../stores/authStore'
import Reveal from './Reveal'

function FinalCtaSection({ copy }) {
  const navigate = useNavigate()
  const { isAuthenticated, user } = useAuthStore()
  const [concern, setConcern] = useState('')
  const submit = (event) => {
    event.preventDefault()
    const role = user?.role?.type || user?.role || user?.userRole
    if (isAuthenticated && (!role || role === 'patient')) navigate('/patient/cases?create=1', { state: { openCreate: true } })
    else navigate('/register')
  }
  return (
    <section id='contact' className='scroll-mt-24 bg-white px-4 pb-24 sm:px-6 lg:px-8 lg:pb-32'>
      <Reveal className='relative mx-auto max-w-7xl overflow-hidden rounded-[2.3rem] bg-[#0c7f73] px-6 py-14 text-white shadow-[0_35px_90px_rgba(12,127,115,.2)] sm:px-10 lg:grid lg:grid-cols-[.92fr_1.08fr] lg:gap-16 lg:px-16 lg:py-20'>
        <div className='absolute -left-24 -top-32 h-96 w-96 rounded-full border-[70px] border-white/[.06]' aria-hidden='true' />
        <div className='relative'><p className='text-xs font-bold uppercase tracking-[.18em] text-[#b8f3e9]'>{copy.ctaEyebrow}</p><h2 className='mt-4 text-4xl font-semibold tracking-[-.04em] sm:text-5xl'>{copy.ctaTitle}</h2><p className='mt-5 max-w-xl text-lg leading-8 text-white/72'>{copy.ctaText}</p><div className='mt-8 flex items-center gap-3 text-sm text-white/65'><LockKeyhole className='h-5 w-5 text-[#b8f3e9]' />{copy.ctaPrivacy}</div></div>
        <form onSubmit={submit} className='relative mt-10 rounded-[1.7rem] bg-white p-5 text-[#111d3f] shadow-2xl lg:mt-0 sm:p-7'><label htmlFor='landing-concern' className='flex items-center gap-2 font-semibold'><MessageSquareText className='h-5 w-5 text-[#0a9a87]' />{copy.ctaFieldLabel}</label><textarea id='landing-concern' value={concern} onChange={(event) => setConcern(event.target.value)} placeholder={copy.ctaPlaceholder} rows={5} className='mt-4 w-full resize-none rounded-2xl border border-[#dce3ec] bg-[#f7f9fc] p-4 text-sm leading-6 outline-none transition placeholder:text-[#9aa4b5] focus:border-[#0a9a87] focus:ring-4 focus:ring-[#0a9a87]/10' /><p className='mt-3 text-xs leading-5 text-[#7b8598]'>{copy.ctaFlowNote}</p><Button type='submit' size='lg' className='mt-5 w-full !bg-[#ff6752] text-white hover:!bg-[#eb5945]'>{copy.ctaButton}<ArrowRight className='ml-2 h-5 w-5' /></Button></form>
      </Reveal>
    </section>
  )
}

export default FinalCtaSection
