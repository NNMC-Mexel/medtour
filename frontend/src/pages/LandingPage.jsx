import { useEffect, useMemo, useState } from 'react'
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
import { doctorsAPI, normalizeResponse } from '../services/api'
import { mergeLandingCopy } from '../config/siteContent'
import useSiteContentStore from '../stores/siteContentStore'
import useSeo from '../components/seo/useSeo'

function LandingPage() {
  const { i18n } = useTranslation()
  const lang = i18n.language?.split('-')?.[0] || 'ru'
  const siteContent = useSiteContentStore((state) => state.content)
  const globalData = useSiteContentStore((state) => state.global)
  const seo = siteContent.seo[lang] || {}
  useSeo({
    title: seo.title?.trim() || i18n.t('seo.home_title'),
    description: seo.description?.trim() || i18n.t('seo.home_description'),
    path: '/',
  })
  // Тексты из кода, поверх — правки из Admin > Контент сайта > Главная страница.
  const copy = useMemo(
    () => mergeLandingCopy(landingCopy[lang] || landingCopy.ru, siteContent.landing[lang]),
    [lang, siteContent],
  )
  const departments = useMemo(
    () => (globalData ? mergeTreatmentDepartments(globalData.treatmentDepartments) : TREATMENT_DEPARTMENTS),
    [globalData],
  )
  const [doctors, setDoctors] = useState([])

  useEffect(() => {
    let active = true
    doctorsAPI.getAll()
      .then((response) => {
        if (!active) return
        const normalized = normalizeResponse(response)
        const list = normalized?.data || normalized
        setDoctors(Array.isArray(list) ? list.filter((doctor) => doctor?.isActive !== false) : [])
      })
      .catch(() => {})
    return () => { active = false }
  }, [])

  return (
    <div className='overflow-x-clip bg-[#f4f7fb] text-mt-ink'>
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
