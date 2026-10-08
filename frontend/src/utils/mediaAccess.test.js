import test from 'node:test'
import assert from 'node:assert/strict'
import {
  MEDIA_KIND,
  MEDIA_OUTCOME,
  MEDIA_REASON,
  acquireLocalMedia,
  classifyMediaError,
  describeMediaOutcome,
} from './mediaAccess.js'

const domError = (name) => Object.assign(new Error(name), { name })

const fakeTrack = (kind) => ({ kind, stopped: false, stop() { this.stopped = true } })

const fakeStream = (kinds) => {
  const tracks = kinds.map(fakeTrack)
  return { tracks, getTracks: () => tracks }
}

// Браузер отдаёт дорожки только тех типов, которые запросили.
const browser = ({ camera = null, microphone = null }) => async (constraints) => {
  const wantsVideo = Boolean(constraints.video)
  const wantsAudio = Boolean(constraints.audio)
  if (wantsVideo && camera) throw camera
  if (wantsAudio && microphone) throw microphone
  const kinds = []
  if (wantsAudio) kinds.push('audio')
  if (wantsVideo) kinds.push('video')
  return fakeStream(kinds)
}

const collect = (tracks) => ({ tracks, getTracks: () => tracks })

test('имена ошибок браузера сводятся к понятным причинам', () => {
  assert.equal(classifyMediaError(domError('NotAllowedError')), MEDIA_REASON.DENIED)
  assert.equal(classifyMediaError(domError('PermissionDeniedError')), MEDIA_REASON.DENIED)
  assert.equal(classifyMediaError(domError('NotFoundError')), MEDIA_REASON.NOT_FOUND)
  assert.equal(classifyMediaError(domError('NotReadableError')), MEDIA_REASON.BUSY)
  assert.equal(classifyMediaError(domError('AbortError')), MEDIA_REASON.OTHER)
  assert.equal(classifyMediaError(undefined), MEDIA_REASON.OTHER)
})

test('оба устройства на месте — один запрос, полный поток', async () => {
  let calls = 0
  const result = await acquireLocalMedia({
    getUserMedia: async (constraints) => {
      calls += 1
      assert.ok(constraints.video && constraints.audio)
      return fakeStream(['audio', 'video'])
    },
    createStream: collect,
  })
  assert.equal(calls, 1)
  assert.equal(result.camera.ok, true)
  assert.equal(result.microphone.ok, true)
  assert.equal(result.stream.getTracks().length, 2)
})

test('нет камеры — заходим с одним микрофоном', async () => {
  const result = await acquireLocalMedia({
    getUserMedia: browser({ camera: domError('NotFoundError') }),
    createStream: collect,
  })
  assert.equal(result.microphone.ok, true)
  assert.equal(result.camera.ok, false)
  assert.equal(result.camera.reason, MEDIA_REASON.NOT_FOUND)
  assert.deepEqual(result.stream.getTracks().map((t) => t.kind), ['audio'])
})

test('нет микрофона — заходим с одной камерой', async () => {
  const result = await acquireLocalMedia({
    getUserMedia: browser({ microphone: domError('NotReadableError') }),
    createStream: collect,
  })
  assert.equal(result.camera.ok, true)
  assert.equal(result.microphone.ok, false)
  assert.equal(result.microphone.reason, MEDIA_REASON.BUSY)
  assert.deepEqual(result.stream.getTracks().map((t) => t.kind), ['video'])
})

test('причины у камеры и микрофона различаются независимо', async () => {
  const result = await acquireLocalMedia({
    getUserMedia: browser({
      camera: domError('NotFoundError'),
      microphone: domError('NotAllowedError'),
    }),
    createStream: collect,
  })
  assert.equal(result.stream, null)
  assert.equal(result.camera.reason, MEDIA_REASON.NOT_FOUND)
  assert.equal(result.microphone.reason, MEDIA_REASON.DENIED)
})

test('слишком строгие требования к камере снимаются со второй попытки', async () => {
  const seen = []
  const result = await acquireLocalMedia({
    videoConstraints: { width: { ideal: 1280 } },
    getUserMedia: async (constraints) => {
      seen.push(constraints)
      if (constraints.video && constraints.video !== true) throw domError('OverconstrainedError')
      const kinds = []
      if (constraints.audio) kinds.push('audio')
      if (constraints.video) kinds.push('video')
      return fakeStream(kinds)
    },
    createStream: collect,
  })
  assert.equal(result.camera.ok, true)
  assert.equal(result.microphone.ok, true)
  assert.deepEqual(seen.at(-1), { video: true })
})

test('чужие дорожки пробного потока останавливаются', async () => {
  const leftovers = []
  const result = await acquireLocalMedia({
    getUserMedia: async (constraints) => {
      if (constraints.video && constraints.audio) throw domError('NotAllowedError')
      // Нарочно щедрый браузер: на запрос аудио отдаёт ещё и видео.
      const stream = fakeStream(['audio', 'video'])
      leftovers.push(stream)
      return stream
    },
    createStream: collect,
  })
  assert.deepEqual(result.stream.getTracks().map((t) => t.kind), ['audio', 'video'])
  const stopped = leftovers.flatMap((s) => s.tracks).filter((t) => t.stopped)
  assert.equal(stopped.length, 2)
})

test('небезопасный контекст и старый браузер не доходят до запроса устройств', async () => {
  const never = () => { throw new Error('getUserMedia не должен вызываться') }
  const insecure = await acquireLocalMedia({ getUserMedia: never, isSecureContext: false })
  assert.equal(insecure.camera.reason, MEDIA_REASON.INSECURE)
  assert.equal(insecure.microphone.reason, MEDIA_REASON.INSECURE)

  const unsupported = await acquireLocalMedia({ getUserMedia: undefined })
  assert.equal(unsupported.stream, null)
  assert.equal(unsupported.camera.reason, MEDIA_REASON.UNSUPPORTED)
})

test('итог запроса описывает, что показать пациенту', () => {
  const ready = describeMediaOutcome({ camera: { ok: true }, microphone: { ok: true } })
  assert.equal(ready.status, MEDIA_OUTCOME.READY)
  assert.deepEqual(ready.missing, [])
  assert.equal(ready.needsConfirmation, false)

  const noCamera = describeMediaOutcome({
    camera: { ok: false, reason: MEDIA_REASON.NOT_FOUND },
    microphone: { ok: true },
  })
  assert.equal(noCamera.status, MEDIA_OUTCOME.PARTIAL)
  assert.deepEqual(noCamera.missing, [MEDIA_KIND.CAMERA])
  assert.equal(noCamera.needsConfirmation, false)

  const nothing = describeMediaOutcome({
    camera: { ok: false, reason: MEDIA_REASON.DENIED },
    microphone: { ok: false, reason: MEDIA_REASON.DENIED },
  })
  assert.equal(nothing.status, MEDIA_OUTCOME.BLOCKED)
  assert.deepEqual(nothing.missing, [MEDIA_KIND.MICROPHONE, MEDIA_KIND.CAMERA])
  assert.equal(nothing.needsConfirmation, true)
})
