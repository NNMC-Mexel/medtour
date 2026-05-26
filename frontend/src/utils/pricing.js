export const currencySymbols = {
  KZT: '₸',
  USD: '$',
  EUR: '€',
  RUB: '₽',
}

export function formatPrice(value, currency = 'KZT') {
  const amount = Number(value) || 0
  const symbol = currencySymbols[currency] || currency || ''
  const formatted = new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount)

  return currency === 'KZT' || currency === 'RUB'
    ? `${formatted} ${symbol}`.trim()
    : `${symbol}${formatted}`.trim()
}
