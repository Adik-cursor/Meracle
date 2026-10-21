import { useCallback, useLayoutEffect, useMemo, useState, type ReactNode } from 'react'
import type { Id, ServiceResult, User } from '../../core/types'
import {
  getCurrentUser as getCurrentUserService,
  login as loginService,
  logout as logoutService,
} from '../../core/services'
import { usePersistence, usePersistenceVersion } from './persistence-context'
import { AuthContext, type AuthContextValue } from './auth-context'

type AuthProviderProps = {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const persistence = usePersistence()
  const version = usePersistenceVersion()
  const [isInitializing, setIsInitializing] = useState(true)

  useLayoutEffect(() => {
    setIsInitializing(false)
  }, [])

  const login = useCallback(
    (userId: Id): ServiceResult<User> => loginService(persistence, userId),
    [persistence],
  )

  const logout = useCallback(() => {
    logoutService(persistence)
  }, [persistence])

  const value = useMemo<AuthContextValue>(() => {
    void version
    const resolved = getCurrentUserService(persistence)
    const currentUser = resolved.ok ? resolved.value : null
    const session = currentUser
      ? (persistence.auth.getSession() ?? null)
      : null

    return {
      currentUser,
      session,
      isAuthenticated: Boolean(currentUser),
      isInitializing,
      login,
      logout,
    }
  }, [isInitializing, login, logout, persistence, version])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
