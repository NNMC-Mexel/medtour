/**
 * После `vite build`: копии dist/index.html со своими title, description,
 * canonical, hreflang и Open Graph для публичных страниц, плюс sitemap.xml.
 *
 * Поисковики и мессенджеры, которые не исполняют JavaScript, видели одинаковые
 * заголовок и описание на каждой странице. Теперь:
 *   - язык по умолчанию (en): dist/<path>/index.html — его отдаёт и Caddy,
 *     и `vite preview`;
 *   - ru/kk: dist/seo/<lang>/<path>/index.html — Caddy отдаёт их на ?lang=.
 * Врачи берутся из публичного API на момент сборки; если API недоступно,
 * их страницы остаются на общем index.html, а сборка не падает.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { TREATMENT_DEPARTMENTS } from '../src/data/treatmentDepartments.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIST = path.join(ROOT, 'dist')
const SITE_URL = (process.env.VITE_SITE_URL || 'https://medtour.nnmc.kz').replace(/\/+$/, '')
const API_URL = (process.env.VITE_API_URL || process.env.VITE_PRODUCTION_API_URL || 'https://medtourserver.nnmc.kz').replace(/\/+$/, '')
const LANGS = ['en', 'ru', 'kk']
const DEFAULT_LANG = 'en'
const OG_LOCALES = { en: 'en_US', ru: 'ru_RU', kk: 'kk_KZ' }

const locales = Object.fromEntries(LANGS.map((lang) => [
  lang,
  JSON.parse(fs.readFileSync(path.join(ROOT, 'src/i18n/locales', lang, 'translation.json'), 'utf8')).seo,
]))

const fill = (template, values = {}) =>
  String(template).replace(/\{\{(\w+)\}\}/g, (_, key) => values[key] ?? '')

const escapeHtml = (value) => String(value)
  .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const urlFor = (pagePath, lang) => {
  const url = `${SITE_URL}${pagePath}`
  return lang === DEFAULT_LANG ? url : `${url}?lang=${lang}`
}

const fetchDoctors = async () => {
  try {
    const query = 'filters[isActive][$eq]=true&populate[specialization]=true&pagination[limit]=500'
    const response = await fetch(`${API_URL}/api/doctors?${query}`, { signal: AbortSignal.timeout(10000) })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const body = await response.json()
    return Array.isArray(body?.data) ? body.data : []
  } catch (error) {
    console.warn(`[prerender-seo] doctors skipped (${API_URL}): ${error.message}`)
    return []
  }
}

const doctorName = (doctor, lang) => doctor?.i18n?.[lang]?.fullName || doctor?.fullName || ''
// Same fallbacks as getSpecName in src/utils/helpers.js.
const specializationName = (doctor, lang) => {
  const spec = doctor?.specialization
  if (!spec?.name) return ''
  if (lang === 'en') return spec.nameEn || spec.name
  if (lang === 'kk') return spec.nameKk || spec.name
  return spec.name
}

const buildPages = (doctors) => {
  const simple = [
    ['/', 'home'], ['/doctors', 'doctors'], ['/prices', 'prices'], ['/tourism', 'tourism'],
    ['/blog', 'blog'], ['/privacy', 'privacy'], ['/terms', 'terms'],
  ].map(([pagePath, key]) => ({
    path: pagePath,
    meta: (lang) => ({ title: locales[lang][`${key}_title`], description: locales[lang][`${key}_description`] }),
  }))

  const treatments = TREATMENT_DEPARTMENTS.map((department) => ({
    path: `/treatments/${department.slug}`,
    meta: (lang) => ({
      title: fill(locales[lang].treatment_title, { department: department.title?.[lang] || department.title?.ru }),
      description: fill(locales[lang].treatment_description, { short: department.short?.[lang] || department.short?.ru }),
    }),
  }))

  const doctorPages = doctors
    .filter((doctor) => doctor?.documentId && doctor.fullName)
    .map((doctor) => ({
      path: `/doctors/${doctor.documentId}`,
      meta: (lang) => {
        const values = { name: doctorName(doctor, lang), specialization: specializationName(doctor, lang) }
        return { title: fill(locales[lang].doctor_title, values), description: fill(locales[lang].doctor_description, values) }
      },
    }))

  return [...simple, ...treatments, ...doctorPages]
}

const renderHead = (template, page, lang) => {
  const { title, description } = page.meta(lang)
  const canonical = urlFor(page.path, lang)
  const alternates = [...LANGS, 'x-default']
    .map((hreflang) => `<link rel="alternate" hreflang="${hreflang}" href="${escapeHtml(urlFor(page.path, hreflang === 'x-default' ? DEFAULT_LANG : hreflang))}" />`)
    .join('\n    ')
  const replaceMeta = (html, attr, key, value) => html.replace(
    new RegExp(`(<meta ${attr}="${key}" content=")[^"]*(")`),
    `$1${escapeHtml(value)}$2`,
  )

  let html = template
    .replace(/<html lang="[^"]*">/, `<html lang="${lang}">`)
    .replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>`)
    .replace(/(<link rel="canonical" href=")[^"]*(" \/>)/, `$1${escapeHtml(canonical)}$2\n    ${alternates}`)
  html = replaceMeta(html, 'name', 'description', description)
  html = replaceMeta(html, 'property', 'og:title', title)
  html = replaceMeta(html, 'property', 'og:description', description)
  html = replaceMeta(html, 'property', 'og:url', canonical)
  html = replaceMeta(html, 'property', 'og:locale', OG_LOCALES[lang])
  html = replaceMeta(html, 'name', 'twitter:title', title)
  html = replaceMeta(html, 'name', 'twitter:description', description)
  return html
}

const writePage = (relativeDir, html) => {
  const dir = path.join(DIST, relativeDir)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'index.html'), html)
}

const buildSitemap = (pages) => {
  const entries = pages.map((page) => {
    const links = [...LANGS, 'x-default']
      .map((hreflang) => `    <xhtml:link rel="alternate" hreflang="${hreflang}" href="${escapeHtml(urlFor(page.path, hreflang === 'x-default' ? DEFAULT_LANG : hreflang))}"/>`)
      .join('\n')
    return `  <url>\n    <loc>${escapeHtml(urlFor(page.path, DEFAULT_LANG))}</loc>\n${links}\n  </url>`
  })
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${entries.join('\n')}\n</urlset>\n`
}

const template = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8')
const pages = buildPages(await fetchDoctors())
let written = 0
for (const page of pages) {
  for (const lang of LANGS) {
    const html = renderHead(template, page, lang)
    const pageDir = page.path === '/' ? '' : page.path.slice(1)
    if (lang === DEFAULT_LANG) {
      // dist/index.html — общий вход SPA для всех маршрутов; его не трогаем,
      // теги по умолчанию в нём и так от главной.
      if (pageDir) writePage(pageDir, html)
    } else {
      writePage(path.join('seo', lang, pageDir), html)
    }
    written++
  }
}
fs.writeFileSync(path.join(DIST, 'sitemap.xml'), buildSitemap(pages))
console.log(`[prerender-seo] ${pages.length} pages × ${LANGS.length} languages (${written} heads), sitemap.xml`)
