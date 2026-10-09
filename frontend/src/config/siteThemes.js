// Цветовые схемы сайта (Admin > Контент сайта > Оформление).
//
// Лендинг и публичные страницы красятся токенами --color-mt-* (index.css),
// кабинеты — шкалой Tailwind teal-*. Схема задаёт и то и другое; фирменная
// схема MedTour ничего не переопределяет — остаются значения из index.css.

const SHADES = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950']

export const SITE_THEME_PALETTES = Object.freeze([
  Object.freeze({
    id: 'medtour',
    label: { ru: 'Фирменная MedTour', en: 'MedTour signature', kk: 'MedTour фирмалық' },
    note: {
      ru: 'Бирюзовые акценты на глубоком синем — текущий вид сайта.',
      en: 'Teal accents on deep navy — the current look of the site.',
      kk: 'Терең көк фондағы көгілдір акценттер — сайттың қазіргі көрінісі.',
    },
    tokens: Object.freeze({
      night: '#07132f', ink: '#111d3f', 'ink-soft': '#13254d', accent: '#0a9a87', 'accent-strong': '#087f72',
      glow: '#42d1b1', 'glow-soft': '#b8f3e9', mint: '#e8f7f4', blue: '#3157d5', coral: '#ff6b55',
    }),
  }),
  Object.freeze({
    id: 'electric',
    label: { ru: 'Электрический синий', en: 'Electric blue', kk: 'Электр көк' },
    note: {
      ru: 'Тёмный navy и яркий цифровой синий с бирюзовыми бликами.',
      en: 'Dark navy with a bright digital blue and cyan highlights.',
      kk: 'Қою navy және жарқын цифрлық көк, көгілдір жарқылдармен.',
    },
    tokens: Object.freeze({
      night: '#04112e', ink: '#0b1f4d', 'ink-soft': '#163b78', accent: '#1663e0', 'accent-strong': '#0b4fb8',
      glow: '#5cc8ff', 'glow-soft': '#c4e9ff', mint: '#eaf3ff', blue: '#0891b2', coral: '#ff6b55',
    }),
  }),
  Object.freeze({
    id: 'navy-gold',
    label: { ru: 'Синий и золото', en: 'Navy and gold', kk: 'Көк және алтын' },
    note: {
      ru: 'Глубокий синий ННМЦ, золотые акценты и холодные светлые фоны.',
      en: 'Deep NNMC navy, gold accents and cool light surfaces.',
      kk: 'ҰҒМО терең көгі, алтын акценттер және салқын ашық фондар.',
    },
    tokens: Object.freeze({
      night: '#031a36', ink: '#0d2a52', 'ink-soft': '#173f70', accent: '#9a6200', 'accent-strong': '#7d4e00',
      glow: '#f7c744', 'glow-soft': '#ffe68a', mint: '#fff8e1', blue: '#175a9a', coral: '#dca51e',
    }),
  }),
  Object.freeze({
    id: 'lavender',
    label: { ru: 'Лаванда', en: 'Lavender', kk: 'Лаванда' },
    note: {
      ru: 'Фиолетовые акценты на тёмном сливовом фоне, мягкие светлые поверхности.',
      en: 'Violet accents on dark plum with soft light surfaces.',
      kk: 'Қою қара өрік фонындағы күлгін акценттер және жұмсақ ашық беттер.',
    },
    tokens: Object.freeze({
      night: '#160a28', ink: '#2d1b4c', 'ink-soft': '#4e3376', accent: '#7c3aed', 'accent-strong': '#6d28d9',
      glow: '#c4b5fd', 'glow-soft': '#ede9fe', mint: '#f5f3ff', blue: '#0891b2', coral: '#ec4899',
    }),
  }),
  Object.freeze({
    id: 'emerald',
    label: { ru: 'Изумруд', en: 'Emerald', kk: 'Зүбәржат' },
    note: {
      ru: 'Насыщенный зелёный с тёплыми янтарными акцентами.',
      en: 'Rich green with warm amber accents.',
      kk: 'Қанық жасыл және жылы кәріптас акценттері.',
    },
    tokens: Object.freeze({
      night: '#022c22', ink: '#093a2a', 'ink-soft': '#175f46', accent: '#047857', 'accent-strong': '#065f46',
      glow: '#34d399', 'glow-soft': '#a7f3d0', mint: '#ecfdf5', blue: '#d97706', coral: '#f59e0b',
    }),
  }),
])

export const DEFAULT_SITE_THEME = Object.freeze({ paletteId: 'medtour', accentColor: '' })

// Сохранённые переменные: main.jsx красит страницу ими ещё до ответа сервера,
// чтобы при выбранной не-фирменной схеме не мелькал бирюзовый.
export const SITE_THEME_STORAGE_KEY = 'medtour-site-theme'

const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i
export const isValidHexColor = (value) => HEX_COLOR_PATTERN.test(String(value || '').trim())

export const getSiteThemePalette = (paletteId) =>
  SITE_THEME_PALETTES.find((palette) => palette.id === paletteId) || SITE_THEME_PALETTES[0]

export function normalizeSiteTheme(value) {
  const palette = getSiteThemePalette(value?.paletteId)
  const accentColor = isValidHexColor(value?.accentColor) ? value.accentColor.trim().toLowerCase() : ''
  return { paletteId: palette.id, accentColor }
}

const hexToRgb = (hex) => {
  const value = Number.parseInt(hex.slice(1), 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}
const rgbToHex = (channels) => `#${channels.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`
const mix = (base, target, weight) => {
  const a = hexToRgb(base)
  const b = hexToRgb(target)
  return rgbToHex(a.map((channel, index) => channel + (b[index] - channel) * weight))
}
const luminance = (hex) => {
  const [r, g, b] = hexToRgb(hex).map((channel) => {
    const value = channel / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

// Белый текст на кнопке должен читаться: темним акцент, пока контраст < 4.5.
function buttonSafe(accent) {
  let result = accent
  for (let weight = 0.04; 1.05 / (luminance(result) + 0.05) < 4.5 && weight < 0.72; weight += 0.04) {
    result = mix(accent, '#000000', weight)
  }
  return result
}

/** Шкала teal-50…950 для кабинетов из одного цвета. */
export function createAccentRamp(accent) {
  const safe = buttonSafe(accent)
  return {
    50: mix(accent, '#ffffff', 0.94),
    100: mix(accent, '#ffffff', 0.86),
    200: mix(accent, '#ffffff', 0.72),
    300: mix(accent, '#ffffff', 0.52),
    400: mix(accent, '#ffffff', 0.3),
    500: mix(accent, safe, 0.45),
    600: safe,
    700: mix(safe, '#000000', 0.16),
    800: mix(safe, '#000000', 0.32),
    900: mix(safe, '#000000', 0.48),
    950: mix(safe, '#000000', 0.66),
  }
}

/** CSS-переменные схемы; пустой объект — фирменная схема без изменений. */
export function getSiteThemeVariables(value) {
  const theme = normalizeSiteTheme(value)
  const palette = getSiteThemePalette(theme.paletteId)
  const isDefault = palette.id === DEFAULT_SITE_THEME.paletteId && !theme.accentColor
  if (isDefault) return {}

  const tokens = { ...palette.tokens }
  if (theme.accentColor) {
    tokens.accent = theme.accentColor
    tokens['accent-strong'] = mix(theme.accentColor, '#000000', 0.18)
    tokens.glow = mix(theme.accentColor, '#ffffff', 0.35)
    tokens['glow-soft'] = mix(theme.accentColor, '#ffffff', 0.72)
    tokens.mint = mix(theme.accentColor, '#ffffff', 0.9)
  }

  const variables = {}
  Object.entries(tokens).forEach(([name, color]) => { variables[`--color-mt-${name}`] = color })
  const ramp = createAccentRamp(tokens.accent)
  SHADES.forEach((shade) => { variables[`--color-teal-${shade}`] = ramp[shade] })
  return variables
}

const ALL_VARIABLES = [
  ...Object.keys(SITE_THEME_PALETTES[0].tokens).map((name) => `--color-mt-${name}`),
  ...SHADES.map((shade) => `--color-teal-${shade}`),
]

/**
 * Применяет схему к странице. persist: false — предпросмотр в админке, который
 * не должен стать схемой этого браузера до сохранения.
 */
export function applySiteTheme(value, { persist = true } = {}) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const variables = getSiteThemeVariables(value)
  ALL_VARIABLES.forEach((name) => root.style.removeProperty(name))
  Object.entries(variables).forEach(([name, color]) => root.style.setProperty(name, color))
  if (!persist) return
  try {
    if (Object.keys(variables).length === 0) window.localStorage.removeItem(SITE_THEME_STORAGE_KEY)
    else window.localStorage.setItem(SITE_THEME_STORAGE_KEY, JSON.stringify(variables))
  } catch {
    // приватный режим — схема применится после ответа сервера
  }
}

/** Схема прошлого визита — до первого рендера, без запроса к серверу. */
export function applyStoredSiteTheme() {
  if (typeof document === 'undefined') return
  try {
    const stored = JSON.parse(window.localStorage.getItem(SITE_THEME_STORAGE_KEY) || 'null')
    if (!stored || typeof stored !== 'object') return
    Object.entries(stored).forEach(([name, color]) => {
      if (name.startsWith('--color-') && isValidHexColor(color)) document.documentElement.style.setProperty(name, color)
    })
  } catch {
    // нет доступа к хранилищу — красим после ответа сервера
  }
}
