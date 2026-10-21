import { createContext, useContext } from 'react'
import type { Id, ServiceResult, Session, User } from '../../core/types'

export type AuthContextValue = {
  currentUser: User | null
  session: Session | null
  isAuthenticated: boolean
  isInitializing: boolean
  login: (userId: Id) => ServiceResult<User>
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }

  return context
}
