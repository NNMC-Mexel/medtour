// Контент сайта, который правится в Admin > Контент сайта.
//
// Всё хранится в Global.landingConfig одним документом:
//   {
//     version: 2,
//     siteTheme: { paletteId, accentColor },
//     landing:   { ru: { heroTitle: '…', … }, en: {…}, kk: {…} },   // только изменённые тексты
//     contacts:  { phone, email, website, whatsapp, telegram, instagram, address: {ru,en,kk}, hours: {ru,en,kk} },
//     navigation:{ items: { home: { visible, label: {ru,en,kk} }, … } },
//     legal:     { privacy: {ru,en,kk}, terms: {ru,en,kk} },        // текст разметкой (см. parseLegalText)
//     seo:       { ru: { title, description }, en: {…}, kk: {…} },
//   }
//
// Пустое значение означает «как в коде»: тексты лендинга лежат в
// data/landingCopy.js, и админ переопределяет только то, что хочет поменять.

export const CONTENT_LANGS = ['ru', 'kk', 'en']

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const str = (value) => (typeof value === 'string' ? value : '')

/**
 * Поля главной страницы по блокам. type: text | textarea | lines (список
 * строк) | pairs (строки «Заголовок | Текст»). key — ключ в landingCopy.
 */
export const LANDING_SECTIONS = [
  {
    id: 'hero',
    label: { ru: 'Первый экран', en: 'Hero', kk: 'Бірінші экран' },
    anchor: '',
    fields: [
      { key: 'heroEyebrow', type: 'text', label: { ru: 'Надзаголовок', en: 'Eyebrow', kk: 'Үстіңгі жол' } },
      { key: 'heroTitle', type: 'textarea', rows: 2, label: { ru: 'Заголовок', en: 'Title', kk: 'Тақырып' } },
      { key: 'heroText', type: 'textarea', rows: 3, label: { ru: 'Текст', en: 'Text', kk: 'Мәтін' } },
      { key: 'heroPrimary', type: 'text', label: { ru: 'Главная кнопка', en: 'Primary button', kk: 'Негізгі батырма' } },
      { key: 'heroSecondary', type: 'text', label: { ru: 'Вторая кнопка', en: 'Secondary button', kk: 'Екінші батырма' } },
      { key: 'trust', type: 'lines', rows: 3, label: { ru: 'Преимущества под кнопками', en: 'Trust points under the buttons', kk: 'Батырма астындағы артықшылықтар' } },
    ],
  },
  {
    id: 'process',
    label: { ru: 'Путь пациента', en: 'Patient journey', kk: 'Пациент жолы' },
    anchor: 'process',
    fields: [
      { key: 'processEyebrow', type: 'text', label: { ru: 'Надзаголовок', en: 'Eyebrow', kk: 'Үстіңгі жол' } },
      { key: 'processTitle', type: 'text', label: { ru: 'Заголовок', en: 'Title', kk: 'Тақырып' } },
      { key: 'processText', type: 'textarea', rows: 3, label: { ru: 'Текст', en: 'Text', kk: 'Мәтін' } },
      { key: 'steps', type: 'pairs', rows: 6, label: { ru: 'Этапы', en: 'Steps', kk: 'Кезеңдер' } },
    ],
  },
  {
    id: 'treatments',
    label: { ru: 'Лечение и диагностика', en: 'Treatment and diagnostics', kk: 'Емдеу және диагностика' },
    anchor: 'specializations',
    fields: [
      { key: 'medEyebrow', type: 'text', label: { ru: 'Надзаголовок', en: 'Eyebrow', kk: 'Үстіңгі жол' } },
      { key: 'medTitle', type: 'text', label: { ru: 'Заголовок', en: 'Title', kk: 'Тақырып' } },
      { key: 'medText', type: 'textarea', rows: 3, label: { ru: 'Текст', en: 'Text', kk: 'Мәтін' } },
    ],
  },
  {
    id: 'platform',
    label: { ru: 'Цифровая платформа', en: 'Digital platform', kk: 'Цифрлық платформа' },
    anchor: 'platform',
    fields: [
      { key: 'platformEyebrow', type: 'text', label: { ru: 'Надзаголовок', en: 'Eyebrow', kk: 'Үстіңгі жол' } },
      { key: 'platformTitle', type: 'text', label: { ru: 'Заголовок', en: 'Title', kk: 'Тақырып' } },
      { key: 'platformText', type: 'textarea', rows: 3, label: { ru: 'Текст', en: 'Text', kk: 'Мәтін' } },
      { key: 'platformFeatures', type: 'lines', rows: 6, label: { ru: 'Возможности кабинета', en: 'Account features', kk: 'Кабинет мүмкіндіктері' } },
    ],
  },
  {
    id: 'doctors',
    label: { ru: 'Врачи', en: 'Doctors', kk: 'Дәрігерлер' },
    anchor: 'doctors',
    fields: [
      { key: 'doctorsEyebrow', type: 'text', label: { ru: 'Надзаголовок', en: 'Eyebrow', kk: 'Үстіңгі жол' } },
      { key: 'doctorsTitle', type: 'text', label: { ru: 'Заголовок', en: 'Title', kk: 'Тақырып' } },
      { key: 'doctorsText', type: 'textarea', rows: 2, label: { ru: 'Текст', en: 'Text', kk: 'Мәтін' } },
    ],
  },
  {
    id: 'programs',
    label: { ru: 'Программы и check-up', en: 'Programs and check-ups', kk: 'Бағдарламалар және check-up' },
    anchor: 'programs',
    fields: [
      { key: 'programsEyebrow', type: 'text', label: { ru: 'Надзаголовок', en: 'Eyebrow', kk: 'Үстіңгі жол' } },
      { key: 'programsTitle', type: 'text', label: { ru: 'Заголовок', en: 'Title', kk: 'Тақырып' } },
      { key: 'programsText', type: 'textarea', rows: 3, label: { ru: 'Текст', en: 'Text', kk: 'Мәтін' } },
    ],
  },
  {
    id: 'travel',
    label: { ru: 'Поездка и туризм', en: 'Travel and tourism', kk: 'Сапар және туризм' },
    anchor: 'travel',
    fields: [
      { key: 'ecosystemEyebrow', type: 'text', label: { ru: 'Экосистема: надзаголовок', en: 'Ecosystem: eyebrow', kk: 'Экожүйе: үстіңгі жол' } },
      { key: 'ecosystemTitle', type: 'text', label: { ru: 'Экосистема: заголовок', en: 'Ecosystem: title', kk: 'Экожүйе: тақырып' } },
      { key: 'ecosystemText', type: 'textarea', rows: 3, label: { ru: 'Экосистема: текст', en: 'Ecosystem: text', kk: 'Экожүйе: мәтін' } },
      { key: 'routeEyebrow', type: 'text', label: { ru: 'Туризм: надзаголовок', en: 'Tourism: eyebrow', kk: 'Туризм: үстіңгі жол' } },
      { key: 'routeTitle', type: 'text', label: { ru: 'Туризм: заголовок', en: 'Tourism: title', kk: 'Туризм: тақырып' } },
      { key: 'routeText', type: 'textarea', rows: 3, label: { ru: 'Туризм: текст', en: 'Tourism: text', kk: 'Туризм: мәтін' } },
      { key: 'services', type: 'lines', rows: 6, label: { ru: 'Услуги по организации поездки', en: 'Travel services', kk: 'Сапарды ұйымдастыру қызметтері' } },
    ],
  },
  {
    id: 'blog',
    label: { ru: 'Блог', en: 'Blog', kk: 'Блог' },
    anchor: 'blog',
    fields: [
      { key: 'blogEyebrow', type: 'text', label: { ru: 'Надзаголовок', en: 'Eyebrow', kk: 'Үстіңгі жол' } },
      { key: 'blogTitle', type: 'text', label: { ru: 'Заголовок', en: 'Title', kk: 'Тақырып' } },
    ],
  },
  {
    id: 'cta',
    label: { ru: 'Заявка внизу страницы', en: 'Final call to action', kk: 'Беттің төменгі өтінімі' },
    anchor: 'contact',
    fields: [
      { key: 'ctaEyebrow', type: 'text', label: { ru: 'Надзаголовок', en: 'Eyebrow', kk: 'Үстіңгі жол' } },
      { key: 'ctaTitle', type: 'text', label: { ru: 'Заголовок', en: 'Title', kk: 'Тақырып' } },
      { key: 'ctaText', type: 'textarea', rows: 3, label: { ru: 'Текст', en: 'Text', kk: 'Мәтін' } },
      { key: 'ctaButton', type: 'text', label: { ru: 'Кнопка', en: 'Button', kk: 'Батырма' } },
    ],
  },
]

const LANDING_FIELDS = new Map(LANDING_SECTIONS.flatMap((section) => section.fields.map((field) => [field.key, field])))

// Строки редактора ↔ значения landingCopy.
export function fieldToText(field, value) {
  if (field.type === 'lines') return Array.isArray(value) ? value.join('\n') : ''
  if (field.type === 'pairs') {
    return Array.isArray(value) ? value.map((item) => [item?.title, item?.text].filter(Boolean).join(' | ')).join('\n') : ''
  }
  return str(value)
}

export function textToField(field, text) {
  const lines = String(text || '').split('\n').map((line) => line.trim()).filter(Boolean)
  if (field.type === 'lines') return lines
  if (field.type === 'pairs') {
    return lines.map((line) => {
      const [title, ...rest] = line.split('|')
      return { title: title.trim(), text: rest.join('|').trim() }
    }).filter((item) => item.title)
  }
  return String(text || '')
}

/** Тексты лендинга: значения из кода, поверх — непустые правки админа. */
export function mergeLandingCopy(base, overrides) {
  if (!isPlainObject(overrides)) return base
  const result = { ...base }
  for (const [key, value] of Object.entries(overrides)) {
    const field = LANDING_FIELDS.get(key)
    if (!field) continue
    if (field.type === 'lines' || field.type === 'pairs') {
      if (Array.isArray(value) && value.length > 0) result[key] = value
    } else if (typeof value === 'string' && value.trim()) {
      result[key] = value
    }
  }
  return result
}

/** Пункты шапки сайта. Ярлыки по умолчанию — из переводов nav.*. */
export const NAV_ITEMS = [
  { id: 'home', href: '/', labelKey: 'nav.home' },
  { id: 'treatments', href: '#specializations', labelKey: 'nav.treatments', isAnchor: true },
  { id: 'tourism', href: '/tourism', labelKey: 'nav.tourism' },
  { id: 'blog', href: '/blog', labelKey: 'nav.blog' },
  { id: 'process', href: '#process', labelKey: 'nav.process', isAnchor: true },
  { id: 'prices', href: '/prices', labelKey: 'nav.prices' },
  { id: 'contacts', href: '#contact', labelKey: 'nav.contacts', isAnchor: true },
]

export const DEFAULT_CONTACTS = Object.freeze({
  phone: '',
  email: 'support@nnmc.kz',
  website: 'https://www.nnmc.kz/',
  whatsapp: '',
  telegram: '',
  instagram: '',
  address: {},
  hours: {},
})

const localizedMap = (value) => {
  if (!isPlainObject(value)) return {}
  return Object.fromEntries(CONTENT_LANGS.map((lang) => [lang, str(value[lang])]).filter(([, text]) => text))
}

/** Сохранённый landingConfig → полный объект с безопасными значениями. */
export function readSiteContent(raw) {
  const stored = isPlainObject(raw) ? raw : {}
  const landing = isPlainObject(stored.landing) ? stored.landing : {}
  const contacts = isPlainObject(stored.contacts) ? stored.contacts : {}
  const navItems = isPlainObject(stored.navigation?.items) ? stored.navigation.items : {}
  const legal = isPlainObject(stored.legal) ? stored.legal : {}
  const seo = isPlainObject(stored.seo) ? stored.seo : {}

  return {
    siteTheme: isPlainObject(stored.siteTheme) ? stored.siteTheme : null,
    landing: Object.fromEntries(CONTENT_LANGS.map((lang) => [lang, isPlainObject(landing[lang]) ? landing[lang] : {}])),
    contacts: {
      ...DEFAULT_CONTACTS,
      ...Object.fromEntries(['phone', 'email', 'website', 'whatsapp', 'telegram', 'instagram']
        .filter((key) => typeof contacts[key] === 'string')
        .map((key) => [key, contacts[key]])),
      address: localizedMap(contacts.address),
      hours: localizedMap(contacts.hours),
    },
    navigation: {
      items: Object.fromEntries(NAV_ITEMS.map((item) => {
        const entry = isPlainObject(navItems[item.id]) ? navItems[item.id] : {}
        return [item.id, { visible: entry.visible !== false, label: localizedMap(entry.label) }]
      })),
    },
    legal: {
      privacy: localizedMap(legal.privacy),
      terms: localizedMap(legal.terms),
    },
    seo: Object.fromEntries(CONTENT_LANGS.map((lang) => [lang, {
      title: str(seo[lang]?.title),
      description: str(seo[lang]?.description),
    }])),
  }
}

/** Пустые строки и массивы не храним: «пусто» = «как в коде». */
export function compactSiteContent(content) {
  const landing = {}
  for (const lang of CONTENT_LANGS) {
    const entries = Object.entries(content.landing?.[lang] || {}).filter(([key, value]) => {
      if (!LANDING_FIELDS.has(key)) return false
      return Array.isArray(value) ? value.length > 0 : typeof value === 'string' && value.trim()
    })
    if (entries.length) landing[lang] = Object.fromEntries(entries)
  }
  const navigationItems = {}
  for (const item of NAV_ITEMS) {
    const entry = content.navigation?.items?.[item.id] || {}
    const label = localizedMap(entry.label)
    if (entry.visible === false || Object.keys(label).length) {
      navigationItems[item.id] = { visible: entry.visible !== false, label }
    }
  }
  const seo = {}
  for (const lang of CONTENT_LANGS) {
    const title = str(content.seo?.[lang]?.title).trim()
    const description = str(content.seo?.[lang]?.description).trim()
    if (title || description) seo[lang] = { title, description }
  }
  const contacts = content.contacts || DEFAULT_CONTACTS
  return {
    version: 2,
    siteTheme: content.siteTheme || null,
    landing,
    contacts: {
      phone: str(contacts.phone).trim(),
      email: str(contacts.email).trim(),
      website: str(contacts.website).trim(),
      whatsapp: str(contacts.whatsapp).trim(),
      telegram: str(contacts.telegram).trim(),
      instagram: str(contacts.instagram).trim(),
      address: localizedMap(contacts.address),
      hours: localizedMap(contacts.hours),
    },
    navigation: { items: navigationItems },
    legal: {
      privacy: localizedMap(content.legal?.privacy),
      terms: localizedMap(content.legal?.terms),
    },
    seo,
  }
}

/** Текст на языке посетителя → русский → пусто. */
export const pickLocalized = (map, lang) => str(map?.[lang]).trim() || str(map?.ru).trim()

// ── Правовые документы ────────────────────────────────────────────────────
// Разметка, которую админ пишет в текстовом поле:
//   ## Заголовок раздела
//   Обычная строка — абзац.
//   - строка с дефисом — пункт списка
// Разделы идут по порядку заголовков; текст до первого заголовка — вступление.

export function parseLegalText(text) {
  const sections = []
  let current = null
  const ensure = () => {
    if (!current) {
      current = { title: '', paragraphs: [], bullets: [] }
      sections.push(current)
    }
    return current
  }
  for (const rawLine of String(text || '').split('\n')) {
    const line = rawLine.trim()
    if (!line) continue
    if (line.startsWith('## ') || line.startsWith('# ')) {
      current = { title: line.replace(/^#+\s*/, ''), paragraphs: [], bullets: [] }
      sections.push(current)
    } else if (/^[-•*]\s+/.test(line)) {
      ensure().bullets.push(line.replace(/^[-•*]\s+/, ''))
    } else {
      ensure().paragraphs.push(line)
    }
  }
  return sections
}

export function legalSectionsToText(sections) {
  return (sections || []).map((section) => [
    section.title ? `## ${section.title}` : '',
    ...(section.paragraphs || []),
    ...(section.bullets || []).map((item) => `- ${item}`),
  ].filter(Boolean).join('\n')).join('\n\n')
}

/** Безопасная ссылка из контакта: только http(s), mailto, tel. */
export function contactHref(kind, value) {
  const text = str(value).trim()
  if (!text) return ''
  // Любая схема, кроме http(s) («javascript:», «data:»…), — не ссылка.
  if (/^[a-z][a-z0-9+.-]*:/i.test(text) && !/^https?:\/\//i.test(text) && !['phone', 'email', 'whatsapp'].includes(kind)) return ''
  if (kind === 'phone') return `tel:${text.replace(/[^\d+]/g, '')}`
  if (kind === 'email') return `mailto:${text}`
  if (kind === 'whatsapp') return `https://wa.me/${text.replace(/\D/g, '')}`
  if (kind === 'telegram') return /^https?:\/\//i.test(text) ? text : `https://t.me/${text.replace(/^@/, '')}`
  if (kind === 'instagram') return /^https?:\/\//i.test(text) ? text : `https://instagram.com/${text.replace(/^@/, '')}`
  return /^https?:\/\//i.test(text) ? text : `https://${text}`
}
