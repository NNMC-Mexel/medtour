import { create } from 'zustand'

const useConsultationStore = create((set) => ({
  activeRoomId: null,
  isMinimized: false,

  openConsultation: (roomId) => {
    if (!roomId) return
    set({
      activeRoomId: String(roomId),
      isMinimized: false,
    })
  },

  minimizeConsultation: () => {
    set((state) => state.activeRoomId ? { isMinimized: true } : state)
  },

  restoreConsultation: () => {
    set((state) => state.activeRoomId ? { isMinimized: false } : state)
  },

  closeConsultation: () => {
    set({
      activeRoomId: null,
      isMinimized: false,
    })
  },
}))

export default useConsultationStore
