import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'
import { deviceTokensAPI } from './api'

let initialized = false

export async function initializeMobilePushNotifications() {
  if (initialized || !Capacitor.isNativePlatform()) return
  initialized = true

  try {
    let permission = await PushNotifications.checkPermissions()
    if (permission.receive === 'prompt') {
      permission = await PushNotifications.requestPermissions()
    }
    if (permission.receive !== 'granted') return

    await PushNotifications.addListener('registration', async ({ value }) => {
      if (!value) return
      await deviceTokensAPI.register({
        token: value,
        platform: Capacitor.getPlatform(),
        appId: 'kz.nnmc.medtour',
      })
    })

    await PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) => {
      const link = notification?.data?.link
      if (typeof link === 'string' && link.startsWith('/')) {
        window.location.assign(link)
      }
    })

    await PushNotifications.register()
  } catch (error) {
    if (!import.meta.env.PROD) {
      console.warn('Mobile push initialization failed:', error?.message || error)
    }
  }
}
