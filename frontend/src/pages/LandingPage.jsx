import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import HeroSection from '../components/landing/HeroSection'
import VisualBridge from '../components/landing/VisualBridge'
import JourneySection from '../components/landing/JourneySection'
import TreatmentExplorer from '../components/landing/TreatmentExplorer'
import PlatformShowcase from '../components/landing/PlatformShowcase'
import DoctorsPreview from '../components/landing/DoctorsPreview'
import ProgramsSection from '../components/landing/ProgramsSection'
import TravelSection from '../components/landing/TravelSection'
import ArticlesSection from '../components/landing/ArticlesSection'
import FinalCtaSection from '../components/landing/FinalCtaSection'
import { landingCopy } from '../data/landingCopy'
import { mergeTreatmentDepartments, TREATMENT_DEPARTMENTS } from '../data/treatmentDepartments'
import { contentAPI, doctorsAPI, normalizeResponse } from '../services/api'

function LandingPage() {
  const { i18n } = useTranslation()
  const lang = i18n.language?.split('-')?.[0] || 'ru'
  const copy = landingCopy[lang] || landingCopy.ru
  const [departments, setDepartments] = useState(TREATMENT_DEPARTMENTS)
  const [doctors, setDoctors] = useState([])

  useEffect(() => {
    let active = true
    Promise.allSettled([contentAPI.getGlobal(), doctorsAPI.getAll()]).then(([contentResult, doctorsResult]) => {
      if (!active) return
      if (contentResult.status === 'fulfilled') {
        const normalized = normalizeResponse(contentResult.value)
        const globalData = normalized?.data || normalized
        setDepartments(mergeTreatmentDepartments(globalData?.treatmentDepartments))
      }
      if (doctorsResult.status === 'fulfilled') {
        const normalized = normalizeResponse(doctorsResult.value)
        const list = normalized?.data || normalized
        setDoctors(Array.isArray(list) ? list.filter((doctor) => doctor?.isActive !== false) : [])
      }
    })
    return () => { active = false }
  }, [])

  return (
    <div className='overflow-x-clip bg-[#f4f7fb] text-[#111d3f]'>
      <HeroSection copy={copy} lang={lang} />
      <VisualBridge lang={lang} />
      <JourneySection copy={copy} />
      <TreatmentExplorer copy={copy} lang={lang} departments={departments} />
      <PlatformShowcase copy={copy} />
      <DoctorsPreview copy={copy} lang={lang} doctors={doctors} />
      <ProgramsSection copy={copy} lang={lang} departments={departments} />
      <TravelSection copy={copy} />
      <ArticlesSection copy={copy} />
      <FinalCtaSection copy={copy} />
    </div>
  )
}

export default LandingPage
