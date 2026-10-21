import { createContext, useContext, useSyncExternalStore } from 'react'
import type { Persistence } from '../../core/repositories'

export const PersistenceContext = createContext<Persistence | null>(null)

export function usePersistence(): Persistence {
  const context = useContext(PersistenceContext)

  if (!context) {
    throw new Error('usePersistence must be used within PersistenceProvider')
  }

  return context
}

export function usePersistenceVersion(): number {
  const persistence = usePersistence()

  return useSyncExternalStore(
    persistence.subscribe,
    persistence.getVersion,
    persistence.getVersion,
  )
}
