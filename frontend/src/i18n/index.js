import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import ru from './locales/ru/translation.json'
import kk from './locales/kk/translation.json'
import en from './locales/en/translation.json'

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      ru: { translation: ru },
      kk: { translation: kk },
      en: { translation: en },
    },
    fallbackLng: 'en',
    supportedLngs: ['ru', 'kk', 'en'],
    load: 'languageOnly',
    interpolation: { escapeValue: false },
    detection: {
      // ?lang=ru|kk|en открывает нужный язык (ссылки hreflang и из поиска) и
      // запоминается; без параметра — сохранённый выбор.
      order: ['querystring', 'localStorage'],
      lookupQuerystring: 'lang',
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },
  })

// <html lang> следует за языком интерфейса: скринридеры и поисковики читают его.
const syncHtmlLang = (lng) => {
  if (typeof document !== 'undefined' && lng) document.documentElement.lang = lng.split('-')[0]
}
syncHtmlLang(i18n.language)
i18n.on('languageChanged', syncHtmlLang)

export const LANGUAGES = [
  { code: 'en', label: 'Eng', fullLabel: 'English' },
  { code: 'ru', label: 'Рус', fullLabel: 'Русский' },
  { code: 'kk', label: 'Қаз', fullLabel: 'Қазақша' },
]

export default i18n
