import { useRef, type ReactNode } from 'react'
import type { Persistence } from '../../core/repositories'
import { createBrowserPersistence } from '../../core/repositories/browser/create-browser-persistence'
import { PersistenceContext } from './persistence-context'

type PersistenceProviderProps = {
  children: ReactNode
}

export function PersistenceProvider({ children }: PersistenceProviderProps) {
  const persistenceRef = useRef<Persistence | null>(null)

  if (!persistenceRef.current) {
    persistenceRef.current = createBrowserPersistence()
  }

  return (
    <PersistenceContext.Provider value={persistenceRef.current}>
      {children}
    </PersistenceContext.Provider>
  )
}
