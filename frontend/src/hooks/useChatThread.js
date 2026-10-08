import { useCallback, useEffect, useRef } from 'react'

// На телефоне открытый диалог — отдельный полноэкранный экран, привязанный к
// видимой области (--vv-top/--vv-height из main.jsx): когда выезжает
// клавиатура, он сжимается, и поле ввода встаёт прямо над ней, как в
// мессенджерах. С md и шире — обычная правая колонка.
export const CHAT_THREAD_PANE_CLASS =
  'flex-1 min-w-0 flex flex-col min-h-0 overflow-x-hidden bg-white ' +
  'max-md:fixed max-md:inset-x-0 max-md:top-(--vv-top) max-md:z-[55] max-md:h-(--vv-height)'

// Шапка диалога на телефоне уходит под «чёлку», если сайт открыт как приложение.
export const CHAT_THREAD_HEADER_CLASS = 'max-md:pt-[calc(var(--safe-top)+0.75rem)]'

// Лента сообщений открытого диалога: держит её у последнего сообщения, пока
// пользователь не пролистал историю вверх, и блокирует страницу под
// полноэкранным диалогом на телефоне.
export default function useChatThread({ isOpen, messages }) {
  const listRef = useRef(null)
  const stickToBottomRef = useRef(true)

  // Прокручиваем только ленту. scrollIntoView двигал заодно и страницу, и на
  // iOS с открытой клавиатурой шапка чата уезжала за верх экрана.
  const scrollToBottom = useCallback((behavior = 'smooth') => {
    const list = listRef.current
    if (list) list.scrollTo({ top: list.scrollHeight, behavior })
  }, [])

  const onListScroll = useCallback((e) => {
    const list = e.currentTarget
    stickToBottomRef.current = list.scrollHeight - list.scrollTop - list.clientHeight < 80
  }, [])

  useEffect(() => {
    stickToBottomRef.current = true
    scrollToBottom()
  }, [messages, scrollToBottom])

  // Клавиатура поднялась или опустилась — последнее сообщение остаётся над
  // полем ввода.
  useEffect(() => {
    const vv = window.visualViewport
    if (!isOpen || !vv) return undefined
    const onResize = () => {
      if (stickToBottomRef.current) scrollToBottom('auto')
    }
    vv.addEventListener('resize', onResize)
    return () => vv.removeEventListener('resize', onResize)
  }, [isOpen, scrollToBottom])

  // Страницу под полноэкранным диалогом блокируем, иначе iOS прокручивает её
  // вместе с полем ввода, когда выезжает клавиатура.
  useEffect(() => {
    if (!isOpen || !window.matchMedia('(max-width: 767px)').matches) return undefined
    const { body } = document
    const previousOverflow = body.style.overflow
    body.style.overflow = 'hidden'
    return () => {
      body.style.overflow = previousOverflow
    }
  }, [isOpen])

  return { listRef, onListScroll }
}
