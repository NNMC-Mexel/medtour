// Звуковые сигналы интерфейса (WebAudio, без файлов-ассетов).
//
// Один AudioContext на всё приложение: браузеры ограничивают их количество, а
// разблокировать каждый пришлось бы отдельным жестом пользователя.

let audioCtx = null
let audioUnlocked = false

export const unlockAudio = () => {
  if (audioUnlocked) return
  try {
    const Ctor = window.AudioContext || window.webkitAudioContext
    if (!Ctor) return
    audioCtx = new Ctor()
    if (audioCtx.state === 'suspended') audioCtx.resume()
    audioUnlocked = true
  } catch {
    /* no audio support — ignore */
  }
}

if (typeof window !== 'undefined') {
  const handler = () => {
    unlockAudio()
    window.removeEventListener('pointerdown', handler)
    window.removeEventListener('keydown', handler)
  }
  window.addEventListener('pointerdown', handler, { once: true })
  window.addEventListener('keydown', handler, { once: true })
}

// Контекст засыпает, когда приложение уходит в фон (на iOS — всегда).
// Пробуждение асинхронное, поэтому сигнал не выбрасываем, а откладываем до
// момента, когда контекст снова заиграет: иначе первое сообщение после
// возврата в приложение оказывалось беззвучным.
const withReadyContext = (schedule) => {
  if (!audioCtx) return
  if (audioCtx.state === 'suspended') {
    audioCtx
      .resume()
      .then(() => {
        if (audioCtx && audioCtx.state === 'running') schedule(audioCtx)
      })
      .catch(() => {
        /* без жеста пользователя браузер откажет — сигнал просто пропускаем */
      })
    return
  }
  schedule(audioCtx)
}

const playTones = (tones, { volume = 0.18 } = {}) => {
  withReadyContext((ctx) => scheduleTones(ctx, tones, volume))
}

const scheduleTones = (ctx, tones, volume) => {
  const start = ctx.currentTime
  tones.forEach(({ at, from, to, duration }) => {
    const now = start + at
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(from, now)
    osc.frequency.exponentialRampToValueAtTime(to, now + duration * 0.4)
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(volume, now + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
    osc.connect(gain).connect(ctx.destination)
    osc.start(now)
    osc.stop(now + duration + 0.05)
  })
}

// Общее уведомление (колокольчик в шапке).
export const playBeep = () => {
  playTones([{ at: 0, from: 880, to: 1175, duration: 0.35 }])
}

// Новое сообщение в чате: две короткие ноты, чтобы не путать с уведомлением.
// Тише сигнала уведомлений — звучит поверх разговора во время консультации.
export const playChatChime = () => {
  playTones(
    [
      { at: 0, from: 987, to: 1046, duration: 0.14 },
      { at: 0.13, from: 1318, to: 1396, duration: 0.22 },
    ],
    { volume: 0.12 },
  )
}
