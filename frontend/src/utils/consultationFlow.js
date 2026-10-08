export const CONSULTATION_EXIT_REASON = {
  LOCAL_LEAVE: 'local_leave',
  DOCTOR_FORCE_END: 'doctor_force_end',
}

export const shouldShowPatientRating = ({
  userRole,
  exitReason,
  hasPromptedRating = false,
  hasSubmittedRating = false,
}) => {
  return (
    userRole === 'patient' &&
    exitReason === CONSULTATION_EXIT_REASON.DOCTOR_FORCE_END &&
    !hasPromptedRating &&
    !hasSubmittedRating
  )
}

export const buildPatientRatingPayload = ({ rating, reviewText = '' }) => {
  const payload = { rating }
  const review = reviewText.trim()
  if (review) payload.review = review
  return payload
}

/**
 * Какой «поверхностью» рендерится консультация.
 *
 * Компонент звонка смонтирован в корне приложения, поэтому он виден на любой
 * странице. Полноэкранные состояния (проверка доступа, отказ, сама комната)
 * занимают поток документа: если отдать их фоновому звонку, они приклеятся
 * под содержимым каждой страницы. Отсюда правило: пока звонок свёрнут, наружу
 * выходят только fixed-слои — мини-окно или модалка, — а всё остальное молчит.
 */
export const CONSULTATION_SURFACE = {
  HIDDEN: 'hidden',
  MODALS: 'modals',
  MINI: 'mini',
  CHECKING: 'checking',
  DENIED: 'denied',
  ROOM: 'room',
}

export const resolveConsultationSurface = ({
  isMinimized,
  accessStatus,
  hasBlockingModal = false,
}) => {
  if (isMinimized) {
    if (accessStatus !== 'allowed') return CONSULTATION_SURFACE.HIDDEN
    if (hasBlockingModal) return CONSULTATION_SURFACE.MODALS
    return CONSULTATION_SURFACE.MINI
  }
  if (accessStatus === 'checking') return CONSULTATION_SURFACE.CHECKING
  if (accessStatus === 'denied') return CONSULTATION_SURFACE.DENIED
  return CONSULTATION_SURFACE.ROOM
}

/**
 * Кто из двух участников делает offer.
 *
 * Раньше инициатором становился тот, кому пришёл `user-joined`. При
 * одновременном переподключении после разрыва такое событие получали оба, оба
 * отправляли offer, встречный offer сносил соединение с собственным
 * незавершённым offer'ом — и звонок больше не поднимался. Сравнение socketId
 * даёт обеим сторонам одинаковый ответ без единого сообщения.
 *
 * Требование к функции: для любой пары разных id ровно одна сторона получает
 * true — это и проверяют тесты.
 */
export const isNegotiationInitiator = (ownSocketId, peerSocketId) =>
  String(ownSocketId) > String(peerSocketId)
