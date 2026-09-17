import { useEffect, useState } from 'react'
import { priceItemsAPI } from '../services/api'
import { formatPrice } from '../utils/pricing'

let cachedRate = null
let cachedUntil = 0
let pending = null

export function useUsdRate() {
  const [rate, setRate] = useState(Date.now() < cachedUntil ? cachedRate : null)
  useEffect(() => {
    if (cachedRate && Date.now() < cachedUntil) return
    let alive = true
    pending ||= priceItemsAPI.publicExchangeRate().then((response) => {
      cachedRate = Number(response.data?.data?.kztPerUsd) || null
      cachedUntil = Date.now() + 30 * 60 * 1000
      return cachedRate
    }).finally(() => { pending = null })
    pending.then((value) => { if (alive) setRate(value) }).catch(() => { if (alive) setRate(null) })
    return () => { alive = false }
  }, [])
  return rate
}

export function formatKztAsUsd(amount, rate) {
  if (!rate || !Number.isFinite(Number(amount))) return '—'
  return `≈${formatPrice(Number(amount) / rate, 'USD')}`
}
