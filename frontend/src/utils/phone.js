import {
  AsYouType,
  getCountryCallingCode,
  getExampleNumber,
  isValidPhoneNumber,
} from 'libphonenumber-js'
import examples from 'libphonenumber-js/mobile/examples'
import { normalizeCountryValue } from './countries.js'

const fallbackNationalDigits = 12

function getSafeCountryCode(country) {
  const normalized = normalizeCountryValue(country)
  if (!/^[A-Z]{2}$/.test(normalized)) return ''

  try {
    getCountryCallingCode(normalized)
    return normalized
  } catch {
    return ''
  }
}

export function getPhoneRule(country) {
  const countryCode = getSafeCountryCode(country)
  if (!countryCode) return null

  const callingCode = getCountryCallingCode(countryCode)
  const example = getExampleNumber(countryCode, examples)
  const nationalDigits = example?.nationalNumber?.length || Math.max(1, 15 - callingCode.length, fallbackNationalDigits)
  const internationalExample = example?.formatInternational() || `+${callingCode} ${'_'.repeat(nationalDigits)}`

  return {
    countryCode,
    callingCode,
    nationalDigits,
    template: toPhoneTemplate(internationalExample, callingCode),
    emptyValue: `+${callingCode} `,
  }
}

export function formatPhoneForCountry(value, country) {
  const rule = getPhoneRule(country)
  if (!rule) return String(value || '').replace(/[^\d+ ]/g, '')

  const rawValue = String(value || '').trim()
  const rawDigits = rawValue.replace(/\D/g, '')
  const nationalDigits = rawValue.startsWith('+') && rawDigits.startsWith(rule.callingCode)
    ? rawDigits.slice(rule.callingCode.length)
    : rawDigits
  const limitedNationalDigits = nationalDigits.slice(0, rule.nationalDigits)

  if (!limitedNationalDigits) return rule.emptyValue

  return new AsYouType(rule.countryCode).input(`+${rule.callingCode}${limitedNationalDigits}`)
}

export function isValidPhoneForCountry(value, country) {
  const rule = getPhoneRule(country)
  if (!rule) return false

  const nationalDigits = getNationalDigits(value, rule)
  if (nationalDigits.length !== rule.nationalDigits) return false

  return isValidPhoneNumber(value, rule.countryCode)
}

function getNationalDigits(value, rule) {
  const rawValue = String(value || '').trim()
  const rawDigits = rawValue.replace(/\D/g, '')
  return rawValue.startsWith('+') && rawDigits.startsWith(rule.callingCode)
    ? rawDigits.slice(rule.callingCode.length)
    : rawDigits
}

function toPhoneTemplate(value, callingCode) {
  let countryDigitsLeft = callingCode.length

  return String(value || '')
    .split('')
    .map((char) => {
      if (!/\d/.test(char)) return char
      if (countryDigitsLeft > 0) {
        countryDigitsLeft -= 1
        return char
      }
      return '_'
    })
    .join('')
}
