import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Clock3, FileHeart, Search, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import Button from '../components/ui/Button'
import { cn } from '../utils/helpers'
import useSeo from '../components/seo/useSeo'

const ARTICLES = [
  { id: 1, category: 'preparation', image: '/treatments/medical-department-hero.png', featured: true,
    ru: { title: 'Какие документы подготовить для онлайн-консультации', excerpt: 'Короткий список медицинских выписок, снимков и анализов, который поможет врачу дать более точную первичную рекомендацию.', read: '6 минут' },
    en: { title: 'What to prepare for an online medical consultation', excerpt: 'A concise list of medical reports, scans and test results that helps your doctor give a more useful initial opinion.', read: '6 min' },
    kk: { title: 'Онлайн-кеңеске қандай құжаттар дайындау керек', excerpt: 'Дәрігерге нақтырақ алғашқы ұсыным беруге көмектесетін медициналық үзінділер, суреттер және талдаулардың қысқа тізімі.', read: '6 минут' } },
  { id: 2, category: 'astana', image: '/tourism/astana.jpg',
    ru: { title: 'Первый день в столице: мягкий маршрут после перелёта', excerpt: 'Как спланировать день без спешки: трансфер, заселение, спокойная прогулка и время на адаптацию.', read: '5 минут' },
    en: { title: 'Your first day: a gentle route after the flight', excerpt: 'Plan an unhurried day with transfer, check-in, a short walk and enough time to adapt.', read: '5 min' },
    kk: { title: 'Елордадағы алғашқы күн: ұшудан кейінгі жеңіл бағыт', excerpt: 'Күнді асықпай жоспарлау: трансфер, қонақүйге орналасу, тыныш серуен және бейімделуге уақыт.', read: '5 минут' } },
  { id: 3, category: 'recovery', image: '/tourism/burabay.jpg',
    ru: { title: 'Как выбрать темп путешествия после лечения', excerpt: 'На что обратить внимание, прежде чем добавлять экскурсии и природные маршруты в медицинскую поездку.', read: '7 минут' },
    en: { title: 'How to choose the right travel pace after treatment', excerpt: 'What to consider before adding excursions and nature routes to your medical journey.', read: '7 min' },
    kk: { title: 'Емнен кейін саяхат қарқынын қалай таңдау керек', excerpt: 'Медициналық сапарға экскурсиялар мен табиғи бағыттарды қоспас бұрын неге назар аудару керек.', read: '7 минут' } },
  { id: 4, category: 'routes', image: '/tourism/burabay.jpg',
    ru: { title: 'Бурабай за один день: озёра, сосны и главные локации', excerpt: 'Продуманный маршрут из Астаны с прогулками, панорамными точками и временем для спокойного отдыха.', read: '8 минут' },
    en: { title: 'Burabay in one day: lakes, pines and highlights', excerpt: 'A balanced route from Astana with scenic viewpoints, walks and time for quiet rest.', read: '8 min' },
    kk: { title: 'Бурабай бір күнде: көлдер, қарағайлар және басты орындар', excerpt: 'Астанадан серуендер, панорамалық нүктелер және тыныш демалысқа уақыты бар ойластырылған бағыт.', read: '8 минут' } },
  { id: 5, category: 'routes', image: '/tourism/bayanaul.webp',
    ru: { title: 'Баянаул: природная перезагрузка у озера Жасыбай', excerpt: 'Что посмотреть в национальном парке и кому подойдёт более насыщенная однодневная программа.', read: '8 минут' },
    en: { title: 'Bayanaul: a natural reset by Lake Jasybay', excerpt: 'What to see in the national park and who will enjoy this more immersive day route.', read: '8 min' },
    kk: { title: 'Баянауыл: Жасыбай көлі жағасында табиғатпен қайта жаңару', excerpt: 'Ұлттық паркте не көруге болады және мазмұнды бір күндік бағдарлама кімге лайық.', read: '8 минут' } },
  { id: 6, category: 'planning', image: '/astana-medtour-hero.webp',
    ru: { title: 'Переводчик, трансфер и отель: как работает координатор', excerpt: 'Разбираем, какие бытовые вопросы можно решить заранее и как устроено сопровождение во время поездки.', read: '6 минут' },
    en: { title: 'Interpreter, transfer and hotel: what your coordinator does', excerpt: 'The practical details that can be arranged in advance and how support works during your journey.', read: '6 min' },
    kk: { title: 'Аудармашы, трансфер және қонақүй: үйлестіруші қалай жұмыс істейді', excerpt: 'Қандай тұрмыстық мәселелерді алдын ала шешуге болатынын және сапар кезіндегі сүйемелдеуді түсіндіреміз.', read: '6 минут' } },
]

const CATEGORY_LABELS = {
  all: { ru: 'Все', en: 'All', kk: 'Барлығы' },
  preparation: { ru: 'Подготовка', en: 'Preparation', kk: 'Дайындық' },
  astana: { ru: 'Астана', en: 'Astana', kk: 'Астана' },
  recovery: { ru: 'Восстановление', en: 'Recovery', kk: 'Оңалу' },
  routes: { ru: 'Маршруты', en: 'Routes', kk: 'Бағыттар' },
  planning: { ru: 'Организация', en: 'Planning', kk: 'Ұйымдастыру' },
}

const PAGE_COPY = {
  ru: { kicker: 'Журнал MedTour', title: 'Понятные ответы для спокойной поездки', text: 'Практические материалы о лечении, подготовке, Астане и восстановительных маршрутах по Казахстану.', discuss: 'Обсудить с координатором', search: 'Поиск по статьям', ask: 'Задать вопрос', empty: 'По вашему запросу статей пока нет.' },
  en: { kicker: 'MedTour Journal', title: 'Clear answers for a confident journey', text: 'Practical guides about treatment, preparation, Astana and recovery travel in Kazakhstan.', discuss: 'Discuss with a coordinator', search: 'Search articles', ask: 'Ask a question', empty: 'No articles found.' },
  kk: { kicker: 'MedTour журналы', title: 'Тыныш сапарға арналған түсінікті жауаптар', text: 'Емдеу, дайындық, Астана және Қазақстан бойынша оңалу бағыттары туралы практикалық материалдар.', discuss: 'Үйлестірушімен талқылау', search: 'Мақалалардан іздеу', ask: 'Сұрақ қою', empty: 'Сұранысыңыз бойынша әзірге мақала жоқ.' },
}

function BlogPage() {
  const { i18n } = useTranslation()
  useSeo({ title: i18n.t('seo.blog_title'), description: i18n.t('seo.blog_description'), path: '/blog' })
  const lang = ['ru', 'en', 'kk'].includes(i18n.language) ? i18n.language : 'ru'
  const copy = PAGE_COPY[lang]
  const [category, setCategory] = useState('all')
  const [query, setQuery] = useState('')
  const sourceArticles = useMemo(
    () => ARTICLES.map((article) => ({ ...article, ...article[lang], categoryLabel: CATEGORY_LABELS[article.category][lang] })),
    [lang],
  )
  const categories = ['all', ...new Set(ARTICLES.map((article) => article.category))]
  const visible = useMemo(() => sourceArticles.filter((article) => {
    const matchesCategory = category === 'all' || article.category === category
    const matchesQuery = `${article.title} ${article.excerpt}`.toLowerCase().includes(query.toLowerCase())
    return matchesCategory && matchesQuery
  }), [category, query, sourceArticles])
  const featured = sourceArticles[0]

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
        <article className='grid overflow-hidden rounded-[2rem] bg-white shadow-[0_24px_70px_rgba(16,27,63,.09)] lg:grid-cols-2'>
          <div className='min-h-80 overflow-hidden'><img src={featured.image} alt='' className='h-full w-full object-cover' /></div>
          <div className='flex flex-col justify-center p-8 sm:p-12'>
            <div className='flex items-center gap-3 text-xs font-bold uppercase tracking-[.14em] text-mt-blue'><span>{featured.categoryLabel}</span><span className='h-1 w-1 rounded-full bg-mt-coral' /><span>{featured.read}</span></div>
            <h2 className='mt-5 text-3xl font-semibold leading-tight tracking-[-.025em] sm:text-4xl'>{featured.title}</h2>
            <p className='mt-5 text-lg leading-8 text-[#697188]'>{featured.excerpt}</p>
            <Link to='/register' className='mt-8'><Button>{copy.discuss}<ArrowRight className='ml-2 h-5 w-5' /></Button></Link>
          </div>
        </article>

        <div className='mt-16 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between'>
          <div className='flex gap-2 overflow-x-auto pb-2'>{categories.map((item) => <button key={item} type='button' onClick={() => setCategory(item)} className={cn('whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition', category === item ? 'border-mt-blue bg-mt-blue text-white' : 'border-[#dfe3ec] bg-white text-[#5e667c] hover:border-mt-blue/40')}>{CATEGORY_LABELS[item][lang]}</button>)}</div>
          <label className='relative block w-full lg:w-80'><Search className='absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8b92a5]' /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.search} className='w-full rounded-full border border-[#dfe3ec] bg-white py-3 pl-11 pr-4 text-sm outline-none transition focus:border-mt-blue' /></label>
        </div>

        <div className='mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3'>
          {visible.map((article) => <article key={article.id} className='group overflow-hidden rounded-[1.6rem] border border-[#dfe3ec] bg-white transition hover:-translate-y-1 hover:shadow-[0_20px_60px_rgba(16,27,63,.10)]'>
            <div className='h-56 overflow-hidden'><img src={article.image} alt='' loading='lazy' className='h-full w-full object-cover transition duration-500 group-hover:scale-105' /></div>
            <div className='p-6'><div className='flex items-center justify-between text-xs font-bold uppercase tracking-[.12em] text-mt-blue'><span>{article.categoryLabel}</span><span className='flex items-center gap-1 text-[#8b92a5]'><Clock3 className='h-3.5 w-3.5' />{article.read}</span></div><h2 className='mt-4 text-xl font-semibold leading-snug'>{article.title}</h2><p className='mt-3 line-clamp-3 text-sm leading-6 text-[#697188]'>{article.excerpt}</p><Link to='/register' className='mt-6 inline-flex items-center gap-2 text-sm font-semibold text-mt-blue'>{copy.ask}<ArrowRight className='h-4 w-4' /></Link></div>
          </article>)}
        </div>

        {visible.length === 0 && <div className='mt-8 rounded-[1.6rem] border border-dashed border-[#cfd4e0] bg-white p-12 text-center'><FileHeart className='mx-auto h-10 w-10 text-mt-coral' /><p className='mt-4 text-[#697188]'>{copy.empty}</p></div>}
      </main>
    </div>
  )
}

export default BlogPage
