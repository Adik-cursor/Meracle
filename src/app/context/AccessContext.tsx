import { useMemo, type ReactNode } from 'react'
import { getAccessScopeForUser, listCarePermissionsForUser, listFinancialPermissionsForUser, listWarehousePermissionsForUser } from '../../core/services'
import type { CarePermission, FinancialPermission, WarehousePermission } from '../../core/types'
import { AccessContext, type AccessContextValue } from './access-context'
import { useAuth } from './auth-context'
import { usePersistence, usePersistenceVersion } from './persistence-context'

type AccessProviderProps = {
  children: ReactNode
}

export function AccessProvider({ children }: AccessProviderProps) {
  const { currentUser } = useAuth()
  const persistence = usePersistence()
  const version = usePersistenceVersion()

  const value = useMemo<AccessContextValue>(() => {
    void persistence
    void version
    const listed = listFinancialPermissionsForUser(currentUser)
    const financialPermissions = listed.ok ? listed.value : []
    const warehouseListed = listWarehousePermissionsForUser(currentUser)
    const warehousePermissions = warehouseListed.ok ? warehouseListed.value : []

    const careListed = listCarePermissionsForUser(currentUser)
    const carePermissions = careListed.ok ? careListed.value : []

    return {
      currentUser,
      scope: currentUser ? getAccessScopeForUser(currentUser) : null,
      financialPermissions,
      hasFinancialAccess: (permission: FinancialPermission) =>
        financialPermissions.includes(permission),
      hasWarehouseAccess: (permission: WarehousePermission) =>
        warehousePermissions.includes(permission),
      hasCareAccess: (permission: CarePermission) => carePermissions.includes(permission),
    }
  }, [currentUser, persistence, version])

  return (
    <AccessContext.Provider value={value}>{children}</AccessContext.Provider>
  )
}
