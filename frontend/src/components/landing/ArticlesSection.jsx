import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Clock3 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import Reveal from './Reveal'
import { blogPostsAPI, getMediaUrl } from '../../services/api'
import { localizePost } from '../../config/blog'

const LANDING_LIMIT = 3

/** Первые статьи из Admin > Блог / Статьи; если сервер недоступен — статьи из landingCopy. */
function useLandingArticles(fallback) {
  const { i18n } = useTranslation()
  const lang = ['ru', 'en', 'kk'].includes(i18n.language) ? i18n.language : 'ru'
  const [state, setState] = useState({ status: 'loading', posts: [] })

  useEffect(() => {
    let active = true
    blogPostsAPI.list()
      .then((response) => { if (active) setState({ status: 'ready', posts: response.data?.data || [] }) })
      .catch(() => { if (active) setState({ status: 'error', posts: [] }) })
    return () => { active = false }
  }, [])

  return useMemo(() => {
    if (state.status === 'error') return fallback.map((article) => ({ ...article, href: '/blog' }))
    const featured = state.posts.filter((post) => post.isFeatured)
    return [...featured, ...state.posts.filter((post) => !post.isFeatured)]
      .slice(0, LANDING_LIMIT)
      .map((post) => {
        const view = localizePost(post, lang, getMediaUrl)
        return { key: post.documentId, title: view.title, category: view.categoryLabel, read: view.read, image: view.image, href: post.hasContent ? `/blog/${post.slug}` : '/blog' }
      })
  }, [state, lang, fallback])
}

function ArticlesSection({ copy }) {
  const articles = useLandingArticles(copy.articles)
  return (
    <section id='blog' className='scroll-mt-24 bg-white py-24 lg:py-32'>
      <div className='mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
        <Reveal className='flex flex-col justify-between gap-5 sm:flex-row sm:items-end'><div><p className='medtour-kicker'>{copy.blogEyebrow}</p><h2 className='medtour-title mt-4'>{copy.blogTitle}</h2></div><Link to='/blog' className='inline-flex items-center gap-2 font-semibold text-mt-accent-strong'>{copy.blogCta}<ArrowRight className='h-5 w-5' /></Link></Reveal>
        <div className='mt-12 grid gap-5 lg:grid-cols-2 lg:grid-rows-2'>
          {articles.map((article, index) => <Reveal key={article.key || article.title} delay={index * 70} className={index === 0 ? 'lg:row-span-2' : ''}><Link to={article.href} className={`group grid h-full overflow-hidden rounded-[1.8rem] border border-[#dfe5ee] bg-[#f8fafc] ${index === 0 ? 'grid-rows-[300px_auto] lg:grid-rows-[390px_auto]' : 'sm:grid-cols-[220px_1fr]'}`}><div className='overflow-hidden bg-[#e8edf5]'>{article.image && <img src={article.image} alt='' loading='lazy' className='h-full min-h-[220px] w-full object-cover transition duration-700 group-hover:scale-[1.035]' />}</div><div className='flex flex-col p-6'><div className='flex items-center justify-between gap-4 text-xs font-bold uppercase tracking-[.12em] text-mt-accent-strong'><span>{article.category}</span>{article.read && <span className='flex items-center gap-1 text-[#8993a5]'><Clock3 className='h-3.5 w-3.5' />{article.read}</span>}</div><h3 className={`${index === 0 ? 'mt-5 text-2xl sm:text-3xl' : 'mt-4 text-xl'} font-semibold leading-snug text-mt-ink transition group-hover:text-mt-accent-strong`}>{article.title}</h3><ArrowRight className='mt-auto h-5 w-5 self-end text-[#9ca6b7] transition group-hover:translate-x-1 group-hover:text-mt-accent-strong' /></div></Link></Reveal>)}
        </div>
      </div>
    </section>
  )
}

export default ArticlesSection
