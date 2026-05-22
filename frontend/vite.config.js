import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const isProduction = mode === 'production'
  const isLocalUrl = (value) => /(^|[/:])(localhost|127\.0\.0\.1)(:|\/|$)/.test(value || '')
  const productionValue = (value) => (value && !isLocalUrl(value) ? value : '')

  const API_URL = isProduction
    ? productionValue(env.VITE_PRODUCTION_API_URL) || 'https://medtourserver.nnmc.kz'
    : env.VITE_API_URL || 'http://localhost:1340'

  const SIGNALING_SERVER = isProduction
    ? productionValue(env.VITE_PRODUCTION_SIGNALING_URL) || 'https://medtourrtc.nnmc.kz'
    : env.VITE_SIGNALING_SERVER || 'http://localhost:1341'

  const TURN_URL = isProduction
    ? productionValue(env.VITE_TURN_URL)
    : env.VITE_TURN_URL || 'turn:localhost:3478'

  const TURN_URL_TCP = env.VITE_TURN_URL_TCP || ''

  const TURN_INTERNAL = env.VITE_TURN_INTERNAL || ''

  const TURN_USERNAME = env.VITE_TURN_USERNAME || ''

  const TURN_CREDENTIAL = env.VITE_TURN_CREDENTIAL || ''

  const productionFrontendHosts = (env.VITE_PRODUCTION_FRONTEND_HOSTS || 'medtour.nnmc.kz,www.medtour.nnmc.kz')
    .split(',')
    .map((host) => host.trim())
    .filter(Boolean)

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': '/src',
      },
    },
    server: {
      // Локальный порт фронтенда
      port: 1342,
      proxy: {
        '/api': {
          target: API_URL,
          changeOrigin: true,
        },
      },
    },
    preview: {
      host: '0.0.0.0',
      port: Number(env.PORT) || 1342,
      allowedHosts: [
        ...productionFrontendHosts,
        'localhost',
        '127.0.0.1',
      ],
    },
    define: {
      'import.meta.env.VITE_API_URL': JSON.stringify(API_URL),
      'import.meta.env.VITE_SIGNALING_SERVER': JSON.stringify(SIGNALING_SERVER),
      'import.meta.env.VITE_TURN_URL': JSON.stringify(TURN_URL),
      'import.meta.env.VITE_TURN_URL_TCP': JSON.stringify(TURN_URL_TCP),
      'import.meta.env.VITE_TURN_INTERNAL': JSON.stringify(TURN_INTERNAL),
      'import.meta.env.VITE_TURN_USERNAME': JSON.stringify(TURN_USERNAME),
      'import.meta.env.VITE_TURN_CREDENTIAL': JSON.stringify(TURN_CREDENTIAL),
    },
  }
})
