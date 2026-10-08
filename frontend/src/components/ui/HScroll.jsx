import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { cn } from '../../utils/helpers'

// Пустая полоса шириной с содержимым: браузер рисует у неё обычный скроллбар,
// который двигает таблицу.
function ScrollBar({ ref, width, onScroll, className }) {
  return (
    <div
      ref={ref}
      onScroll={onScroll}
      aria-hidden='true'
      className={cn('hscroll-bar overflow-x-auto overflow-y-hidden', className)}
    >
      <div style={{ width, height: 1 }} />
    </div>
  )
}

/**
 * Горизонтальная прокрутка широкой таблицы, удобная и без трекпада.
 *
 * У обычного `overflow-x-auto` полоса прокрутки одна — под последней строкой.
 * В длинной таблице до неё надо сначала долистать страницу, а колёсиком мыши
 * вбок не прокрутить. Здесь полос две: над таблицей и под ней, причём нижняя
 * прилипает к низу экрана, пока таблица видна. Обе синхронизированы с
 * содержимым; собственная полоса содержимого скрыта, чтобы их не было три.
 * Полосы появляются, только когда таблица действительно шире контейнера.
 */
function HScroll({ children, className, contentClassName }) {
  const contentRef = useRef(null)
  const topRef = useRef(null)
  const bottomRef = useRef(null)
  const syncingRef = useRef(null)
  const [width, setWidth] = useState({ scroll: 0, client: 0 })
  const [edges, setEdges] = useState({ start: false, end: false })

  const overflow = width.scroll - width.client > 1

  const updateEdges = useCallback(() => {
    const el = contentRef.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    setEdges((prev) => {
      const next = { start: el.scrollLeft > 1, end: el.scrollLeft < max - 1 }
      return prev.start === next.start && prev.end === next.end ? prev : next
    })
  }, [])

  const measure = useCallback(() => {
    const el = contentRef.current
    if (!el) return
    setWidth((prev) => (
      prev.scroll === el.scrollWidth && prev.client === el.clientWidth
        ? prev
        : { scroll: el.scrollWidth, client: el.clientWidth }
    ))
    updateEdges()
  }, [updateEdges])

  useLayoutEffect(() => {
    measure()
    const el = contentRef.current
    if (!el || typeof ResizeObserver === 'undefined') return undefined
    const resize = new ResizeObserver(measure)
    // Ширина таблицы меняется при смене страницы и фильтров, а размер
    // контейнера при этом прежний — следим и за содержимым. Если содержимое
    // заменили целиком, MutationObserver подключает новый элемент.
    const observeChildren = () => {
      resize.disconnect()
      resize.observe(el)
      Array.from(el.children).forEach((child) => resize.observe(child))
      measure()
    }
    observeChildren()
    const mutations = new MutationObserver(observeChildren)
    mutations.observe(el, { childList: true })
    return () => {
      resize.disconnect()
      mutations.disconnect()
    }
  }, [measure])

  // Смена ширины сбрасывает положение полос — возвращаем их к содержимому.
  useEffect(() => {
    const left = contentRef.current?.scrollLeft || 0
    if (topRef.current) topRef.current.scrollLeft = left
    if (bottomRef.current) bottomRef.current.scrollLeft = left
  }, [overflow, width.scroll])

  const handleScroll = (source) => (event) => {
    // Программная прокрутка соседей тоже шлёт scroll; без этой проверки полосы
    // дёргали бы друг друга по кругу.
    if (syncingRef.current && syncingRef.current !== source) return
    syncingRef.current = source
    const left = event.currentTarget.scrollLeft
    for (const [name, ref] of [['content', contentRef], ['top', topRef], ['bottom', bottomRef]]) {
      if (name !== source && ref.current && ref.current.scrollLeft !== left) ref.current.scrollLeft = left
    }
    updateEdges()
    requestAnimationFrame(() => {
      if (syncingRef.current === source) syncingRef.current = null
    })
  }

  return (
    <div className={className}>
      {overflow && (
        <ScrollBar ref={topRef} width={width.scroll} onScroll={handleScroll('top')} className='border-b border-slate-100' />
      )}
      <div className='relative'>
        <div
          ref={contentRef}
          onScroll={handleScroll('content')}
          className={cn('overflow-x-auto', overflow && 'hscroll-content', contentClassName)}
        >
          {children}
        </div>
        {/* Тени по краям подсказывают, что таблица продолжается за краем. */}
        <div
          aria-hidden='true'
          className={cn(
            'pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-slate-900/[0.06] to-transparent transition-opacity',
            edges.start ? 'opacity-100' : 'opacity-0',
          )}
        />
        <div
          aria-hidden='true'
          className={cn(
            'pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-slate-900/[0.06] to-transparent transition-opacity',
            edges.end ? 'opacity-100' : 'opacity-0',
          )}
        />
      </div>
      {overflow && (
        <ScrollBar
          ref={bottomRef}
          width={width.scroll}
          onScroll={handleScroll('bottom')}
          className='sticky bottom-0 z-10 border-t border-slate-100 bg-white/95 backdrop-blur'
        />
      )}
    </div>
  )
}

export default HScroll
