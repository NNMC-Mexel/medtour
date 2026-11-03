// Статьи блога: рубрики и подготовка статьи с сервера к показу на языке
// посетителя. Статьи правятся в Admin > Блог / Статьи; текст статьи — разметкой
// правовых документов (config/legalMarkup.js).

import { pickLocalized } from './siteContent.js'

// Порядок совпадает с enum в server/src/api/blog-post/content-types/blog-post/schema.json.
export const BLOG_CATEGORIES = [
  { id: 'preparation', label: { ru: 'Подготовка', en: 'Preparation', kk: 'Дайындық' } },
  { id: 'treatment', label: { ru: 'Лечение', en: 'Treatment', kk: 'Емдеу' } },
  { id: 'astana', label: { ru: 'Астана', en: 'Astana', kk: 'Астана' } },
  { id: 'recovery', label: { ru: 'Восстановление', en: 'Recovery', kk: 'Оңалу' } },
  { id: 'routes', label: { ru: 'Маршруты', en: 'Routes', kk: 'Бағыттар' } },
  { id: 'planning', label: { ru: 'Организация', en: 'Planning', kk: 'Ұйымдастыру' } },
]

export const ALL_CATEGORIES_LABEL = { ru: 'Все', en: 'All', kk: 'Барлығы' }

export const categoryLabel = (id, lang) => {
  const category = BLOG_CATEGORIES.find((item) => item.id === id)
  return category ? category.label[lang] || category.label.ru : ''
}

const RU_MINUTES = { one: 'минута', few: 'минуты', many: 'минут', other: 'минуты' }

/** 6 → «6 минут» / «6 min»; пусто — если время чтения не указано. */
export function readTimeLabel(minutes, lang) {
  const value = Number(minutes)
  if (!Number.isInteger(value) || value < 1) return ''
  if (lang === 'en') return `${value} min`
  if (lang === 'kk') return `${value} минут`
  return `${value} ${RU_MINUTES[new Intl.PluralRules('ru-RU').select(value)]}`
}

/**
 * Статья с сервера → поля на языке посетителя (пустой язык → русский).
 * resolveMedia превращает загруженную обложку в URL (services/api getMediaUrl);
 * coverUrl — путь к картинке сайта или внешняя ссылка, используется как есть.
 */
export function localizePost(post, lang, resolveMedia = (media) => media?.url || '') {
  return {
    ...post,
    title: pickLocalized(post.title, lang),
    excerpt: pickLocalized(post.excerpt, lang),
    content: pickLocalized(post.content, lang),
    image: (post.cover && resolveMedia(post.cover)) || post.coverUrl || '',
    categoryLabel: categoryLabel(post.category, lang),
    read: readTimeLabel(post.readTime, lang),
  }
}

/** Большая карточка вверху блога: отмеченная админом, иначе первая по порядку. */
export const pickFeatured = (posts) => posts.find((post) => post.isFeatured) || posts[0] || null
