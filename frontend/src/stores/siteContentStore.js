import { create } from 'zustand'
import { contentAPI, normalizeResponse } from '../services/api'
import { readSiteContent } from '../config/siteContent'
import { applySiteTheme } from '../config/siteThemes'

/**
 * Контент сайта из Global (Admin > Контент сайта): тексты главной, контакты,
 * меню, правовые документы, SEO и цветовая схема. Загружается один раз на
 * открытие страницы; пока ответа нет — значения из кода.
 */
let request = null

const useSiteContentStore = create((set) => ({
  content: readSiteContent(null),
  global: null,
  isLoaded: false,

  load: (force = false) => {
    if (request && !force) return request
    request = contentAPI.getGlobal()
      .then((response) => normalizeResponse(response)?.data || null)
      .catch(() => null)
      .then((global) => {
        const content = readSiteContent(global?.landingConfig)
        applySiteTheme(content.siteTheme)
        set({ content, global, isLoaded: true })
        return global
      })
    return request
  },

  /** После сохранения в админке — без повторного запроса. */
  setFromGlobal: (global) => {
    const content = readSiteContent(global?.landingConfig)
    applySiteTheme(content.siteTheme)
    request = Promise.resolve(global)
    set({ content, global, isLoaded: true })
  },
}))

export default useSiteContentStore
