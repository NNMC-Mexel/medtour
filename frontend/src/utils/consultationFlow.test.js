import test from 'node:test'
import assert from 'node:assert/strict'
import {
  CONSULTATION_EXIT_REASON,
  CONSULTATION_SURFACE,
  buildPatientRatingPayload,
  isNegotiationInitiator,
  resolveConsultationSurface,
  shouldShowPatientRating,
} from './consultationFlow.js'

test('patient local leave does not show rating modal', () => {
  assert.equal(
    shouldShowPatientRating({
      userRole: 'patient',
      exitReason: CONSULTATION_EXIT_REASON.LOCAL_LEAVE,
    }),
    false,
  )
})

test('doctor force end shows rating modal to patient', () => {
  assert.equal(
    shouldShowPatientRating({
      userRole: 'patient',
      exitReason: CONSULTATION_EXIT_REASON.DOCTOR_FORCE_END,
    }),
    true,
  )
})

test('doctor never sees patient rating modal', () => {
  assert.equal(
    shouldShowPatientRating({
      userRole: 'doctor',
      exitReason: CONSULTATION_EXIT_REASON.DOCTOR_FORCE_END,
    }),
    false,
  )
})

test('rating modal is not shown repeatedly after it was already prompted', () => {
  assert.equal(
    shouldShowPatientRating({
      userRole: 'patient',
      exitReason: CONSULTATION_EXIT_REASON.DOCTOR_FORCE_END,
      hasPromptedRating: true,
    }),
    false,
  )
})

test('rating modal is not shown after patient already selected a rating', () => {
  assert.equal(
    shouldShowPatientRating({
      userRole: 'patient',
      exitReason: CONSULTATION_EXIT_REASON.DOCTOR_FORCE_END,
      hasSubmittedRating: true,
    }),
    false,
  )
})

test('patient rating payload does not include forbidden status fields', () => {
  assert.deepEqual(
    buildPatientRatingPayload({ rating: 5, reviewText: '  good consultation  ' }),
    { rating: 5, review: 'good consultation' },
  )
  assert.equal('status' in buildPatientRatingPayload({ rating: 5 }), false)
  assert.equal('statuse' in buildPatientRatingPayload({ rating: 5 }), false)
})

test('фоновый звонок не занимает поток документа', () => {
  // Регрессия: экран «Подключение недоступно» рендерился под содержимым любой
  // страницы, потому что ветка отказа стояла выше проверки на свёрнутый звонок.
  for (const accessStatus of ['checking', 'denied']) {
    assert.equal(
      resolveConsultationSurface({ isMinimized: true, accessStatus }),
      CONSULTATION_SURFACE.HIDDEN
    )
  }
})

test('свёрнутый звонок с открытой модалкой показывает только модалку', () => {
  assert.equal(
    resolveConsultationSurface({ isMinimized: true, accessStatus: 'allowed', hasBlockingModal: true }),
    CONSULTATION_SURFACE.MODALS
  )
})

test('разрешённый свёрнутый звонок показывает мини-окно', () => {
  assert.equal(
    resolveConsultationSurface({ isMinimized: true, accessStatus: 'allowed' }),
    CONSULTATION_SURFACE.MINI
  )
})

test('на маршруте консультации полноэкранные состояния сохраняются', () => {
  assert.equal(
    resolveConsultationSurface({ isMinimized: false, accessStatus: 'checking' }),
    CONSULTATION_SURFACE.CHECKING
  )
  assert.equal(
    resolveConsultationSurface({ isMinimized: false, accessStatus: 'denied' }),
    CONSULTATION_SURFACE.DENIED
  )
  assert.equal(
    resolveConsultationSurface({ isMinimized: false, accessStatus: 'allowed' }),
    CONSULTATION_SURFACE.ROOM
  )
})

test('инициатор согласования всегда ровно один', () => {
  // Регрессия: при одновременном переподключении offer отправляли обе стороны,
  // и звонок после первого же разрыва не восстанавливался.
  const ids = ['aB3xK', 'zQ91m', '0aaaa', 'ZZZZZ', 'abc', 'abcd']
  for (const a of ids) {
    for (const b of ids) {
      if (a === b) continue
      const votes = [isNegotiationInitiator(a, b), isNegotiationInitiator(b, a)]
      assert.equal(votes.filter(Boolean).length, 1, `${a} vs ${b}`)
    }
  }
})

test('решение об инициаторе не зависит от порядка вызова и стабильно', () => {
  assert.equal(isNegotiationInitiator('aaa', 'bbb'), isNegotiationInitiator('aaa', 'bbb'))
  assert.equal(isNegotiationInitiator('bbb', 'aaa'), true)
  assert.equal(isNegotiationInitiator('aaa', 'bbb'), false)
})
