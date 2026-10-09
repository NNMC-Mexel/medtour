import { useEffect, useState } from 'react'

/**
 * Какая из секций сейчас «под шапкой». Секция активна, когда её верх прошёл
 * линию на `offsetRatio` высоты окна; в самом низу страницы активна последняя
 * (короткий блок контактов иначе никогда не дошёл бы до линии).
 * Возвращает id секции или '' — выше первой.
 */
export default function useScrollSpy(ids, { enabled = true, offsetRatio = 0.35 } = {}) {
  const [activeId, setActiveId] = useState('')
  const key = ids.join('|')

  useEffect(() => {
    if (!enabled) return undefined
    const sectionIds = key ? key.split('|') : []
    let frame = 0

    const update = () => {
      frame = 0
      const line = window.innerHeight * offsetRatio
      let current = ''
      for (const id of sectionIds) {
        const element = document.getElementById(id)
        if (element && element.getBoundingClientRect().top <= line) current = id
      }
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4
      if (atBottom && sectionIds.length && document.getElementById(sectionIds.at(-1))) current = sectionIds.at(-1)
      setActiveId(current)
    }
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update)
    }

    schedule()
    // Секции лендинга догружаются (врачи, отделения) — пересчитываем позиции.
    const settle = window.setTimeout(update, 600)
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      window.clearTimeout(settle)
      if (frame) window.cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [enabled, key, offsetRatio])

  return enabled ? activeId : ''
}
