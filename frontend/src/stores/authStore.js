import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import api, { authAPI } from '../services/api'

// Decode JWT expiry without external library (no signature verification — just expiry)
function getJwtExpiry(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null
  } catch {
    return null
  }
}

function isTokenExpired(token) {
  if (!token) return true
  const expiry = getJwtExpiry(token)
  if (!expiry) return false // can't determine, assume valid
  return Date.now() >= expiry
}

const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      _hasHydrated: false,

      // Set hydrated flag
      setHasHydrated: (state) => {
        set({ _hasHydrated: state })
      },

      // Login
      login: async (identifier, password) => {
        set({ isLoading: true, error: null })
        try {
          const response = await authAPI.login(identifier, password)
          
          const { jwt, user } = response.data
          
          set({
            user,
            token: jwt,
            isAuthenticated: true,
            isLoading: false,
          })
          
          return { success: true, user }
        } catch (error) {
          const message = error.response?.data?.error?.message || 'Ошибка входа'
          set({ error: message, isLoading: false })
          return { success: false, error: message }
        }
      },

      // Register — один вызов, backend (strapi-server.ts) обрабатывает:
      //   - назначение Strapi-роли (patient/doctor)
      //   - сохранение fullName, phone, country, iin, userRole
      //   - создание Doctor-профиля (если doctor)
      register: async (userData) => {
        set({ isLoading: true, error: null })
        try {
          const response = await api.post('/api/auth/local/register', {
            username: userData.email,
            email: userData.email,
            password: userData.password,
            userRole: userData.userRole || 'patient',
            fullName: userData.fullName,
            phone: userData.phone,
            country: userData.country,
            iin: userData.iin,
            doctorData: userData.doctorData || null,
          })

          const { jwt, user, requiresEmailConfirmation, message } = response.data

          // New flow: server requires email confirmation before issuing JWT.
          // Do not authenticate locally — show the "check your email" screen instead.
          if (requiresEmailConfirmation || !jwt) {
            set({ isLoading: false })
            return {
              success: true,
              requiresEmailConfirmation: true,
              user: user || null,
              message: message || 'Please check your email to confirm your account.',
            }
          }

          // Legacy path: server returned JWT directly (e.g. existing accounts).
          set({
            user,
            token: jwt,
            isAuthenticated: true,
            isLoading: false,
          })

          return { success: true, user }
        } catch (error) {
          const message = error.response?.data?.error?.message || 'Ошибка регистрации'
          set({ error: message, isLoading: false })
          return { success: false, error: message }
        }
      },

      // Logout
      logout: () => {
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          error: null,
        })
      },

      // Get current user
      fetchUser: async () => {
        const token = get().token
        if (!token) return

        // Logout immediately if token is expired — no need to hit the server
        if (isTokenExpired(token)) {
          get().logout()
          return
        }
        
        set({ isLoading: true })
        try {
          const response = await authAPI.getMe()
          set({ 
            user: response.data, 
            isAuthenticated: true,
            isLoading: false 
          })
        } catch (error) {
          console.error('fetchUser error:', error)
          set({ isLoading: false })
          // Не разлогиниваем сразу - возможно сервер просто недоступен
          if (error.response?.status === 401) {
            get().logout()
          }
        }
      },

      // Update user profile
      updateProfile: async (data) => {
        set({ isLoading: true, error: null })
        try {
          const currentUser = get().user
          const profileData = {
            fullName: data.fullName || null,
            email: data.email || null,
            phone: data.phone || null,
            iin: data.iin || null,
            birthDate: data.birthDate || null,
            i18n: data.i18n || {},
          }
          const response = await api.put('/api/users/me', profileData)
          set({ user: { ...currentUser, ...profileData, ...response.data }, isLoading: false })
          return { success: true, user: response.data }
        } catch (error) {
          const message = error.response?.data?.error?.message || 'Ошибка обновления'
          set({ error: message, isLoading: false })
          return { success: false, error: message }
        }
      },

      changePassword: async ({ currentPassword, password, passwordConfirmation }) => {
        set({ isLoading: true, error: null })
        try {
          const response = await authAPI.changePassword({
            currentPassword,
            password,
            passwordConfirmation,
          })
          const { jwt, user } = response.data || {}
          set((state) => ({
            token: jwt || state.token,
            user: user || state.user,
            isAuthenticated: true,
            isLoading: false,
          }))
          return { success: true }
        } catch (error) {
          const message = error.response?.data?.error?.message || 'Ошибка смены пароля'
          set({ error: message, isLoading: false })
          return { success: false, error: message }
        }
      },

      completePlatformGuide: async () => {
        set({ isLoading: true, error: null })
        try {
          const currentUser = get().user
          const response = await api.put('/api/users/me', {
            platformGuideCompleted: true,
          })
          set({
            user: { ...currentUser, ...response.data },
            isLoading: false,
          })
          return { success: true, user: response.data }
        } catch (error) {
          const message = error.response?.data?.error?.message || 'Ошибка сохранения обучения'
          set({ error: message, isLoading: false })
          return { success: false, error: message }
        }
      },

      // Get user role (используем userRole из Strapi)
      getUserRole: () => {
        const user = get().user
        return user?.userRole || 'patient'
      },

      // Clear error
      clearError: () => set({ error: null }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ 
        token: state.token, 
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
        if (state?.token && state?.user) {
          // On rehydration, discard expired tokens immediately
          if (isTokenExpired(state.token)) {
            state.token = null
            state.user = null
            state.isAuthenticated = false
          } else {
            state.isAuthenticated = true
          }
        }
      },
    }
  )
)

export default useAuthStore
