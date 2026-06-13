export const COUNTRY_CODES = [
  'AD', 'AE', 'AF', 'AG', 'AI', 'AL', 'AM', 'AO', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AW', 'AX', 'AZ',
  'BA', 'BB', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI', 'BJ', 'BL', 'BM', 'BN', 'BO', 'BQ', 'BR', 'BS',
  'BT', 'BV', 'BW', 'BY', 'BZ', 'CA', 'CC', 'CD', 'CF', 'CG', 'CH', 'CI', 'CK', 'CL', 'CM', 'CN',
  'CO', 'CR', 'CU', 'CV', 'CW', 'CX', 'CY', 'CZ', 'DE', 'DJ', 'DK', 'DM', 'DO', 'DZ', 'EC', 'EE',
  'EG', 'EH', 'ER', 'ES', 'ET', 'FI', 'FJ', 'FK', 'FM', 'FO', 'FR', 'GA', 'GB', 'GD', 'GE', 'GF',
  'GG', 'GH', 'GI', 'GL', 'GM', 'GN', 'GP', 'GQ', 'GR', 'GS', 'GT', 'GU', 'GW', 'GY', 'HK', 'HM',
  'HN', 'HR', 'HT', 'HU', 'ID', 'IE', 'IL', 'IM', 'IN', 'IO', 'IQ', 'IR', 'IS', 'IT', 'JE', 'JM',
  'JO', 'JP', 'KE', 'KG', 'KH', 'KI', 'KM', 'KN', 'KP', 'KR', 'KW', 'KY', 'KZ', 'LA', 'LB', 'LC',
  'LI', 'LK', 'LR', 'LS', 'LT', 'LU', 'LV', 'LY', 'MA', 'MC', 'MD', 'ME', 'MF', 'MG', 'MH', 'MK',
  'ML', 'MM', 'MN', 'MO', 'MP', 'MQ', 'MR', 'MS', 'MT', 'MU', 'MV', 'MW', 'MX', 'MY', 'MZ', 'NA',
  'NC', 'NE', 'NF', 'NG', 'NI', 'NL', 'NO', 'NP', 'NR', 'NU', 'NZ', 'OM', 'PA', 'PE', 'PF', 'PG',
  'PH', 'PK', 'PL', 'PM', 'PN', 'PR', 'PS', 'PT', 'PW', 'PY', 'QA', 'RE', 'RO', 'RS', 'RU', 'RW',
  'SA', 'SB', 'SC', 'SD', 'SE', 'SG', 'SH', 'SI', 'SJ', 'SK', 'SL', 'SM', 'SN', 'SO', 'SR', 'SS',
  'ST', 'SV', 'SX', 'SY', 'SZ', 'TC', 'TD', 'TF', 'TG', 'TH', 'TJ', 'TK', 'TL', 'TM', 'TN', 'TO',
  'TR', 'TT', 'TV', 'TW', 'TZ', 'UA', 'UG', 'UM', 'US', 'UY', 'UZ', 'VA', 'VC', 'VE', 'VG', 'VI',
  'VN', 'VU', 'WF', 'WS', 'XK', 'YE', 'YT', 'ZA', 'ZM', 'ZW',
]

const COUNTRY_CODE_SET = new Set(COUNTRY_CODES)
const supportedLocales = ['en', 'ru', 'kk']
const displayNamesCache = new Map()
const optionsCache = new Map()

const countryAliases = new Map([
  ['kaz', 'KZ'],
  ['kz', 'KZ'],
  ['kazakhstan', 'KZ'],
  ['казахстан', 'KZ'],
  ['қазақстан', 'KZ'],
  ['uk', 'GB'],
  ['united kingdom', 'GB'],
  ['great britain', 'GB'],
  ['великобритания', 'GB'],
  ['ұлыбритания', 'GB'],
  ['usa', 'US'],
  ['us', 'US'],
  ['united states', 'US'],
  ['сша', 'US'],
  ['ақш', 'US'],
  ['uae', 'AE'],
  ['u.a.e.', 'AE'],
  ['оаэ', 'AE'],
  ['баә', 'AE'],
])

export function foldCountryText(value) {
  return String(value || '')
    .trim()
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
}

function getDisplayNames(locale) {
  const language = String(locale || 'en').split('-')[0] || 'en'
  if (displayNamesCache.has(language)) return displayNamesCache.get(language)

  let displayNames = null
  try {
    displayNames = new Intl.DisplayNames([language], { type: 'region' })
  } catch {
    displayNames = new Intl.DisplayNames(['en'], { type: 'region' })
  }

  displayNamesCache.set(language, displayNames)
  return displayNames
}

export function getCountryName(code, locale = 'en') {
  const normalizedCode = String(code || '').trim().toUpperCase()
  if (!COUNTRY_CODE_SET.has(normalizedCode)) return ''
  return getDisplayNames(locale).of(normalizedCode) || normalizedCode
}

export function getCountryOptions(locale = 'en') {
  const language = String(locale || 'en').split('-')[0] || 'en'
  if (optionsCache.has(language)) return optionsCache.get(language)

  const options = COUNTRY_CODES
    .map((code) => ({ value: code, label: getCountryName(code, language) || code }))
    .sort((a, b) => a.label.localeCompare(b.label, language, { sensitivity: 'base' }))

  optionsCache.set(language, options)
  return options
}

export function normalizeCountryValue(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''

  const upper = raw.toUpperCase()
  if (COUNTRY_CODE_SET.has(upper)) return upper

  const folded = foldCountryText(raw)
  if (countryAliases.has(folded)) return countryAliases.get(folded)

  for (const locale of supportedLocales) {
    for (const code of COUNTRY_CODES) {
      if (foldCountryText(getCountryName(code, locale)) === folded) return code
    }
  }

  return raw
}
