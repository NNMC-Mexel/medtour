import test from 'node:test'
import assert from 'node:assert/strict'
import {
  CHAT_CHIME_THROTTLE_MS,
  isChatSurfaceVisible,
  isOwnChatMessage,
  resolveIncomingChatSignal,
} from './chatSignals.js'

// --- Кто автор сообщения -----------------------------------------------------

test('own message is recognised even when id types differ', () => {
  // JWT отдаёт число, стор после гидратации может держать строку.
  assert.equal(isOwnChatMessage({ userId: 42 }, 42), true)
  assert.equal(isOwnChatMessage({ userId: 42 }, '42'), true)
  assert.equal(isOwnChatMessage({ userId: '42' }, 42), true)
})

test('message from the other party is not own', () => {
  assert.equal(isOwnChatMessage({ userId: 7 }, 42), false)
})

test('missing ids never count as own message', () => {
  // Иначе молчание было бы «по умолчанию» и сигнал терялся бы совсем.
  assert.equal(isOwnChatMessage({}, 42), false)
  assert.equal(isOwnChatMessage({ userId: null }, 42), false)
  assert.equal(isOwnChatMessage({ userId: 42 }, undefined), false)
  assert.equal(isOwnChatMessage(null, 42), false)
})

test('id 0 is a real id, not a missing one', () => {
  assert.equal(isOwnChatMessage({ userId: 0 }, 0), true)
  assert.equal(isOwnChatMessage({ userId: 0 }, 42), false)
})

// --- Виден ли чат ------------------------------------------------------------

const VISIBLE = { sidebarOpen: true, sidebarTab: 'chat', isMinimized: false, documentVisibility: 'visible' }

test('chat counts as seen only with the panel open on the chat tab', () => {
  assert.equal(isChatSurfaceVisible(VISIBLE), true)
})

test('closed panel hides the chat', () => {
  assert.equal(isChatSurfaceVisible({ ...VISIBLE, sidebarOpen: false }), false)
})

test('notes and documents tabs hide the chat', () => {
  assert.equal(isChatSurfaceVisible({ ...VISIBLE, sidebarTab: 'notes' }), false)
  assert.equal(isChatSurfaceVisible({ ...VISIBLE, sidebarTab: 'documents' }), false)
})

test('minimized call hides the chat', () => {
  assert.equal(isChatSurfaceVisible({ ...VISIBLE, isMinimized: true }), false)
})

test('background browser tab hides the chat', () => {
  assert.equal(isChatSurfaceVisible({ ...VISIBLE, documentVisibility: 'hidden' }), false)
})

test('visibility defaults are safe when nothing is passed', () => {
  assert.equal(isChatSurfaceVisible(), false)
})

// --- Решение о сигнале -------------------------------------------------------

test('own message is silent and does not raise the badge', () => {
  const result = resolveIncomingChatSignal({
    isOwnMessage: true,
    chatVisible: false,
    now: 10_000,
    lastChimeAt: null,
  })
  assert.deepEqual(result, { playChime: false, countUnread: false, nextChimeAt: null })
})

test('own message does not consume the throttle window', () => {
  // Иначе собственная отправка глушила бы ответ собеседника.
  const own = resolveIncomingChatSignal({ isOwnMessage: true, chatVisible: true, now: 5_000, lastChimeAt: null })
  const reply = resolveIncomingChatSignal({
    isOwnMessage: false, chatVisible: true, now: 5_100, lastChimeAt: own.nextChimeAt,
  })
  assert.equal(reply.playChime, true)
})

test('incoming message with the chat open sounds but adds no badge', () => {
  const result = resolveIncomingChatSignal({
    isOwnMessage: false,
    chatVisible: true,
    now: 10_000,
    lastChimeAt: null,
  })
  assert.equal(result.playChime, true)
  assert.equal(result.countUnread, false)
})

test('incoming message with the chat hidden sounds and adds a badge', () => {
  const result = resolveIncomingChatSignal({
    isOwnMessage: false,
    chatVisible: false,
    now: 10_000,
    lastChimeAt: null,
  })
  assert.equal(result.playChime, true)
  assert.equal(result.countUnread, true)
  assert.equal(result.nextChimeAt, 10_000)
})

test('first message of a session always sounds, whatever the clock origin', () => {
  // Регрессия: раньше «ещё не сигналили» кодировалось нулём, поэтому на часах
  // с началом отсчёта около нуля (performance.now) первое сообщение молчало.
  assert.equal(resolveIncomingChatSignal({ isOwnMessage: false, chatVisible: false, now: 1 }).playChime, true)
  assert.equal(resolveIncomingChatSignal({ isOwnMessage: false, chatVisible: false, now: 0 }).playChime, true)
  assert.equal(
    resolveIncomingChatSignal({ isOwnMessage: false, chatVisible: false, now: Date.now() }).playChime,
    true,
  )
})

test('burst of messages produces one sound but counts every message', () => {
  let lastChimeAt = null
  let unread = 0
  let chimes = 0
  // Собеседник отправил четыре строки за 300 мс.
  for (const now of [10_000, 10_080, 10_170, 10_300]) {
    const r = resolveIncomingChatSignal({ isOwnMessage: false, chatVisible: false, now, lastChimeAt })
    lastChimeAt = r.nextChimeAt
    if (r.playChime) chimes += 1
    if (r.countUnread) unread += 1
  }
  assert.equal(chimes, 1, 'звук один на серию')
  assert.equal(unread, 4, 'счётчик считает все сообщения')
})

test('sound returns after the throttle window passes', () => {
  const first = resolveIncomingChatSignal({ isOwnMessage: false, chatVisible: false, now: 10_000, lastChimeAt: null })
  const tooSoon = resolveIncomingChatSignal({
    isOwnMessage: false, chatVisible: false,
    now: 10_000 + CHAT_CHIME_THROTTLE_MS, lastChimeAt: first.nextChimeAt,
  })
  const later = resolveIncomingChatSignal({
    isOwnMessage: false, chatVisible: false,
    now: 10_001 + CHAT_CHIME_THROTTLE_MS, lastChimeAt: first.nextChimeAt,
  })
  assert.equal(tooSoon.playChime, false, 'ровно на границе окна — ещё тихо')
  assert.equal(later.playChime, true)
})

test('throttled message keeps the previous chime timestamp', () => {
  // Иначе окно сдвигалось бы на каждое сообщение и при плотном потоке
  // звук не вернулся бы никогда.
  const r = resolveIncomingChatSignal({
    isOwnMessage: false, chatVisible: false, now: 10_500, lastChimeAt: 10_000,
  })
  assert.equal(r.playChime, false)
  assert.equal(r.nextChimeAt, 10_000)
})

test('long silent gap sounds again', () => {
  const r = resolveIncomingChatSignal({
    isOwnMessage: false, chatVisible: false, now: 600_000, lastChimeAt: 10_000,
  })
  assert.equal(r.playChime, true)
})
