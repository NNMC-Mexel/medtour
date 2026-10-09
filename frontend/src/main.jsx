import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './i18n'
import App from './App'
import { applyStoredSiteTheme } from './config/siteThemes'
import useSiteContentStore from './stores/siteContentStore'

// Цветовая схема из админки: сначала сохранённая в браузере (без мигания),
// затем актуальная с сервера.
applyStoredSiteTheme()
useSiteContentStore.getState().load()

// Две разные высоты. --app-height — высота раскладки: по ней строятся меню,
// лэйауты и модалки, и клавиатура её не трогает (в CSS это 100dvh). Раньше
// она бралась из visualViewport, то есть сжималась под клавиатуру, а iOS
// после закрытия клавиатуры не всегда присылает resize — меню оставалось
// сжатым до половины экрана. --vv-height/--vv-top — видимая область над
// клавиатурой: по ним к клавиатуре прижимается поле ввода в чате.
const supportsDynamicViewport =
  typeof CSS !== 'undefined' && CSS.supports?.('height', '100dvh')

const isEditable = (el) =>
  Boolean(el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)))

const updateViewportVars = () => {
  if (typeof window === 'undefined') return
  const root = document.documentElement
  const vv = window.visualViewport
  const visibleHeight = vv?.height || window.innerHeight
  if (!supportsDynamicViewport) {
    root.style.setProperty('--app-height', `${Math.round(window.innerHeight)}px`)
  }
  root.style.setProperty('--vv-height', `${Math.round(visibleHeight)}px`)
  root.style.setProperty('--vv-top', `${Math.round(vv?.offsetTop || 0)}px`)
  // Клавиатура открыта, если видимая область заметно ниже окна и фокус в поле.
  const keyboardOpen = window.innerHeight - visibleHeight > 120 && isEditable(document.activeElement)
  root.toggleAttribute('data-keyboard-open', keyboardOpen)
}

// iOS после закрытия клавиатуры иногда оставляет видимую область сдвинутой
// и не шлёт resize. Перечитываем размеры, когда анимация закончилась.
const settleAfterKeyboard = () => {
  window.setTimeout(() => {
    if (isEditable(document.activeElement)) return
    updateViewportVars()
    if ((window.visualViewport?.offsetTop || 0) > 0) {
      window.scrollTo(window.scrollX, window.scrollY)
      updateViewportVars()
    }
  }, 350)
}

if (typeof window !== 'undefined' && !window.__telemedViewportBound) {
  window.__telemedViewportBound = true
  updateViewportVars()
  window.addEventListener('resize', updateViewportVars, { passive: true })
  window.addEventListener('orientationchange', updateViewportVars, { passive: true })
  window.visualViewport?.addEventListener('resize', updateViewportVars, { passive: true })
  window.visualViewport?.addEventListener('scroll', updateViewportVars, { passive: true })
  document.addEventListener('focusin', updateViewportVars, { passive: true })
  document.addEventListener('focusout', settleAfterKeyboard, { passive: true })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
