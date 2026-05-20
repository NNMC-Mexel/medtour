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
      order: ['localStorage'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },
  })

export const LANGUAGES = [
  { code: 'en', label: 'Eng', fullLabel: 'English' },
  { code: 'ru', label: 'Рус', fullLabel: 'Русский' },
  { code: 'kk', label: 'Қаз', fullLabel: 'Қазақша' },
]

export default i18n
