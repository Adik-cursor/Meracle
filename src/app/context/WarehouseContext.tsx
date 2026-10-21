import { useMemo, type ReactNode } from 'react'
import type { Id, WarehouseStatus } from '../../core/types'
import {
  createWarehouseForUser,
  listWarehousesForAnalytics,
  listWarehousesForUser,
  setWarehouseStatusForUser,
  updateWarehouseForUser,
} from '../../core/services'
import type { WarehouseDraft } from '../../modules/warehouse/warehouse.types'
import { useAccess } from './access-context'
import { useOrganization } from './organization-context'
import { usePersistence, usePersistenceVersion } from './persistence-context'
import {
  WarehouseContext,
  type WarehouseContextValue,
} from './warehouse-context'

type WarehouseProviderProps = {
  children: ReactNode
}

export function WarehouseProvider({ children }: WarehouseProviderProps) {
  const { organization } = useOrganization()
  const { currentUser } = useAccess()
  const persistence = usePersistence()
  const version = usePersistenceVersion()

  const value = useMemo<WarehouseContextValue>(() => {
    void version
    const listed = listWarehousesForUser(persistence, currentUser)
    const analytics = listWarehousesForAnalytics(persistence, currentUser)

    return {
      warehouses: listed.ok ? listed.value : [],
      analyticsWarehouses: analytics.ok ? analytics.value : [],
      createWarehouse: (draft: WarehouseDraft) => {
        createWarehouseForUser(persistence, currentUser, organization.id, draft)
      },
      updateWarehouse: (id: Id, draft: WarehouseDraft) => {
        updateWarehouseForUser(
          persistence,
          currentUser,
          organization.id,
          id,
          draft,
        )
      },
      setWarehouseStatus: (id: Id, status: WarehouseStatus) => {
        setWarehouseStatusForUser(
          persistence,
          currentUser,
          organization.id,
          id,
          status,
        )
      },
    }
  }, [currentUser, organization.id, persistence, version])

  return (
    <WarehouseContext.Provider value={value}>
      {children}
    </WarehouseContext.Provider>
  )
}
