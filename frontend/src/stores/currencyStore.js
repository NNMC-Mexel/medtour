import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useCurrencyStore = create(
  persist(
    (set) => ({
      currency: 'KZT',
      setCurrency: (currency) => set({ currency }),
    }),
    {
      name: 'currency-storage',
      partialize: (state) => ({ currency: state.currency }),
    }
  )
)
