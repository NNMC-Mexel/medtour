import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { FileText, ChevronLeft, RotateCcw, CreditCard, AlertCircle } from 'lucide-react'
import useSeo from '../components/seo/useSeo'
import { termsCopy } from '../data/legalCopy'
import useSiteContentStore from '../stores/siteContentStore'
import { parseLegalText } from '../config/siteContent'

function Section({ title, paragraphs = [], bullets = [], after }) {
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
        {after && <p className="mt-2">{after}</p>}
      </div>
    </section>
  )
}

export default function TermsPage() {
  const { i18n } = useTranslation()
  useSeo({ title: i18n.t('seo.terms_title'), description: i18n.t('seo.terms_description'), path: '/terms' })
  const baseCopy = termsCopy[i18n.language] || termsCopy.en
  // Текст из Admin > Контент сайта > Правовые документы заменяет разделы целиком.
  const override = useSiteContentStore((state) => state.content.legal.terms[i18n.language])
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
              <FileText className="w-6 h-6 text-teal-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{copy.title}</h1>
              <p className="text-sm text-slate-500 mt-0.5">{copy.updated}</p>
            </div>
          </div>

          {copy.sections.slice(0, 3).map((section) => (
            <Section key={`${section.title}-${section.paragraphs?.[0] || ''}`} {...section} />
          ))}

          <div className="mb-10 -mt-6 flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <CreditCard className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <p className="font-semibold mb-1">{copy.paymentPartnerTitle}</p>
              <p>
                {copy.paymentPartnerText}{' '}
                <a
                  href="https://epay.homebank.kz/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-amber-900 font-medium"
                >
                  epay.homebank.kz
                </a>
              </p>
            </div>
          </div>

          <section id="refund" className="mb-10">
            <div className="flex items-center gap-3 mb-4 pb-2 border-b border-slate-200">
              <RotateCcw className="w-5 h-5 text-teal-600" />
              <h2 className="text-xl font-semibold text-slate-900">{copy.refundTitle}</h2>
            </div>
            <div className="space-y-4 text-slate-600 leading-relaxed">
              <div className="overflow-x-auto">
                <table className="w-full text-sm border border-slate-200 rounded-xl overflow-hidden">
                  <thead className="bg-slate-100 text-slate-700">
                    <tr>
                      {copy.refundColumns.map((column) => (
                        <th key={column} className="text-left px-4 py-3 font-semibold">
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {copy.refundRows.map((row, rowIndex) => (
                      <tr key={row[0]} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                        {row.map((cell, cellIndex) => (
                          <td
                            key={cellIndex}
                            className={`px-4 py-3 ${cellIndex === 1 && cell === '100%' ? 'text-emerald-600 font-medium' : ''} ${cellIndex === 1 && cell !== '100%' ? 'text-rose-500 font-medium' : ''}`}
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold mb-1">{copy.refundRequestTitle}</p>
                  <p>{copy.refundRequestText}</p>
                </div>
              </div>
            </div>
          </section>

          {copy.sections.slice(3).map((section) => (
            <Section key={`${section.title}-${section.paragraphs?.[0] || ''}`} {...section} />
          ))}
        </div>

        <div className="mt-6 text-center">
          <Link to="/privacy" className="text-sm text-teal-600 hover:text-teal-700">
            {copy.privacyLink}
          </Link>
        </div>
      </div>
    </div>
  )
}
