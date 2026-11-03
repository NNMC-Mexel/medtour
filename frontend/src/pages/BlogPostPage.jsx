import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowRight, ChevronLeft, Clock3, FileHeart, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import Button from '../components/ui/Button'
import useSeo from '../components/seo/useSeo'
import LegalDocumentBody from '../components/legal/LegalDocumentBody'
import { parseLegalMarkup } from '../config/legalMarkup'
import { localizePost } from '../config/blog'
import { blogPostsAPI, getMediaUrl } from '../services/api'

const COPY = {
  ru: { back: 'Все статьи', missing: 'Статья не найдена', missingText: 'Возможно, её сняли с публикации или изменили адрес.', error: 'Не удалось загрузить статью.', retry: 'Повторить', ctaTitle: 'Остались вопросы?', ctaText: 'Координатор MedTour поможет подобрать врача, подготовить документы и спланировать поездку.', cta: 'Обсудить с координатором' },
  en: { back: 'All articles', missing: 'Article not found', missingText: 'It may have been unpublished or moved.', error: 'Could not load the article.', retry: 'Try again', ctaTitle: 'Still have questions?', ctaText: 'A MedTour coordinator will help you choose a doctor, prepare documents and plan your trip.', cta: 'Discuss with a coordinator' },
  kk: { back: 'Барлық мақалалар', missing: 'Мақала табылмады', missingText: 'Мүмкін, ол жарияланымнан алынған немесе мекенжайы өзгерген.', error: 'Мақаланы жүктеу мүмкін болмады.', retry: 'Қайталау', ctaTitle: 'Сұрақтарыңыз бар ма?', ctaText: 'MedTour үйлестірушісі дәрігер таңдауға, құжаттарды дайындауға және сапарды жоспарлауға көмектеседі.', cta: 'Үйлестірушімен талқылау' },
}

/** /blog/:slug — статья из Admin > Блог / Статьи. */
function BlogPostPage() {
  const { slug } = useParams()
  const { i18n } = useTranslation()
  const lang = ['ru', 'en', 'kk'].includes(i18n.language) ? i18n.language : 'ru'
  const copy = COPY[lang]
  const [result, setResult] = useState({ slug: null, status: 'loading', post: null })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    blogPostsAPI.get(slug)
      .then((response) => { if (active) setResult({ slug, status: 'ready', post: response.data?.data }) })
      .catch((error) => { if (active) setResult({ slug, status: error?.response?.status === 404 ? 'missing' : 'error', post: null }) })
    return () => { active = false }
  }, [slug, attempt])
  const retry = () => { setResult((current) => ({ ...current, status: 'loading' })); setAttempt((n) => n + 1) }

  const status = result.slug === slug ? result.status : 'loading'
  const post = useMemo(() => (result.post ? localizePost(result.post, lang, getMediaUrl) : null), [result.post, lang])
  const blocks = useMemo(() => parseLegalMarkup(post?.content).blocks, [post?.content])
  useSeo({
    title: post?.title ? `${post.title} — MedTour` : i18n.t('seo.blog_title'),
    description: post?.excerpt || i18n.t('seo.blog_description'),
    path: `/blog/${slug}`,
  })

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }) }, [slug])

  if (status !== 'ready' || !post) {
    return (
      <div className='min-h-[60vh] bg-[#f4f7fb] px-4 pb-20 pt-36'>
        {status === 'loading' ? (
          <div className='flex justify-center py-24'><Loader2 className='h-8 w-8 animate-spin text-mt-blue' /></div>
        ) : (
          <div className='mx-auto max-w-xl rounded-3xl border border-[#dfe3ec] bg-white p-8 text-center'>
            <FileHeart className='mx-auto h-10 w-10 text-mt-coral' />
            <h1 className='mt-4 text-xl font-semibold text-mt-ink'>{status === 'missing' ? copy.missing : copy.error}</h1>
            {status === 'missing' && <p className='mt-2 text-[#697188]'>{copy.missingText}</p>}
            <div className='mt-6 flex justify-center gap-3'>
              {status === 'error' && <Button onClick={retry}>{copy.retry}</Button>}
              <Link to='/blog'><Button variant='secondary'>{copy.back}</Button></Link>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className='min-h-screen bg-[#f4f7fb] text-mt-ink'>
      <section className='relative overflow-hidden bg-mt-ink px-4 pb-16 pt-36 text-white sm:px-6 lg:px-8 lg:pb-20'>
        <div className='absolute -right-28 top-0 h-96 w-96 rounded-full border-[72px] border-white/5' />
        <div className='relative mx-auto max-w-3xl'>
          <Link to='/blog' className='inline-flex items-center gap-1 text-sm font-medium text-white/70 transition hover:text-white'><ChevronLeft className='h-4 w-4' />{copy.back}</Link>
          <div className='mt-6 flex items-center gap-3 text-xs font-bold uppercase tracking-[.14em] text-[#ffc75d]'>
            <span>{post.categoryLabel}</span>
            {post.read && <><span className='h-1 w-1 rounded-full bg-mt-coral' /><span className='flex items-center gap-1'><Clock3 className='h-3.5 w-3.5' />{post.read}</span></>}
          </div>
          <h1 className='mt-5 text-4xl font-semibold leading-tight tracking-[-.035em] sm:text-5xl'>{post.title}</h1>
          {post.excerpt && <p className='mt-6 text-lg leading-8 text-white/70'>{post.excerpt}</p>}
        </div>
      </section>

      <main className='mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:py-16'>
        {post.image && <img src={post.image} alt='' className='mb-10 max-h-[460px] w-full rounded-[1.6rem] object-cover' />}
        <article className='rounded-[1.6rem] bg-white p-6 shadow-[0_24px_70px_rgba(16,27,63,.06)] sm:p-10'>
          <LegalDocumentBody blocks={blocks} lang={lang} />
        </article>
        <div className='mt-10 rounded-[1.6rem] bg-mt-ink p-8 text-white sm:p-10'>
          <h2 className='text-2xl font-semibold'>{copy.ctaTitle}</h2>
          <p className='mt-3 leading-7 text-white/70'>{copy.ctaText}</p>
          <Link to='/register' className='mt-6 inline-block'><Button>{copy.cta}<ArrowRight className='ml-2 h-5 w-5' /></Button></Link>
        </div>
      </main>
    </div>
  )
}

export default BlogPostPage
