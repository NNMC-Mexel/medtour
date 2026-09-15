import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Building2, Languages, Stethoscope } from 'lucide-react'
import { getMediaUrl } from '../../services/api'
import { getDoctorField, getSpecName } from '../../utils/helpers'
import Reveal from './Reveal'

function DoctorsPreview({ copy, lang, doctors }) {
  const railRef = useRef(null)
  if (!doctors.length) return null
  const scroll = (direction) => railRef.current?.scrollBy({ left: direction * 340, behavior: 'smooth' })
  return (
    <section className='bg-white py-24 lg:py-32'>
      <div className='mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
        <Reveal className='flex items-end justify-between gap-6'><div className='max-w-3xl'><p className='medtour-kicker'>{copy.doctorsEyebrow}</p><h2 className='medtour-title mt-4'>{copy.doctorsTitle}</h2><p className='mt-5 text-lg leading-8 text-[#647089]'>{copy.doctorsText}</p></div><div className='hidden gap-2 sm:flex'><button onClick={() => scroll(-1)} aria-label={copy.previousDoctors} className='flex h-12 w-12 items-center justify-center rounded-full border border-[#dce3ed] transition hover:border-[#0a9a87] hover:text-[#0a9a87]'><ArrowLeft className='h-5 w-5' /></button><button onClick={() => scroll(1)} aria-label={copy.nextDoctors} className='flex h-12 w-12 items-center justify-center rounded-full border border-[#dce3ed] transition hover:border-[#0a9a87] hover:text-[#0a9a87]'><ArrowRight className='h-5 w-5' /></button></div></Reveal>
        <div ref={railRef} className='landing-scrollbar mt-12 flex snap-x snap-mandatory gap-5 overflow-x-auto pb-5'>
          {doctors.slice(0, 10).map((doctor) => {
            const id = doctor.documentId || doctor.id
            const name = getDoctorField(doctor, 'fullName', lang) || doctor.fullName
            const photo = getMediaUrl(doctor.photo)
            const specialty = getSpecName(doctor.specialization, lang)
            const languages = Array.isArray(doctor.languages) ? doctor.languages.join(', ') : doctor.languages
            const clinic = doctor.clinic?.name || doctor.clinicName
            return <Link key={id} to={`/doctors/${id}`} className='group w-[82vw] max-w-[320px] shrink-0 snap-start overflow-hidden rounded-[1.75rem] border border-[#dfe5ee] bg-[#f8fafc] transition hover:-translate-y-1 hover:shadow-[0_20px_60px_rgba(17,29,63,.11)] sm:w-[310px]'><div className='h-72 overflow-hidden bg-[#e8edf4]'>{photo ? <img src={photo} alt={name} loading='lazy' className='h-full w-full object-cover object-top transition duration-500 group-hover:scale-[1.03]' /> : <div className='flex h-full items-center justify-center'><Stethoscope className='h-14 w-14 text-[#9ca8b9]' /></div>}</div><div className='p-6'><h3 className='text-xl font-semibold text-[#111d3f]'>{name}</h3><p className='mt-2 text-sm font-medium text-[#087f72]'>{specialty}</p>{doctor.experience ? <p className='mt-4 text-sm text-[#697289]'>{copy.experience}: {doctor.experience}</p> : null}{clinic ? <p className='mt-2 flex items-start gap-2 text-sm text-[#697289]'><Building2 className='mt-0.5 h-4 w-4 shrink-0' />{clinic}</p> : null}{languages ? <p className='mt-2 flex items-start gap-2 text-sm text-[#697289]'><Languages className='mt-0.5 h-4 w-4 shrink-0' />{languages}</p> : null}</div></Link>
          })}
        </div>
        <Link to='/doctors' className='mt-5 inline-flex items-center gap-2 font-semibold text-[#087f72]'>{copy.allDoctors}<ArrowRight className='h-5 w-5' /></Link>
      </div>
    </section>
  )
}

export default DoctorsPreview
