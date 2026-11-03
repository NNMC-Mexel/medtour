import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Clock3, FileHeart, Loader2, Search, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import Button from '../components/ui/Button'
import { cn } from '../utils/helpers'
import useSeo from '../components/seo/useSeo'
import { blogPostsAPI, getMediaUrl } from '../services/api'
import { ALL_CATEGORIES_LABEL, BLOG_CATEGORIES, localizePost, pickFeatured } from '../config/blog'

const PAGE_COPY = {
  ru: { kicker: 'Журнал MedTour', title: 'Понятные ответы для спокойной поездки', text: 'Практические материалы о лечении, подготовке, Астане и восстановительных маршрутах по Казахстану.', discuss: 'Обсудить с координатором', search: 'Поиск по статьям', ask: 'Задать вопрос', read: 'Читать статью', empty: 'По вашему запросу статей пока нет.', none: 'Статей пока нет.', error: 'Не удалось загрузить статьи.', retry: 'Повторить' },
  en: { kicker: 'MedTour Journal', title: 'Clear answers for a confident journey', text: 'Practical guides about treatment, preparation, Astana and recovery travel in Kazakhstan.', discuss: 'Discuss with a coordinator', search: 'Search articles', ask: 'Ask a question', read: 'Read article', empty: 'No articles found.', none: 'No articles yet.', error: 'Could not load articles.', retry: 'Try again' },
  kk: { kicker: 'MedTour журналы', title: 'Тыныш сапарға арналған түсінікті жауаптар', text: 'Емдеу, дайындық, Астана және Қазақстан бойынша оңалу бағыттары туралы практикалық материалдар.', discuss: 'Үйлестірушімен талқылау', search: 'Мақалалардан іздеу', ask: 'Сұрақ қою', read: 'Мақаланы оқу', empty: 'Сұранысыңыз бойынша әзірге мақала жоқ.', none: 'Әзірге мақала жоқ.', error: 'Мақалаларды жүктеу мүмкін болмады.', retry: 'Қайталау' },
}

function BlogPage() {
  const { i18n } = useTranslation()
  useSeo({ title: i18n.t('seo.blog_title'), description: i18n.t('seo.blog_description'), path: '/blog' })
  const lang = ['ru', 'en', 'kk'].includes(i18n.language) ? i18n.language : 'ru'
  const copy = PAGE_COPY[lang]
  const [category, setCategory] = useState('all')
  const [query, setQuery] = useState('')
  const [posts, setPosts] = useState([])
  const [status, setStatus] = useState('loading')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    blogPostsAPI.list()
      .then((response) => { if (active) { setPosts(response.data?.data || []); setStatus('ready') } })
      .catch(() => { if (active) setStatus('error') })
    return () => { active = false }
  }, [attempt])
  const retry = () => { setStatus('loading'); setAttempt((n) => n + 1) }

  const sourceArticles = useMemo(() => posts.map((post) => localizePost(post, lang, getMediaUrl)), [posts, lang])
  const categories = ['all', ...BLOG_CATEGORIES.map(({ id }) => id).filter((id) => posts.some((post) => post.category === id))]
  const categoryName = (id) => (id === 'all' ? ALL_CATEGORIES_LABEL[lang] : BLOG_CATEGORIES.find((item) => item.id === id)?.label[lang])
  const visible = useMemo(() => sourceArticles.filter((article) => {
    const matchesCategory = category === 'all' || article.category === category
    const matchesQuery = `${article.title} ${article.excerpt}`.toLowerCase().includes(query.toLowerCase())
    return matchesCategory && matchesQuery
  }), [category, query, sourceArticles])
  const featured = pickFeatured(sourceArticles)
  // Статья без текста — только анонс: ведёт к координатору, а не на пустую страницу.
  const articleLink = (article) => (article.hasContent ? `/blog/${article.slug}` : '/register')

  return (
    <div className='min-h-screen bg-[#f4f7fb] text-mt-ink'>
      <section className='relative overflow-hidden bg-mt-ink px-4 pb-20 pt-36 text-white sm:px-6 lg:px-8 lg:pb-24'>
        <div className='absolute -right-28 top-0 h-96 w-96 rounded-full border-[72px] border-white/5' />
        <div className='absolute bottom-0 left-1/3 h-36 w-36 rounded-full bg-mt-coral/25 blur-3xl' />
        <div className='relative mx-auto max-w-7xl'>
          <div className='max-w-3xl'>
            <div className='inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[.16em] text-[#ffc75d]'><Sparkles className='h-4 w-4' />{copy.kicker}</div>
            <h1 className='mt-5 text-5xl font-semibold tracking-[-.045em] sm:text-6xl'>{copy.title}</h1>
            <p className='mt-6 max-w-2xl text-lg leading-8 text-white/70'>{copy.text}</p>
          </div>
        </div>
      </section>

      <main className='mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24'>
        {status === 'loading' && <div className='flex justify-center py-24'><Loader2 className='h-8 w-8 animate-spin text-mt-blue' /></div>}
        {status === 'error' && <div className='rounded-[1.6rem] border border-dashed border-[#cfd4e0] bg-white p-12 text-center'><FileHeart className='mx-auto h-10 w-10 text-mt-coral' /><p className='mt-4 text-[#697188]'>{copy.error}</p><Button variant='secondary' className='mt-6' onClick={retry}>{copy.retry}</Button></div>}
        {status === 'ready' && !featured && <div className='rounded-[1.6rem] border border-dashed border-[#cfd4e0] bg-white p-12 text-center'><FileHeart className='mx-auto h-10 w-10 text-mt-coral' /><p className='mt-4 text-[#697188]'>{copy.none}</p></div>}
        {status === 'ready' && featured && <>
        <article className='grid overflow-hidden rounded-[2rem] bg-white shadow-[0_24px_70px_rgba(16,27,63,.09)] lg:grid-cols-2'>
          <div className='min-h-80 overflow-hidden'>{featured.image && <img src={featured.image} alt='' className='h-full w-full object-cover' />}</div>
          <div className='flex flex-col justify-center p-8 sm:p-12'>
            <div className='flex items-center gap-3 text-xs font-bold uppercase tracking-[.14em] text-mt-blue'><span>{featured.categoryLabel}</span>{featured.read && <><span className='h-1 w-1 rounded-full bg-mt-coral' /><span>{featured.read}</span></>}</div>
            <h2 className='mt-5 text-3xl font-semibold leading-tight tracking-[-.025em] sm:text-4xl'>{featured.title}</h2>
            <p className='mt-5 text-lg leading-8 text-[#697188]'>{featured.excerpt}</p>
            <Link to={articleLink(featured)} className='mt-8'><Button>{featured.hasContent ? copy.read : copy.discuss}<ArrowRight className='ml-2 h-5 w-5' /></Button></Link>
          </div>
        </article>

        <div className='mt-16 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between'>
          <div className='flex gap-2 overflow-x-auto pb-2'>{categories.map((item) => <button key={item} type='button' onClick={() => setCategory(item)} className={cn('whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition', category === item ? 'border-mt-blue bg-mt-blue text-white' : 'border-[#dfe3ec] bg-white text-[#5e667c] hover:border-mt-blue/40')}>{categoryName(item)}</button>)}</div>
          <label className='relative block w-full lg:w-80'><Search className='absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8b92a5]' /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.search} className='w-full rounded-full border border-[#dfe3ec] bg-white py-3 pl-11 pr-4 text-sm outline-none transition focus:border-mt-blue' /></label>
        </div>

        <div className='mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3'>
          {visible.map((article) => <article key={article.id} className='group overflow-hidden rounded-[1.6rem] border border-[#dfe3ec] bg-white transition hover:-translate-y-1 hover:shadow-[0_20px_60px_rgba(16,27,63,.10)]'>
            <div className='h-56 overflow-hidden bg-[#e8edf5]'>{article.image && <img src={article.image} alt='' loading='lazy' className='h-full w-full object-cover transition duration-500 group-hover:scale-105' />}</div>
            <div className='p-6'><div className='flex items-center justify-between text-xs font-bold uppercase tracking-[.12em] text-mt-blue'><span>{article.categoryLabel}</span>{article.read && <span className='flex items-center gap-1 text-[#8b92a5]'><Clock3 className='h-3.5 w-3.5' />{article.read}</span>}</div><h2 className='mt-4 text-xl font-semibold leading-snug'>{article.hasContent ? <Link to={articleLink(article)} className='hover:text-mt-blue'>{article.title}</Link> : article.title}</h2><p className='mt-3 line-clamp-3 text-sm leading-6 text-[#697188]'>{article.excerpt}</p><Link to={articleLink(article)} className='mt-6 inline-flex items-center gap-2 text-sm font-semibold text-mt-blue'>{article.hasContent ? copy.read : copy.ask}<ArrowRight className='h-4 w-4' /></Link></div>
          </article>)}
        </div>

        {visible.length === 0 && <div className='mt-8 rounded-[1.6rem] border border-dashed border-[#cfd4e0] bg-white p-12 text-center'><FileHeart className='mx-auto h-10 w-10 text-mt-coral' /><p className='mt-4 text-[#697188]'>{copy.empty}</p></div>}
        </>}
      </main>
    </div>
  )
}

export default BlogPage
