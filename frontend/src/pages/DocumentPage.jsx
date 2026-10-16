import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { ChevronLeft, FileText, ListTree, Printer, RotateCcw } from 'lucide-react'
import useSeo from '../components/seo/useSeo'
import LegalDocumentBody from '../components/legal/LegalDocumentBody'
import { DOC_LANG_PARAM, LEGAL_LANGS, LEGAL_LANG_NAMES, formatRevisionDate, parseLegalMarkup } from '../config/legalMarkup'
import { legalDocumentsAPI } from '../services/api'

const SEO_KEYS = { offer: 'offer', consent: 'consent' }

function TableOfContents({ toc, activeId, onNavigate }) {
  return (
    <ol className='space-y-1 text-sm'>
      {toc.map((item) => (
        <li key={item.id}>
          <a
            href={`#${item.id}`}
            onClick={onNavigate}
            aria-current={activeId === item.id ? 'location' : undefined}
            className={`block rounded-lg py-1.5 pr-2 leading-snug transition-colors ${item.level === 1 ? 'pl-2 font-medium' : 'pl-5'} ${activeId === item.id ? 'bg-mt-mint text-mt-accent' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
          >
            {item.text}
          </a>
        </li>
      ))}
    </ol>
  )
}

/** /documents/:slug — оферта, согласия. Текст правится в Admin > Правовые документы. */
export default function DocumentPage() {
  const { slug } = useParams()
  const { t, i18n } = useTranslation()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const siteLang = i18n.language?.split('-')?.[0] || 'ru'
  const defaultLang = LEGAL_LANGS.includes(siteLang) ? siteLang : 'ru'
  const requestedLang = LEGAL_LANGS.includes(searchParams.get(DOC_LANG_PARAM)) ? searchParams.get(DOC_LANG_PARAM) : defaultLang

  const requestKey = `${slug}:${requestedLang}`
  const [result, setResult] = useState({ key: null, status: 'loading', doc: null })
  const [attempt, setAttempt] = useState(0)
  const [activeId, setActiveId] = useState(null)
  const [tocOpen, setTocOpen] = useState(false)

  useEffect(() => {
    let active = true
    legalDocumentsAPI.get(slug, requestedLang)
      .then((response) => { if (active) setResult({ key: requestKey, status: 'ready', doc: response.data?.data }) })
      .catch((error) => { if (active) setResult({ key: requestKey, status: error?.response?.status === 404 ? 'missing' : 'error', doc: null }) })
    return () => { active = false }
  }, [slug, requestedLang, requestKey, attempt])
  const retry = () => {
    setResult((current) => ({ ...current, status: 'loading' }))
    setAttempt((n) => n + 1)
  }

  // Пока грузится другой язык, показываем прежний текст этого же документа.
  const isCurrent = result.key === requestKey
  const state = { status: isCurrent ? result.status : 'loading' }
  const doc = isCurrent ? result.doc : (result.doc?.slug === slug ? result.doc : null)
  const parsed = useMemo(() => parseLegalMarkup(doc?.body), [doc?.body])
  const seoKey = SEO_KEYS[slug]
  useSeo({
    title: seoKey ? t(`seo.${seoKey}_title`) : doc?.title && `${doc.title} — MedTour`,
    description: seoKey ? t(`seo.${seoKey}_description`) : t('seo.documents_description'),
    path: `/documents/${slug}`,
  })

  // Текст приходит после загрузки, поэтому браузер сам до якоря не докрутит.
  // Без анимации: на сайте включена плавная прокрутка, а здесь нужен сразу нужный раздел.
  useEffect(() => {
    if (state.status !== 'ready') return
    const id = decodeURIComponent(location.hash.replace(/^#/, ''))
    if (id) document.getElementById(id)?.scrollIntoView({ block: 'start', behavior: 'instant' })
    else window.scrollTo({ top: 0, behavior: 'instant' })
  }, [state.status, doc?.slug, doc?.lang, location.hash])

  // Подсветка текущего пункта оглавления.
  useEffect(() => {
    if (!parsed.toc.length) return undefined
    const nodes = parsed.toc.map((item) => document.getElementById(item.id)).filter(Boolean)
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
      if (visible[0]) setActiveId(visible[0].target.id)
    }, { rootMargin: '-96px 0px -70% 0px' })
    nodes.forEach((node) => observer.observe(node))
    return () => observer.disconnect()
  }, [parsed])

  const chooseLanguage = (lang) => {
    const next = new URLSearchParams(searchParams)
    if (lang === defaultLang) next.delete(DOC_LANG_PARAM)
    else next.set(DOC_LANG_PARAM, lang)
    setSearchParams(next, { replace: true })
  }

  if (state.status === 'missing' || state.status === 'error') {
    const missing = state.status === 'missing'
    return (
      <div className='min-h-[60vh] bg-slate-50 px-4 pb-20 pt-36'>
        <div className='mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-8 text-center'>
          <FileText className='mx-auto h-10 w-10 text-slate-300' />
          <h1 className='mt-4 text-xl font-semibold text-mt-ink'>{missing ? t('legal_docs.not_found') : t('legal_docs.load_error')}</h1>
          {missing && <p className='mt-2 text-slate-600'>{t('legal_docs.not_found_text')}</p>}
          <div className='mt-6 flex justify-center gap-3'>
            {!missing && (
              <button type='button' onClick={retry} className='inline-flex items-center gap-2 rounded-xl bg-mt-accent px-4 py-2.5 text-sm font-medium text-white'>
                <RotateCcw className='h-4 w-4' />{t('legal_docs.retry')}
              </button>
            )}
            <Link to='/documents' className='inline-flex items-center rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50'>{t('legal_docs.all_documents')}</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div data-legal-document className='min-h-screen bg-slate-50 pb-20 pt-20 print:pt-0'>
      <div className='mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-8'>
        <Link to='/documents' className='inline-flex items-center gap-1.5 text-sm font-medium text-mt-accent hover:text-mt-accent-strong print:hidden'>
          <ChevronLeft className='h-4 w-4' />{t('legal_docs.all_documents')}
        </Link>

        <div className='mt-5 flex flex-col gap-5 border-b border-slate-200 pb-6 lg:flex-row lg:items-end lg:justify-between'>
          <div className='min-w-0'>
            {doc
              ? <h1 className='text-3xl font-semibold tracking-[-.03em] text-mt-ink sm:text-4xl'>{doc.title}</h1>
              : <div className='h-10 w-80 max-w-full animate-pulse rounded-xl bg-slate-200' />}
            {doc?.revisionDate && <p className='mt-2 text-sm text-slate-500'>{t('legal_docs.revision', { date: formatRevisionDate(doc.revisionDate, siteLang) })}</p>}
          </div>
          {doc && (
            <div className='flex flex-wrap items-center gap-3 print:hidden'>
              <div role='group' aria-label={t('legal_docs.languages')} className='inline-flex rounded-xl border border-slate-200 bg-white p-1'>
                {doc.languages.map((lang) => (
                  <button
                    key={lang}
                    type='button'
                    lang={lang}
                    onClick={() => chooseLanguage(lang)}
                    aria-pressed={doc.lang === lang}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${doc.lang === lang ? 'bg-mt-accent text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                  >
                    {LEGAL_LANG_NAMES[lang] || lang}
                  </button>
                ))}
              </div>
              <button type='button' onClick={() => window.print()} className='inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50'>
                <Printer className='h-4 w-4' />{t('legal_docs.print')}
              </button>
            </div>
          )}
        </div>

        <div className='mt-8 grid gap-8 lg:grid-cols-[17rem_minmax(0,1fr)]'>
          {parsed.toc.length > 0 && (
            <nav aria-label={t('legal_docs.contents')} className='print:hidden'>
              <div className='lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto'>
                <button type='button' onClick={() => setTocOpen((open) => !open)} aria-expanded={tocOpen} className='flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-mt-ink lg:hidden'>
                  <span className='inline-flex items-center gap-2'><ListTree className='h-4 w-4' />{t('legal_docs.contents')}</span>
                  <span aria-hidden='true'>{tocOpen ? '−' : '+'}</span>
                </button>
                <p className='mb-3 hidden text-xs font-bold uppercase tracking-[.16em] text-slate-400 lg:block'>{t('legal_docs.contents')}</p>
                <div className={`${tocOpen ? 'mt-2 block rounded-xl border border-slate-200 bg-white p-2' : 'hidden'} lg:block`}>
                  <TableOfContents toc={parsed.toc} activeId={activeId} onNavigate={() => setTocOpen(false)} />
                </div>
              </div>
            </nav>
          )}

          <article className={`min-w-0 rounded-3xl border border-slate-200 bg-white px-5 py-8 shadow-sm sm:px-10 sm:py-12 print:border-0 print:p-0 print:shadow-none ${parsed.toc.length ? '' : 'lg:col-span-2'}`}>
            {doc
              ? <LegalDocumentBody blocks={parsed.blocks} lang={doc.lang} linkLang={doc.lang === defaultLang ? null : doc.lang} />
              : <div className='space-y-3'>{Array.from({ length: 8 }, (_, i) => <div key={i} className='h-4 animate-pulse rounded bg-slate-100' style={{ width: `${90 - (i % 3) * 15}%` }} />)}</div>}
          </article>
        </div>
      </div>
    </div>
  )
}
