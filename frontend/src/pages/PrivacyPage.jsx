import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Shield, ChevronLeft } from 'lucide-react'
import useSeo from '../components/seo/useSeo'
import { privacyCopy } from '../data/legalCopy'
import useSiteContentStore from '../stores/siteContentStore'
import { parseLegalText } from '../config/siteContent'

function Section({ title, paragraphs = [], bullets = [] }) {
  return (
    <section className="mb-10">
      {title && (
        <h2 className="text-xl font-semibold text-slate-900 mb-4 pb-2 border-b border-slate-200">
          {title}
        </h2>
      )}
      <div className="space-y-3 text-slate-600 leading-relaxed">
        {paragraphs.map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
        {bullets.length > 0 && (
          <ul className="list-disc pl-6 space-y-1.5">
            {bullets.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

export default function PrivacyPage() {
  const { i18n } = useTranslation()
  useSeo({ title: i18n.t('seo.privacy_title'), description: i18n.t('seo.privacy_description'), path: '/privacy' })
  const baseCopy = privacyCopy[i18n.language] || privacyCopy.en
  // Текст из Admin > Контент сайта > Правовые документы заменяет разделы целиком.
  const override = useSiteContentStore((state) => state.content.legal.privacy[i18n.language])
  const copy = override?.trim() ? { ...baseCopy, sections: parseLegalText(override) } : baseCopy

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-teal-600 hover:text-teal-700 mb-8"
        >
          <ChevronLeft className="w-4 h-4" />
          {copy.back}
        </Link>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 sm:p-10">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Shield className="w-6 h-6 text-teal-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{copy.title}</h1>
              <p className="text-sm text-slate-500 mt-0.5">{copy.updated}</p>
            </div>
          </div>

          {copy.sections.map((section) => (
            <Section key={`${section.title}-${section.paragraphs?.[0] || ''}`} {...section} />
          ))}
        </div>

        <div className="mt-6 text-center">
          <Link to="/terms" className="text-sm text-teal-600 hover:text-teal-700">
            {copy.nextLink}
          </Link>
        </div>
      </div>
    </div>
  )
}
