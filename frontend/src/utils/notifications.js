// Notification sound (base64 encoded notification sound)
const NOTIFICATION_SOUND = new Audio('data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAAB9AAACABAAZGF0YQIAAAAAAA==')

const notificationTimeouts = new Map()

export const playNotificationSound = () => {
  try {
    NOTIFICATION_SOUND.currentTime = 0
    NOTIFICATION_SOUND.play().catch(e => console.log('Sound play failed:', e))
  } catch (e) {
    console.log('Sound error:', e)
  }
}

export const requestNotificationPermission = async () => {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false

  try {
    const permission = await Notification.requestPermission()
    return permission === 'granted'
  } catch (error) {
    console.error('Error requesting notification permission:', error)
    return false
  }
}

export const showMessageNotification = (message, onNotificationClick) => {
  if (typeof window === 'undefined' || !('Notification' in window)) return
  if (document.visibilityState === 'visible') return
  if (Notification.permission !== 'granted') return

  const senderName = message?.sender?.fullName || message?.sender?.email || 'MedTour'
  const conversationId = message?.conversation?.documentId || message?.conversation?.id || message?.id
  const notificationKey = `medtour-chat-${conversationId}`

  // Play notification sound
  playNotificationSound()

  // Add bounce animation to chat widget if it exists
  const chatWidget = document.querySelector('[data-chat-widget]')
  if (chatWidget) {
    chatWidget.classList.add('animate-bounce')
    setTimeout(() => chatWidget.classList.remove('animate-bounce'), 1000)
  }

  // Show browser notification
  const notification = new Notification(`💬 ${senderName}`, {
    body: message?.content || 'Attachment',
    tag: notificationKey,
    badge: '/favicon.ico',
    requireInteraction: false,
  })

  notification.onclick = () => {
    window.focus()
    if (onNotificationClick) onNotificationClick(message)
    notification.close()
  }

  // Set up reminder notification after 1 minute if user hasn't interacted
  clearTimeout(notificationTimeouts.get(notificationKey))
  const timeoutId = setTimeout(() => {
    if (document.visibilityState !== 'visible') {
      playNotificationSound()
      const reminderNotification = new Notification(`💬 ${senderName} (Reminder)`, {
        body: message?.content || 'Attachment',
        tag: notificationKey,
        badge: '/favicon.ico',
        requireInteraction: false,
      })
      reminderNotification.onclick = () => {
        window.focus()
        if (onNotificationClick) onNotificationClick(message)
        reminderNotification.close()
      }
    }
  }, 60000) // 1 minute

  notificationTimeouts.set(notificationKey, timeoutId)
}

export const clearNotificationReminder = (conversationId) => {
  const notificationKey = `medtour-chat-${conversationId}`
  clearTimeout(notificationTimeouts.get(notificationKey))
  notificationTimeouts.delete(notificationKey)
}
