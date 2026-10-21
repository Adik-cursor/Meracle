import { useCallback, useMemo, useState, type ReactNode } from 'react'
import {
  ToastContext,
  type ToastTone,
} from './toast-context'

type ToastRecord = { id: number; message: string; tone: ToastTone }

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([])

  const showToast = useCallback((message: string, tone: ToastTone = 'success') => {
    const id = Date.now() + Math.random()
    setToasts((current) => [...current, { id, message, tone }])
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id))
    }, 2800)
  }, [])

  const value = useMemo(() => ({ showToast }), [showToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-host" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast--${toast.tone}`}>
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
