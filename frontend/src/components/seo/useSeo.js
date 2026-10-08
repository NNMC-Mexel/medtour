import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { OG_IMAGE_PATH, SEO_DEFAULT_LANG, SEO_LANGS, SITE_URL } from '../../config/seo'

/**
 * Заголовок, описание, canonical, hreflang и Open Graph страницы.
 *
 * index.html несёт теги по умолчанию (их видят поисковики без JavaScript, а
 * scripts/prerender-seo.mjs пишет для публичных страниц копии со своими
 * тегами). Хук обновляет те же элементы, а не добавляет новые, поэтому
 * дублей не бывает; при уходе со страницы возвращает значения по умолчанию.
 */
const META = [
  ['name', 'description'],
  ['name', 'robots'],
  ['property', 'og:title'],
  ['property', 'og:description'],
  ['property', 'og:url'],
  ['property', 'og:image'],
  ['property', 'og:locale'],
  ['name', 'twitter:title'],
  ['name', 'twitter:description'],
]

const OG_LOCALES = { en: 'en_US', ru: 'ru_RU', kk: 'kk_KZ' }

const ensureMeta = (attr, key) => {
  let element = document.head.querySelector(`meta[${attr}="${key}"]`)
  if (!element) {
    element = document.createElement('meta')
    element.setAttribute(attr, key)
    document.head.appendChild(element)
  }
  return element
}

const ensureLink = (selector, attrs) => {
  let element = document.head.querySelector(selector)
  if (!element) {
    element = document.createElement('link')
    Object.entries(attrs).forEach(([name, value]) => element.setAttribute(name, value))
    document.head.appendChild(element)
  }
  return element
}

const urlFor = (path, lang) => {
  const url = `${SITE_URL}${path === '/' ? '/' : path}`
  return lang && lang !== SEO_DEFAULT_LANG ? `${url}?lang=${lang}` : url
}

export default function useSeo({ title, description, path, noindex = false }) {
  const { i18n } = useTranslation()
  const lang = SEO_LANGS.includes(i18n.language) ? i18n.language : SEO_DEFAULT_LANG

  useEffect(() => {
    if (typeof document === 'undefined' || !title) return undefined

    const previous = {
      title: document.title,
      meta: META.map(([attr, key]) => [attr, key, document.head.querySelector(`meta[${attr}="${key}"]`)?.getAttribute('content') ?? null]),
      canonical: document.head.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? null,
    }

    const canonicalUrl = path ? urlFor(path, lang) : null
    const values = {
      description,
      robots: noindex ? 'noindex, nofollow' : 'index, follow',
      'og:title': title,
      'og:description': description,
      'og:url': canonicalUrl,
      'og:image': `${SITE_URL}${OG_IMAGE_PATH}`,
      'og:locale': OG_LOCALES[lang],
      'twitter:title': title,
      'twitter:description': description,
    }

    document.title = title
    META.forEach(([attr, key]) => {
      const value = values[key]
      if (value) ensureMeta(attr, key).setAttribute('content', value)
    })

    // Страницу без индекса не связываем canonical с другими адресами.
    const alternates = []
    if (canonicalUrl && !noindex) {
      ensureLink('link[rel="canonical"]', { rel: 'canonical' }).setAttribute('href', canonicalUrl)
      document.head.querySelectorAll('link[rel="alternate"][hreflang]').forEach((node) => node.remove())
      for (const hreflang of [...SEO_LANGS, 'x-default']) {
        const link = document.createElement('link')
        link.setAttribute('rel', 'alternate')
        link.setAttribute('hreflang', hreflang)
        link.setAttribute('href', urlFor(path, hreflang === 'x-default' ? SEO_DEFAULT_LANG : hreflang))
        document.head.appendChild(link)
        alternates.push(link)
      }
    } else {
      document.head.querySelector('link[rel="canonical"]')?.remove()
    }

    return () => {
      document.title = previous.title
      previous.meta.forEach(([attr, key, value]) => {
        const element = document.head.querySelector(`meta[${attr}="${key}"]`)
        if (!element) return
        if (value === null) element.remove()
        else element.setAttribute('content', value)
      })
      alternates.forEach((node) => node.remove())
      if (previous.canonical) ensureLink('link[rel="canonical"]', { rel: 'canonical' }).setAttribute('href', previous.canonical)
      else document.head.querySelector('link[rel="canonical"]')?.remove()
    }
  }, [title, description, path, noindex, lang])
}
