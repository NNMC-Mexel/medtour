import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import useAuthStore from '../../stores/authStore'
import { trackPageview } from '../../services/analytics'

/**
 * Отправляет просмотр страницы при каждой смене пути. Ждёт восстановления
 * сессии из localStorage, иначе вошедший пациент на первой странице
 * засчитывался бы гостем.
 */
export default function RouteAnalytics() {
  const { pathname } = useLocation()
  const hasHydrated = useAuthStore((state) => state._hasHydrated)

  useEffect(() => {
    if (hasHydrated) trackPageview(pathname)
  }, [pathname, hasHydrated])

  return null
}
