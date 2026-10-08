/**
 * Получение камеры и микрофона перед входом в комнату.
 *
 * Раньше звонок требовал оба устройства сразу: один getUserMedia на
 * video + audio, и любая осечка — ноутбук без камеры, занятый другим
 * приложением микрофон, отказ в разрешении — заканчивалась общим красным
 * экраном, с которого в комнату уже не попасть. Здесь запрос разбирается по
 * устройствам: сначала пробуем всё вместе (один запрос разрешений — так
 * привычнее пациенту), а при неудаче выясняем по каждому устройству отдельно,
 * что именно не вышло, и собираем поток из того, что доступно.
 */

export const MEDIA_KIND = {
  CAMERA: 'camera',
  MICROPHONE: 'microphone',
}

export const MEDIA_REASON = {
  DENIED: 'denied',
  NOT_FOUND: 'not_found',
  BUSY: 'busy',
  UNSUPPORTED: 'unsupported',
  INSECURE: 'insecure',
  OTHER: 'other',
}

export const MEDIA_OUTCOME = {
  READY: 'ready',
  PARTIAL: 'partial',
  BLOCKED: 'blocked',
}

const CONSTRAINT_ERROR_NAMES = new Set(['OverconstrainedError', 'ConstraintNotSatisfiedError'])

export const isConstraintError = (error) => CONSTRAINT_ERROR_NAMES.has(error?.name)

export const classifyMediaError = (error) => {
  switch (error?.name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError':
      return MEDIA_REASON.DENIED
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return MEDIA_REASON.NOT_FOUND
    case 'NotReadableError':
    case 'TrackStartError':
      return MEDIA_REASON.BUSY
    default:
      return MEDIA_REASON.OTHER
  }
}

const granted = () => ({ ok: true, reason: null })
const refused = (reason) => ({ ok: false, reason })

const bothRefused = (reason) => ({
  stream: null,
  camera: refused(reason),
  microphone: refused(reason),
})

// Пробный поток отдаёт только дорожки своего типа; всё лишнее гасим, иначе
// индикатор записи в браузере продолжит гореть для брошенного потока.
const takeTracks = (stream, kind) => {
  if (!stream) return []
  const wanted = []
  stream.getTracks().forEach((track) => {
    if (track.kind === kind) wanted.push(track)
    else track.stop()
  })
  return wanted
}

/**
 * Запрашивает камеру и микрофон, не требуя, чтобы были оба.
 *
 * Возвращает `{ stream, camera, microphone }`, где у каждого устройства
 * `{ ok, reason }`. `stream` равен null только когда не удалось получить
 * ни одной дорожки — комнату в этом случае всё равно можно открыть в режиме
 * «только смотреть и слушать», решение за вызывающим кодом.
 */
export async function acquireLocalMedia({
  getUserMedia,
  videoConstraints = true,
  audioConstraints = true,
  isSupported = true,
  isSecureContext = true,
  createStream = (tracks) => new MediaStream(tracks),
} = {}) {
  if (!isSupported || typeof getUserMedia !== 'function') {
    return bothRefused(MEDIA_REASON.UNSUPPORTED)
  }
  if (!isSecureContext) {
    return bothRefused(MEDIA_REASON.INSECURE)
  }

  try {
    const stream = await getUserMedia({ video: videoConstraints, audio: audioConstraints })
    return { stream, camera: granted(), microphone: granted() }
  } catch {
    // Совместный запрос падает целиком, даже если недоступно одно устройство.
    // Дальше разбираемся поштучно.
  }

  const probe = async (constraints, relaxed) => {
    try {
      return { stream: await getUserMedia(constraints) }
    } catch (error) {
      // Запрошенное разрешение/частота кадров может не подойти конкретной
      // камере — второй заход без требований обычно проходит.
      if (relaxed && isConstraintError(error)) {
        try {
          return { stream: await getUserMedia(relaxed) }
        } catch (relaxedError) {
          return { error: relaxedError }
        }
      }
      return { error }
    }
  }

  // Строго последовательно: два одновременных запроса разрешений браузер
  // показывает один поверх другого, и пациент видит только верхний.
  const mic = await probe({ audio: audioConstraints }, { audio: true })
  const cam = await probe({ video: videoConstraints }, { video: true })

  const tracks = [
    ...takeTracks(mic.stream, 'audio'),
    ...takeTracks(cam.stream, 'video'),
  ]

  return {
    stream: tracks.length ? createStream(tracks) : null,
    microphone: mic.stream ? granted() : refused(classifyMediaError(mic.error)),
    camera: cam.stream ? granted() : refused(classifyMediaError(cam.error)),
  }
}

/**
 * Что показать пациенту по результату запроса устройств.
 *
 * Микрофон идёт первым: без голоса консультация не состоится, а без камеры —
 * вполне, поэтому именно он определяет тон сообщения.
 */
export function describeMediaOutcome({ camera, microphone } = {}) {
  const missing = []
  if (!microphone?.ok) missing.push(MEDIA_KIND.MICROPHONE)
  if (!camera?.ok) missing.push(MEDIA_KIND.CAMERA)

  const status = missing.length === 0
    ? MEDIA_OUTCOME.READY
    : missing.length === 2
      ? MEDIA_OUTCOME.BLOCKED
      : MEDIA_OUTCOME.PARTIAL

  return {
    status,
    missing,
    // Частичный набор устройств не повод останавливать пациента: заходим
    // молча и объясняем ограничение плашкой уже внутри комнаты.
    needsConfirmation: status === MEDIA_OUTCOME.BLOCKED,
    devices: {
      [MEDIA_KIND.MICROPHONE]: microphone || refused(MEDIA_REASON.OTHER),
      [MEDIA_KIND.CAMERA]: camera || refused(MEDIA_REASON.OTHER),
    },
  }
}
