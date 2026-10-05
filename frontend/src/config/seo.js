// Публичный адрес сайта для canonical, hreflang и Open Graph.
export const SITE_URL = (import.meta.env.VITE_SITE_URL || 'https://medtour.nnmc.kz').replace(/\/+$/, '')
export const OG_IMAGE_PATH = '/og-image.jpg'
// Язык по умолчанию (без ?lang) — английский: так открывается сайт у нового посетителя.
export const SEO_DEFAULT_LANG = 'en'
export const SEO_LANGS = ['en', 'ru', 'kk']
