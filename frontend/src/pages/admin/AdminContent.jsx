import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Check,
  ExternalLink,
  FileSignature,
  LayoutTemplate,
  Loader2,
  Menu as MenuIcon,
  Palette,
  Phone,
  RefreshCcw,
  RotateCcw,
  Save,
  Search,
} from 'lucide-react'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Textarea from '../../components/ui/Textarea'
import LocalizedFields from '../../components/admin/LocalizedFields'
import { useToast } from '../../components/ui/Toast'
import { contentAPI, normalizeResponse } from '../../services/api'
import { landingCopy } from '../../data/landingCopy'
import { privacyCopy, termsCopy } from '../../data/legalCopy'
import {
  CONTENT_LANGS,
  LANDING_SECTIONS,
  NAV_ITEMS,
  compactSiteContent,
  contactHref,
  fieldToText,
  legalSectionsToText,
  readSiteContent,
  textToField,
} from '../../config/siteContent'
import {
  SITE_THEME_PALETTES,
  applySiteTheme,
  getSiteThemePalette,
  isValidHexColor,
  normalizeSiteTheme,
} from '../../config/siteThemes'
import useSiteContentStore from '../../stores/siteContentStore'
import { cn } from '../../utils/helpers'

/**
 * Контент сайта по разделам — как в MedConnect. Раньше страница правила поля
 * старого лендинга, которые нигде не показывались; теперь каждое поле здесь
 * соответствует тому, что видит посетитель.
 *
 * Сохранение общее: в хранилище это один документ (Global.landingConfig), и
 * раздельная запись означала бы гонку правок. Поэтому рядом с кнопкой всегда
 * видно, есть ли несохранённые изменения.
 */
const SECTIONS = [
  { id: 'appearance', icon: Palette },
  { id: 'landing', icon: LayoutTemplate },
  { id: 'contacts', icon: Phone },
  { id: 'navigation', icon: MenuIcon },
  { id: 'legal', icon: FileSignature },
  { id: 'seo', icon: Search },
]

const LANG_LABELS = { ru: 'Русский', kk: 'Қазақша', en: 'English' }

const copyByLanguage = {
  ru: {
    title: 'Контент сайта MedTour', subtitle: 'Оформление сайта, тексты главной, контакты, меню, правовые документы и SEO',
    refresh: 'Обновить', save: 'Сохранить', unsaved: 'Есть несохранённые изменения', saved: 'Контент сохранён — сайт уже обновлён',
    loadError: 'Не удалось загрузить контент сайта', saveError: 'Не удалось сохранить контент',
    leaveConfirm: 'Есть несохранённые изменения. Уйти со страницы?',
    sections: { appearance: 'Оформление', landing: 'Главная страница', contacts: 'Контакты', navigation: 'Шапка и меню', legal: 'Правовые документы', seo: 'SEO и метаданные' },
    intro: {
      appearance: 'Палитра сайта и кабинетов. Общая для всех языков — переключать язык здесь не нужно.',
      landing: 'Тексты главной страницы. Выберите язык и правьте блоки; пустое поле вернёт текст по умолчанию.',
      contacts: 'Контакты в подвале сайта. Общие для всех языков, кроме адреса и часов работы.',
      navigation: 'Пункты верхнего меню сайта: можно скрыть пункт или переименовать его на любом языке.',
      legal: 'Тексты политики конфиденциальности и пользовательского соглашения на каждом языке.',
      seo: 'Название сайта и то, как главная страница выглядит в поиске и при отправке ссылки.',
    },
    paletteTitle: 'Цветовая схема сайта', paletteText: 'Палитра меняет акценты, кнопки, тёмные блоки и подсветку на лендинге и в кабинетах. До сохранения изменения видны только вам.',
    accentTitle: 'Свой акцентный цвет', accentText: 'Кнопки, ссылки и активные состояния получат согласованную шкалу оттенков. Оставьте пустым, чтобы использовать цвет палитры.',
    accentReset: 'Цвет палитры', accentInvalid: 'Цвет в формате #RRGGBB',
    openSection: 'Открыть на сайте', resetField: 'Вернуть текст по умолчанию',
    linesHint: 'Каждый пункт — с новой строки', pairsHint: 'Каждый этап с новой строки: «Заголовок | Текст»',
    phone: 'Телефон', email: 'Email', website: 'Сайт', whatsapp: 'WhatsApp (номер)', telegram: 'Telegram (@username или ссылка)', instagram: 'Instagram (@username или ссылка)',
    address: 'Адрес', hours: 'Часы работы', contactsHint: 'Пустое поле не показывается на сайте.', contactInvalid: 'Это не ссылка — поле не покажется на сайте',
    navVisible: 'Показывать', navLabel: 'Подпись', navHidden: 'Скрыт', navHint: 'Пустая подпись — стандартная для языка.',
    privacy: 'Политика конфиденциальности', terms: 'Пользовательское соглашение',
    legalSyntax: 'Разметка: «## Заголовок» — новый раздел, «- текст» — пункт списка, остальные строки — абзацы.',
    legalReset: 'Вернуть текст по умолчанию', legalCustom: 'Изменён', legalDefault: 'По умолчанию', legalOpen: 'Открыть страницу',
    siteName: 'Название сайта', siteDescription: 'Описание сайта',
    seoTitle: 'Заголовок главной в поиске', seoDescription: 'Описание главной в поиске',
    seoNote: 'Для поисковых роботов без JavaScript заголовки задаются при сборке сайта; эти значения применяются в браузере и при следующей сборке не теряются.',
    nameRequired: 'Укажите название сайта',
  },
  en: {
    title: 'MedTour site content', subtitle: 'Appearance, home page copy, contacts, menu, legal documents and SEO',
    refresh: 'Refresh', save: 'Save', unsaved: 'Unsaved changes', saved: 'Content saved — the site is already updated',
    loadError: 'Failed to load site content', saveError: 'Failed to save content',
    leaveConfirm: 'You have unsaved changes. Leave the page?',
    sections: { appearance: 'Appearance', landing: 'Home page', contacts: 'Contacts', navigation: 'Header and menu', legal: 'Legal documents', seo: 'SEO and metadata' },
    intro: {
      appearance: 'Palette for the site and the accounts. Shared by all languages — no need to switch language here.',
      landing: 'Home page copy. Pick a language and edit the blocks; an empty field restores the default text.',
      contacts: 'Contacts in the site footer. Shared by all languages except the address and opening hours.',
      navigation: 'Top menu items: hide an item or rename it in any language.',
      legal: 'Privacy policy and terms of use in each language.',
      seo: 'Site name and how the home page looks in search results and link previews.',
    },
    paletteTitle: 'Site colour scheme', paletteText: 'The palette changes accents, buttons, dark blocks and highlights on the landing page and in the accounts. Until you save, only you see it.',
    accentTitle: 'Custom accent colour', accentText: 'Buttons, links and active states get a matching shade scale. Leave empty to use the palette colour.',
    accentReset: 'Palette colour', accentInvalid: 'Use the #RRGGBB format',
    openSection: 'Open on site', resetField: 'Restore default text',
    linesHint: 'One item per line', pairsHint: 'One step per line: “Title | Text”',
    phone: 'Phone', email: 'Email', website: 'Website', whatsapp: 'WhatsApp (number)', telegram: 'Telegram (@username or link)', instagram: 'Instagram (@username or link)',
    address: 'Address', hours: 'Opening hours', contactsHint: 'Empty fields are not shown on the site.', contactInvalid: 'Not a link — this field will not be shown',
    navVisible: 'Show', navLabel: 'Label', navHidden: 'Hidden', navHint: 'An empty label uses the standard one for the language.',
    privacy: 'Privacy policy', terms: 'Terms of use',
    legalSyntax: 'Markup: “## Title” starts a section, “- text” is a list item, other lines are paragraphs.',
    legalReset: 'Restore default text', legalCustom: 'Edited', legalDefault: 'Default', legalOpen: 'Open page',
    siteName: 'Site name', siteDescription: 'Site description',
    seoTitle: 'Home page title in search', seoDescription: 'Home page description in search',
    seoNote: 'Crawlers without JavaScript get titles set at build time; these values apply in the browser and survive the next build.',
    nameRequired: 'Enter the site name',
  },
  kk: {
    title: 'MedTour сайтының мазмұны', subtitle: 'Безендіру, басты бет мәтіндері, байланыс, мәзір, құқықтық құжаттар және SEO',
    refresh: 'Жаңарту', save: 'Сақтау', unsaved: 'Сақталмаған өзгерістер бар', saved: 'Мазмұн сақталды — сайт жаңартылды',
    loadError: 'Сайт мазмұнын жүктеу мүмкін болмады', saveError: 'Мазмұнды сақтау мүмкін болмады',
    leaveConfirm: 'Сақталмаған өзгерістер бар. Беттен шығасыз ба?',
    sections: { appearance: 'Безендіру', landing: 'Басты бет', contacts: 'Байланыс', navigation: 'Тақырып және мәзір', legal: 'Құқықтық құжаттар', seo: 'SEO және метадеректер' },
    intro: {
      appearance: 'Сайт пен кабинеттердің палитрасы. Барлық тілге ортақ — мұнда тілді ауыстырудың қажеті жоқ.',
      landing: 'Басты бет мәтіндері. Тілді таңдап, блоктарды өңдеңіз; бос өріс әдепкі мәтінді қайтарады.',
      contacts: 'Сайт төменгі бөлігіндегі байланыс. Мекенжай мен жұмыс уақытынан басқасы барлық тілге ортақ.',
      navigation: 'Жоғарғы мәзір тармақтары: тармақты жасыруға немесе кез келген тілде атауын өзгертуге болады.',
      legal: 'Құпиялылық саясаты мен пайдаланушы келісімінің әр тілдегі мәтіні.',
      seo: 'Сайт атауы және басты беттің іздеуде және сілтеме алдын ала қарауында көрінуі.',
    },
    paletteTitle: 'Сайттың түс схемасы', paletteText: 'Палитра лендинг пен кабинеттердегі акцент, батырма, қараңғы блок және жарықтандыру түстерін өзгертеді. Сақтағанға дейін тек сізге көрінеді.',
    accentTitle: 'Өз акцент түсіңіз', accentText: 'Батырмалар, сілтемелер және белсенді күйлер үйлесімді реңк шкаласын алады. Палитра түсін қолдану үшін бос қалдырыңыз.',
    accentReset: 'Палитра түсі', accentInvalid: '#RRGGBB форматындағы түс',
    openSection: 'Сайтта ашу', resetField: 'Әдепкі мәтінді қайтару',
    linesHint: 'Әр тармақ жаңа жолдан', pairsHint: 'Әр кезең жаңа жолдан: «Тақырып | Мәтін»',
    phone: 'Телефон', email: 'Email', website: 'Сайт', whatsapp: 'WhatsApp (нөмір)', telegram: 'Telegram (@username немесе сілтеме)', instagram: 'Instagram (@username немесе сілтеме)',
    address: 'Мекенжай', hours: 'Жұмыс уақыты', contactsHint: 'Бос өріс сайтта көрсетілмейді.', contactInvalid: 'Бұл сілтеме емес — өріс сайтта көрсетілмейді',
    navVisible: 'Көрсету', navLabel: 'Атауы', navHidden: 'Жасырын', navHint: 'Бос атау — тілдің стандартты атауы.',
    privacy: 'Құпиялылық саясаты', terms: 'Пайдаланушы келісімі',
    legalSyntax: 'Белгілеу: «## Тақырып» — жаңа бөлім, «- мәтін» — тізім тармағы, қалған жолдар — абзацтар.',
    legalReset: 'Әдепкі мәтінді қайтару', legalCustom: 'Өзгертілген', legalDefault: 'Әдепкі', legalOpen: 'Бетті ашу',
    siteName: 'Сайт атауы', siteDescription: 'Сайт сипаттамасы',
    seoTitle: 'Басты беттің іздеудегі тақырыбы', seoDescription: 'Басты беттің іздеудегі сипаттамасы',
    seoNote: 'JavaScript-сіз іздеу роботтары үшін тақырыптар сайт жиналғанда беріледі; бұл мәндер браузерде қолданылады.',
    nameRequired: 'Сайт атауын көрсетіңіз',
  },
}

const LEGAL_DEFAULTS = { privacy: privacyCopy, terms: termsCopy }
const legalDefaultText = (doc, lang) => {
  const source = LEGAL_DEFAULTS[doc]
  const copy = source[lang] || source.en
  return legalSectionsToText(copy.sections)
}

const landingDefaults = (lang) => landingCopy[lang] || landingCopy.ru

/** Состояние редактора: тексты главной в виде строк, по языкам. */
function buildLandingDrafts(content) {
  return Object.fromEntries(CONTENT_LANGS.map((lang) => {
    const defaults = landingDefaults(lang)
    const overrides = content.landing[lang] || {}
    const entries = LANDING_SECTIONS.flatMap((section) => section.fields.map((field) => {
      const value = overrides[field.key] !== undefined ? overrides[field.key] : defaults[field.key]
      return [field.key, fieldToText(field, value)]
    }))
    return [lang, Object.fromEntries(entries)]
  }))
}

/** Строки редактора → только отличия от текста по умолчанию. */
function landingDraftsToOverrides(drafts) {
  return Object.fromEntries(CONTENT_LANGS.map((lang) => {
    const defaults = landingDefaults(lang)
    const overrides = {}
    LANDING_SECTIONS.forEach((section) => section.fields.forEach((field) => {
      const text = drafts[lang]?.[field.key] ?? ''
      if (!String(text).trim()) return
      if (text.trim() === fieldToText(field, defaults[field.key]).trim()) return
      overrides[field.key] = textToField(field, text)
    }))
    return [lang, overrides]
  }))
}

function buildLegalDrafts(content) {
  return Object.fromEntries(['privacy', 'terms'].map((doc) => [doc, Object.fromEntries(CONTENT_LANGS.map((lang) => [
    lang,
    content.legal[doc]?.[lang] || legalDefaultText(doc, lang),
  ]))]))
}

function legalDraftsToOverrides(drafts) {
  return Object.fromEntries(['privacy', 'terms'].map((doc) => [doc, Object.fromEntries(CONTENT_LANGS
    .map((lang) => [lang, String(drafts[doc]?.[lang] || '')])
    .filter(([lang, text]) => text.trim() && text.trim() !== legalDefaultText(doc, lang).trim()))]))
}

function LangTabs({ value, onChange, className }) {
  return (
    <div role='tablist' className={cn('inline-flex rounded-xl bg-slate-100 p-1', className)}>
      {CONTENT_LANGS.map((lang) => (
        <button
          key={lang}
          type='button'
          role='tab'
          aria-selected={value === lang}
          onClick={() => onChange(lang)}
          className={cn('rounded-lg px-4 py-2 text-sm font-semibold transition-colors', value === lang ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700')}
        >
          {LANG_LABELS[lang]}
        </button>
      ))}
    </div>
  )
}

function Panel({ title, description, actions, children }) {
  return (
    <section className='rounded-3xl border border-slate-200 bg-white'>
      {(title || actions) && (
        <div className='flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7'>
          <div>
            {title && <h2 className='text-lg font-bold text-slate-900'>{title}</h2>}
            {description && <p className='mt-1 text-sm text-slate-500'>{description}</p>}
          </div>
          {actions}
        </div>
      )}
      <div className='p-5 sm:p-7'>{children}</div>
    </section>
  )
}

function PalettePreview({ palette }) {
  const tokens = palette.tokens
  return (
    <div className='relative h-36 overflow-hidden rounded-2xl p-4' style={{ background: `linear-gradient(135deg, ${tokens.night}, ${tokens['ink-soft']})` }}>
      <div className='h-2.5 w-16 rounded-full bg-white/70' />
      <div className='absolute inset-x-4 bottom-4 space-y-3'>
        <div className='h-2 w-3/4 rounded-full bg-white/30' />
        <div className='flex gap-2'>
          <div className='h-8 w-20 rounded-lg' style={{ background: tokens.accent }} />
          <div className='h-8 flex-1 rounded-lg bg-white/85' />
        </div>
      </div>
      <div className='absolute right-4 top-4 h-10 w-10 rounded-full opacity-70 blur-md' style={{ background: tokens.glow }} />
    </div>
  )
}

function AdminContent() {
  const { t, i18n } = useTranslation()
  const uiLang = ['ru', 'en', 'kk'].includes(i18n.language) ? i18n.language : 'ru'
  const copy = copyByLanguage[uiLang]
  const toast = useToast()
  const setFromGlobal = useSiteContentStore((state) => state.setFromGlobal)
  const appliedTheme = useSiteContentStore((state) => state.content.siteTheme)

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [activeSection, setActiveSection] = useState(SECTIONS[0].id)
  const [landingLang, setLandingLang] = useState('ru')
  const [legalDoc, setLegalDoc] = useState('privacy')
  const [legalLang, setLegalLang] = useState('ru')
  const [seoLang, setSeoLang] = useState('ru')

  const [siteName, setSiteName] = useState('')
  const [siteDescription, setSiteDescription] = useState('')
  const [siteTheme, setSiteTheme] = useState(normalizeSiteTheme(null))
  const [accentInput, setAccentInput] = useState('')
  const [landingDrafts, setLandingDrafts] = useState(() => buildLandingDrafts(readSiteContent(null)))
  const [contacts, setContacts] = useState(() => readSiteContent(null).contacts)
  const [navigation, setNavigation] = useState(() => readSiteContent(null).navigation)
  const [legalDrafts, setLegalDrafts] = useState(() => buildLegalDrafts(readSiteContent(null)))
  const [seo, setSeo] = useState(() => readSiteContent(null).seo)
  const [savedSnapshot, setSavedSnapshot] = useState(null)

  const snapshot = useMemo(() => JSON.stringify({
    siteName, siteDescription, siteTheme, landingDrafts, contacts, navigation, legalDrafts, seo,
  }), [siteName, siteDescription, siteTheme, landingDrafts, contacts, navigation, legalDrafts, seo])
  const isDirty = savedSnapshot !== null && savedSnapshot !== snapshot

  // Предпросмотр палитры — сразу на всей странице, без сохранения в браузере.
  // При уходе со страницы возвращаем сохранённую схему.
  const savedThemeRef = useRef(appliedTheme)
  savedThemeRef.current = appliedTheme
  useEffect(() => {
    applySiteTheme(siteTheme, { persist: false })
  }, [siteTheme])
  useEffect(() => () => applySiteTheme(savedThemeRef.current), [])

  useEffect(() => {
    if (!isDirty) return undefined
    const handleBeforeUnload = (event) => {
      event.preventDefault()
      event.returnValue = copy.leaveConfirm
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [copy.leaveConfirm, isDirty])

  const applyLoaded = (global) => {
    const content = readSiteContent(global?.landingConfig)
    const theme = normalizeSiteTheme(content.siteTheme)
    const next = {
      siteName: global?.siteName || 'MedTour',
      siteDescription: global?.siteDescription || '',
      siteTheme: theme,
      landingDrafts: buildLandingDrafts(content),
      contacts: content.contacts,
      navigation: content.navigation,
      legalDrafts: buildLegalDrafts(content),
      seo: content.seo,
    }
    setSiteName(next.siteName)
    setSiteDescription(next.siteDescription)
    setSiteTheme(next.siteTheme)
    setAccentInput(theme.accentColor)
    setLandingDrafts(next.landingDrafts)
    setContacts(next.contacts)
    setNavigation(next.navigation)
    setLegalDrafts(next.legalDrafts)
    setSeo(next.seo)
    setSavedSnapshot(JSON.stringify(next))
  }

  const loadContent = async () => {
    setIsLoading(true)
    try {
      const response = await contentAPI.getGlobal().catch((error) => {
        // Записи Global ещё нет — редактируем значения по умолчанию.
        if (error?.response?.status === 404) return null
        throw error
      })
      applyLoaded(response ? normalizeResponse(response)?.data : null)
    } catch (error) {
      console.error('Error loading site content:', error)
      toast.error(copy.loadError)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadContent()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSave = async () => {
    if (!siteName.trim()) {
      setActiveSection('seo')
      toast.warning(copy.nameRequired)
      return
    }
    setIsSaving(true)
    try {
      const landingConfig = compactSiteContent({
        siteTheme: normalizeSiteTheme(siteTheme),
        landing: landingDraftsToOverrides(landingDrafts),
        contacts,
        navigation,
        legal: legalDraftsToOverrides(legalDrafts),
        seo,
      })
      const response = await contentAPI.updateGlobal({
        siteName: siteName.trim(),
        siteDescription: siteDescription.trim() || undefined,
        landingConfig,
      })
      const saved = normalizeResponse(response)?.data || { siteName, siteDescription, landingConfig }
      savedThemeRef.current = landingConfig.siteTheme
      setFromGlobal(saved)
      applyLoaded(saved)
      toast.success(copy.saved)
    } catch (error) {
      console.error('Error saving site content:', error)
      const reason = error?.response?.data?.error?.message
      toast.error(reason ? `${copy.saveError}: ${reason}` : copy.saveError)
    } finally {
      setIsSaving(false)
    }
  }

  const updateLanding = (key, value) => setLandingDrafts((drafts) => ({
    ...drafts,
    [landingLang]: { ...drafts[landingLang], [key]: value },
  }))

  const setAccent = (value) => {
    setAccentInput(value)
    if (!value.trim()) setSiteTheme((theme) => ({ ...theme, accentColor: '' }))
    else if (isValidHexColor(value)) setSiteTheme((theme) => ({ ...theme, accentColor: value.toLowerCase() }))
  }

  if (isLoading) {
    return <div className='flex justify-center py-20'><Loader2 className='h-8 w-8 animate-spin text-teal-600' /></div>
  }

  const palette = getSiteThemePalette(siteTheme.paletteId)
  const legalText = legalDrafts[legalDoc]?.[legalLang] || ''
  const legalIsDefault = legalText.trim() === legalDefaultText(legalDoc, legalLang).trim()

  return (
    <div className='space-y-6 pb-16'>
      <div className='flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between'>
        <div>
          <h1 className='text-2xl font-bold text-slate-950 sm:text-3xl'>{copy.title}</h1>
          <p className='mt-1 text-slate-600'>{copy.subtitle}</p>
          {isDirty && <p className='mt-2 text-sm font-medium text-amber-600'>{copy.unsaved}</p>}
        </div>
        <div className='flex flex-wrap gap-2'>
          <Button variant='ghost' onClick={loadContent} disabled={isSaving} leftIcon={<RefreshCcw className='h-4 w-4' />}>{copy.refresh}</Button>
          <Button onClick={handleSave} isLoading={isSaving} disabled={!isDirty} leftIcon={<Save className='h-4 w-4' />}>{copy.save}</Button>
        </div>
      </div>

      <nav className='flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5'>
        {SECTIONS.map(({ id, icon: Icon }) => (
          <button
            key={id}
            type='button'
            onClick={() => setActiveSection(id)}
            aria-current={activeSection === id ? 'page' : undefined}
            className={cn(
              'inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors',
              activeSection === id ? 'bg-teal-50 text-teal-700' : 'text-slate-600 hover:bg-slate-50',
            )}
          >
            <Icon className='h-4 w-4' />
            {copy.sections[id]}
          </button>
        ))}
      </nav>

      <p className='text-sm text-slate-500'>{copy.intro[activeSection]}</p>

      {activeSection === 'appearance' && (
        <div className='space-y-6'>
          <Panel title={copy.paletteTitle} description={copy.paletteText}>
            <div role='radiogroup' aria-label={copy.paletteTitle} className='grid gap-4 sm:grid-cols-2 xl:grid-cols-3'>
              {SITE_THEME_PALETTES.map((item) => {
                const selected = item.id === siteTheme.paletteId
                return (
                  <button
                    key={item.id}
                    type='button'
                    role='radio'
                    aria-checked={selected}
                    onClick={() => setSiteTheme((theme) => ({ ...theme, paletteId: item.id }))}
                    className={cn(
                      'relative rounded-3xl border-2 bg-white p-3 text-left transition-all',
                      selected ? 'border-teal-600 shadow-lg shadow-teal-600/10' : 'border-slate-200 hover:border-slate-300',
                    )}
                  >
                    <PalettePreview palette={item} />
                    {selected && (
                      <span className='absolute right-6 top-6 flex h-7 w-7 items-center justify-center rounded-full bg-white text-slate-900 shadow'>
                        <Check className='h-4 w-4' />
                      </span>
                    )}
                    <p className='mt-4 font-semibold text-slate-900'>{item.label[uiLang] || item.label.ru}</p>
                    <p className='mt-1 min-h-10 text-sm text-slate-500'>{item.note[uiLang] || item.note.ru}</p>
                    <div className='mt-3 flex h-2.5 overflow-hidden rounded-full'>
                      {['accent', 'glow', 'mint', 'ink', 'coral'].map((token) => (
                        <span key={token} className='flex-1' style={{ background: item.tokens[token] }} />
                      ))}
                    </div>
                  </button>
                )
              })}
            </div>
          </Panel>

          <Panel title={copy.accentTitle} description={copy.accentText}>
            <div className='flex flex-wrap items-end gap-3'>
              <label className='flex h-11 w-14 cursor-pointer overflow-hidden rounded-xl border border-slate-200'>
                <input
                  type='color'
                  value={siteTheme.accentColor || palette.tokens.accent}
                  onChange={(event) => setAccent(event.target.value)}
                  className='h-14 w-20 -translate-x-2 -translate-y-1 cursor-pointer border-0'
                  aria-label={copy.accentTitle}
                />
              </label>
              <div className='w-40'>
                <Input
                  value={accentInput}
                  onChange={(event) => setAccent(event.target.value.trim())}
                  placeholder={palette.tokens.accent}
                  error={accentInput && !isValidHexColor(accentInput) ? copy.accentInvalid : undefined}
                />
              </div>
              {siteTheme.accentColor && (
                <Button variant='secondary' onClick={() => setAccent('')} leftIcon={<RotateCcw className='h-4 w-4' />}>{copy.accentReset}</Button>
              )}
            </div>
          </Panel>
        </div>
      )}

      {activeSection === 'landing' && (
        <div className='space-y-6'>
          <div className='sticky top-20 z-10 -mx-1 rounded-2xl bg-slate-50/90 px-1 py-2 backdrop-blur'>
            <LangTabs value={landingLang} onChange={setLandingLang} />
          </div>
          {LANDING_SECTIONS.map((section) => (
            <Panel
              key={section.id}
              title={section.label[uiLang] || section.label.ru}
              actions={(
                <a href={`/${section.anchor ? `#${section.anchor}` : ''}`} target='_blank' rel='noreferrer' className='inline-flex items-center gap-1.5 text-sm font-medium text-teal-700 hover:text-teal-800'>
                  {copy.openSection}<ExternalLink className='h-3.5 w-3.5' />
                </a>
              )}
            >
              <div className='grid gap-4 lg:grid-cols-2'>
                {section.fields.map((field) => {
                  const value = landingDrafts[landingLang]?.[field.key] ?? ''
                  const defaultText = fieldToText(field, landingDefaults(landingLang)[field.key])
                  const isWide = field.type !== 'text'
                  const Component = field.type === 'text' ? Input : Textarea
                  const hint = field.type === 'lines' ? copy.linesHint : field.type === 'pairs' ? copy.pairsHint : undefined
                  return (
                    <div key={field.key} className={cn('relative', isWide && 'lg:col-span-2')}>
                      <Component
                        label={field.label[uiLang] || field.label.ru}
                        rows={field.type === 'text' ? undefined : field.rows || 3}
                        value={value}
                        onChange={(event) => updateLanding(field.key, event.target.value)}
                        placeholder={defaultText}
                        hint={hint}
                      />
                      {value.trim() !== defaultText.trim() && (
                        <button
                          type='button'
                          onClick={() => updateLanding(field.key, defaultText)}
                          className='absolute right-0 top-0 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-teal-700'
                          title={copy.resetField}
                        >
                          <RotateCcw className='h-3 w-3' />{copy.resetField}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </Panel>
          ))}
        </div>
      )}

      {activeSection === 'contacts' && (
        <div className='space-y-6'>
          <Panel title={copy.sections.contacts} description={copy.contactsHint}>
            <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
              {['phone', 'email', 'website', 'whatsapp', 'telegram', 'instagram'].map((key) => (
                <Input
                  key={key}
                  label={copy[key]}
                  type={key === 'email' ? 'email' : key === 'phone' || key === 'whatsapp' ? 'tel' : 'text'}
                  value={contacts[key] || ''}
                  onChange={(event) => setContacts((current) => ({ ...current, [key]: event.target.value }))}
                  placeholder={key === 'phone' ? '+7 7172 00 00 00' : key === 'website' ? 'https://www.nnmc.kz/' : ''}
                  error={String(contacts[key] || '').trim() && !contactHref(key, contacts[key]) ? copy.contactInvalid : undefined}
                />
              ))}
            </div>
          </Panel>
          <Panel title={`${copy.address} · ${copy.hours}`}>
            <LocalizedFields
              fields={[
                { key: 'address', label: copy.address, multiline: true, rows: 2, placeholder: t('footer.address') },
                { key: 'hours', label: copy.hours, multiline: true, rows: 2 },
              ]}
              getValue={(lang, key) => contacts[key]?.[lang] || ''}
              setValue={(lang, key, value) => setContacts((current) => ({ ...current, [key]: { ...(current[key] || {}), [lang]: value } }))}
            />
          </Panel>
        </div>
      )}

      {activeSection === 'navigation' && (
        <Panel title={copy.sections.navigation} description={copy.navHint}>
          <div className='divide-y divide-slate-100'>
            {NAV_ITEMS.map((item) => {
              const entry = navigation.items[item.id] || { visible: true, label: {} }
              const update = (patch) => setNavigation((current) => ({
                ...current,
                items: { ...current.items, [item.id]: { ...entry, ...patch } },
              }))
              return (
                <div key={item.id} className='grid gap-3 py-4 lg:grid-cols-[180px_1fr] lg:items-center'>
                  <label className='flex cursor-pointer items-center gap-3'>
                    <input
                      type='checkbox'
                      checked={entry.visible !== false}
                      onChange={(event) => update({ visible: event.target.checked })}
                      className='h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500'
                    />
                    <span className={cn('font-medium', entry.visible === false ? 'text-slate-400 line-through' : 'text-slate-800')}>
                      {i18n.getFixedT(uiLang)(item.labelKey)}
                    </span>
                    {entry.visible === false && <span className='rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700'>{copy.navHidden}</span>}
                  </label>
                  <div className='grid gap-2 sm:grid-cols-3'>
                    {CONTENT_LANGS.map((lang) => (
                      <Input
                        key={lang}
                        aria-label={`${copy.navLabel} (${LANG_LABELS[lang]})`}
                        value={entry.label?.[lang] || ''}
                        onChange={(event) => update({ label: { ...(entry.label || {}), [lang]: event.target.value } })}
                        placeholder={`${lang.toUpperCase()}: ${i18n.getFixedT(lang)(item.labelKey)}`}
                        disabled={entry.visible === false}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </Panel>
      )}

      {activeSection === 'legal' && (
        <Panel
          title={legalDoc === 'privacy' ? copy.privacy : copy.terms}
          description={copy.legalSyntax}
          actions={(
            <a href={legalDoc === 'privacy' ? '/privacy' : '/terms'} target='_blank' rel='noreferrer' className='inline-flex items-center gap-1.5 text-sm font-medium text-teal-700 hover:text-teal-800'>
              {copy.legalOpen}<ExternalLink className='h-3.5 w-3.5' />
            </a>
          )}
        >
          <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
            <div className='inline-flex rounded-xl bg-slate-100 p-1'>
              {['privacy', 'terms'].map((doc) => (
                <button
                  key={doc}
                  type='button'
                  onClick={() => setLegalDoc(doc)}
                  className={cn('rounded-lg px-4 py-2 text-sm font-semibold', legalDoc === doc ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500')}
                >
                  {doc === 'privacy' ? copy.privacy : copy.terms}
                </button>
              ))}
            </div>
            <LangTabs value={legalLang} onChange={setLegalLang} />
          </div>
          <div className='mt-5 flex items-center justify-between gap-3'>
            <span className={cn('rounded-full px-2.5 py-1 text-xs font-medium', legalIsDefault ? 'bg-slate-100 text-slate-600' : 'bg-amber-50 text-amber-700')}>
              {legalIsDefault ? copy.legalDefault : copy.legalCustom}
            </span>
            {!legalIsDefault && (
              <Button
                variant='secondary'
                size='sm'
                onClick={() => setLegalDrafts((drafts) => ({ ...drafts, [legalDoc]: { ...drafts[legalDoc], [legalLang]: legalDefaultText(legalDoc, legalLang) } }))}
                leftIcon={<RotateCcw className='h-4 w-4' />}
              >
                {copy.legalReset}
              </Button>
            )}
          </div>
          <Textarea
            containerClassName='mt-3'
            className='font-mono text-sm'
            rows={22}
            value={legalText}
            onChange={(event) => setLegalDrafts((drafts) => ({ ...drafts, [legalDoc]: { ...drafts[legalDoc], [legalLang]: event.target.value } }))}
          />
        </Panel>
      )}

      {activeSection === 'seo' && (
        <div className='space-y-6'>
          <Panel title={copy.sections.seo}>
            <div className='grid gap-4 lg:grid-cols-2'>
              <Input label={copy.siteName} required value={siteName} onChange={(event) => setSiteName(event.target.value)} />
              <Input label={copy.siteDescription} value={siteDescription} onChange={(event) => setSiteDescription(event.target.value)} />
            </div>
          </Panel>
          <Panel
            title={`${copy.seoTitle} · ${copy.seoDescription}`}
            description={copy.seoNote}
            actions={<LangTabs value={seoLang} onChange={setSeoLang} />}
          >
            <div className='space-y-4'>
              <Input
                label={copy.seoTitle}
                maxLength={120}
                value={seo[seoLang]?.title || ''}
                onChange={(event) => setSeo((current) => ({ ...current, [seoLang]: { ...current[seoLang], title: event.target.value } }))}
                placeholder={i18n.getFixedT(seoLang)('seo.home_title')}
              />
              <Textarea
                label={copy.seoDescription}
                rows={3}
                maxLength={320}
                value={seo[seoLang]?.description || ''}
                onChange={(event) => setSeo((current) => ({ ...current, [seoLang]: { ...current[seoLang], description: event.target.value } }))}
                placeholder={i18n.getFixedT(seoLang)('seo.home_description')}
              />
            </div>
          </Panel>
        </div>
      )}
    </div>
  )
}

export default AdminContent
