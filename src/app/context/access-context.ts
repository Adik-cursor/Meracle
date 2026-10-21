import { createContext, useContext } from 'react'
import type { AccessScope, CarePermission, FinancialPermission, User, WarehousePermission } from '../../core/types'

export type AccessContextValue = {
  currentUser: User | null
  scope: AccessScope | null
  financialPermissions: readonly FinancialPermission[]
  hasFinancialAccess: (permission: FinancialPermission) => boolean
  hasWarehouseAccess: (permission: WarehousePermission) => boolean
  hasCareAccess: (permission: CarePermission) => boolean
}

export const AccessContext = createContext<AccessContextValue | null>(null)

export function useAccess(): AccessContextValue {
  const context = useContext(AccessContext)

  if (!context) {
    throw new Error('useAccess must be used within AccessProvider')
  }

  return context
}
