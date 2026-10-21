import type { Session } from '../types'

export type AuthRepository = {
  getSession: () => Session | undefined
  createSession: (session: Session) => Session
  clearSession: () => void
}
