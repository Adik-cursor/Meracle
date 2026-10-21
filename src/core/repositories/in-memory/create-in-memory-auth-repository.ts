import type { Session } from '../../types'
import type { AuthRepository } from '../auth-repository'

export function createInMemoryAuthRepository(
  onChange: () => void,
): AuthRepository & {
  snapshot: () => Session | null
  restore: (session: Session | null) => void
} {
  let session: Session | null = null

  const clone = (value: Session): Session => structuredClone(value)

  return {
    getSession() {
      return session ? clone(session) : undefined
    },
    createSession(next) {
      session = clone(next)
      onChange()
      return clone(session)
    },
    clearSession() {
      if (!session) {
        return
      }

      session = null
      onChange()
    },
    snapshot() {
      return session ? clone(session) : null
    },
    restore(value) {
      session = value ? clone(value) : null
      onChange()
    },
  }
}
