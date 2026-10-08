/**
 * Решение о сигнале на входящее сообщение чата консультации.
 *
 * Логика вынесена из компонента звонка: там она живёт внутри socket-обработчика
 * рядом с WebRTC и проверить её иначе как поднятием двух браузеров невозможно.
 */

// Минимальный интервал между звуками чата: серия сообщений не должна
// превращаться в очередь сигналов поверх разговора.
export const CHAT_CHIME_THROTTLE_MS = 1200

/**
 * Сообщение написал сам пользователь?
 *
 * Сервер рассылает `chat-message` всей комнате, включая автора, поэтому без
 * этой проверки отправитель слышал бы сигнал на собственное сообщение.
 * id сравниваем строками: в JWT он число, в сторе может оказаться строкой.
 */
export const isOwnChatMessage = (message, currentUserId) => {
  const authorId = message?.userId
  if (authorId === null || authorId === undefined) return false
  if (currentUserId === null || currentUserId === undefined) return false
  return String(authorId) === String(currentUserId)
}

/**
 * Чат «просмотрен» только когда его действительно видно: панель открыта,
 * активна вкладка чата, звонок не свёрнут и вкладка браузера на переднем плане.
 */
export const isChatSurfaceVisible = ({
  sidebarOpen,
  sidebarTab,
  isMinimized = false,
  documentVisibility = 'visible',
} = {}) =>
  Boolean(sidebarOpen) &&
  sidebarTab === 'chat' &&
  !isMinimized &&
  documentVisibility === 'visible'

/**
 * Что сделать с входящим сообщением: сигналить звуком и/или поднять счётчик
 * непрочитанных.
 *
 * Звук — на каждое чужое сообщение, даже при открытой панели: во время звонка
 * взгляд на видео, а не на сайдбар. Счётчик — только когда чат не на экране,
 * иначе бейдж висел бы поверх уже прочитанного.
 */
export const resolveIncomingChatSignal = ({
  isOwnMessage,
  chatVisible,
  now,
  lastChimeAt = null,
  throttleMs = CHAT_CHIME_THROTTLE_MS,
}) => {
  if (isOwnMessage) {
    return { playChime: false, countUnread: false, nextChimeAt: lastChimeAt }
  }
  // «Ещё не сигналили» — это null, а не 0: с нулём результат зависел бы от
  // начала отсчёта часов, и на монотонном таймере (performance.now) первое
  // сообщение после загрузки страницы ушло бы в троттлинг.
  const playChime = lastChimeAt === null || now - lastChimeAt > throttleMs
  return {
    playChime,
    countUnread: !chatVisible,
    nextChimeAt: playChime ? now : lastChimeAt,
  }
}
