export const currencySymbols = {
  KZT: '₸',
  USD: '$',
  EUR: '€',
  RUB: '₽',
}

export const priceListFallbackItems = [
  {
    title: 'Первичный разбор медицинских документов',
    category: 'Консультации',
    description: 'Координатор проверяет документы и направляет заявку в подходящую клинику.',
    price: 15000,
    currency: 'KZT',
    unit: 'заявка',
    badge: 'Старт',
    note: 'Финальная стоимость лечения рассчитывается клиникой после review.',
    sortOrder: 1,
    isActive: true,
    isFeatured: true,
  },
  {
    title: 'Онлайн-консультация профильного врача',
    category: 'Консультации',
    description: 'Видео-консультация с врачом партнерской клиники по вашему направлению.',
    price: 30000,
    currency: 'KZT',
    unit: 'консультация',
    badge: 'Популярно',
    note: 'Длительность до 30 минут.',
    sortOrder: 2,
    isActive: true,
    isFeatured: true,
  },
  {
    title: 'Пакет сопровождения поездки',
    category: 'Сервис',
    description: 'Помощь с визой, отелем, трансфером, расписанием визитов и коммуникацией с клиникой.',
    price: 120000,
    currency: 'KZT',
    unit: 'поездка',
    badge: 'Под ключ',
    note: 'Билеты, проживание и лечение оплачиваются отдельно.',
    sortOrder: 3,
    isActive: true,
    isFeatured: true,
  },
]

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
