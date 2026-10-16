import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ArrowRight, FileCheck2, FileSignature, ScrollText, Shield } from 'lucide-react'
import useSeo from '../components/seo/useSeo'
import { LEGAL_LANG_NAMES, formatRevisionDate } from '../config/legalMarkup'
import { legalDocumentsAPI } from '../services/api'

const ICONS = { offer: FileSignature, consent: FileCheck2 }

function DocumentCard({ to, icon: Icon, title, text, meta, languages, openLabel }) {
  return (
    <Link to={to} className='group flex h-full flex-col rounded-3xl border border-slate-200 bg-white p-6 transition hover:-translate-y-0.5 hover:border-mt-accent/40 hover:shadow-[0_18px_45px_rgba(15,23,42,.08)]'>
      <span className='flex h-12 w-12 items-center justify-center rounded-2xl bg-mt-mint text-mt-accent'><Icon className='h-6 w-6' /></span>
      <h2 className='mt-5 text-lg font-semibold text-mt-ink'>{title}</h2>
      {text && <p className='mt-2 text-sm leading-6 text-slate-600'>{text}</p>}
      <div className='mt-auto pt-5'>
        {meta && <p className='text-xs text-slate-500'>{meta}</p>}
        {languages?.length > 0 && (
          <p className='mt-2 flex flex-wrap gap-1.5'>
            {languages.map((lang) => <span key={lang} lang={lang} className='rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600'>{LEGAL_LANG_NAMES[lang] || lang}</span>)}
          </p>
        )}
        <span className='mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-mt-accent'>{openLabel}<ArrowRight className='h-4 w-4 transition group-hover:translate-x-0.5' /></span>
      </div>
    </Link>
  )
}

/** /documents — все правовые документы: оферта и согласия из админки, политика и условия. */
export default function DocumentsPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language?.split('-')?.[0] || 'ru'
  const [docs, setDocs] = useState(null)
  useSeo({ title: t('seo.documents_title'), description: t('seo.documents_description'), path: '/documents' })

  useEffect(() => {
    let active = true
    legalDocumentsAPI.list()
      .then((response) => { if (active) setDocs(response.data?.data || []) })
      .catch(() => { if (active) setDocs([]) })
    return () => { active = false }
  }, [])

  return (
    <div className='min-h-screen bg-slate-50 pb-20 pt-20'>
      <div className='mx-auto max-w-6xl px-4 pt-12 sm:px-6 lg:px-8'>
        <p className='medtour-kicker'>MedTour</p>
        <h1 className='mt-3 text-3xl font-semibold tracking-[-.03em] text-mt-ink sm:text-4xl'>{t('legal_docs.hub_title')}</h1>
        <p className='mt-3 max-w-2xl text-slate-600'>{t('legal_docs.hub_text')}</p>

        <div className='mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4'>
          {docs === null && Array.from({ length: 2 }, (_, i) => <div key={i} className='h-64 animate-pulse rounded-3xl bg-white' />)}
          {docs?.map((doc) => (
            <DocumentCard
              key={doc.slug}
              to={`/documents/${doc.slug}`}
              icon={ICONS[doc.slug] || ScrollText}
              title={doc.title?.[lang] || doc.title?.ru || doc.slug}
              meta={doc.revisionDate ? t('legal_docs.revision', { date: formatRevisionDate(doc.revisionDate, lang) }) : ''}
              languages={doc.languages}
              openLabel={t('legal_docs.open')}
            />
          ))}
          <DocumentCard to='/privacy' icon={Shield} title={t('footer.privacy')} text={t('legal_docs.privacy_text')} openLabel={t('legal_docs.open')} />
          <DocumentCard to='/terms' icon={ScrollText} title={t('footer.terms')} text={t('legal_docs.terms_text')} openLabel={t('legal_docs.open')} />
        </div>
      </div>
    </div>
  )
}
