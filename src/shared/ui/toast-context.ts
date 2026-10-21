import { createContext, useContext } from 'react'

export type ToastTone = 'success' | 'error'

export type ToastContextValue = {
  showToast: (message: string, tone?: ToastTone) => void
}

export const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const value = useContext(ToastContext)
  if (!value) {
    return {
      showToast: () => undefined,
    }
  }
  return value
}
