import { useMemo, type ReactNode } from 'react'
import type { Id } from '../../core/types'
import {
  applyStockDeltasForUser,
  listAccessibleInventoryForUser,
  listInventoryForAnalytics,
  listInventoryForUser,
  receiveStockForUser,
  setStockForUser,
} from '../../core/services'
import { useAccess } from './access-context'
import { useOrganization } from './organization-context'
import { usePersistence, usePersistenceVersion } from './persistence-context'
import {
  InventoryContext,
  type InventoryContextValue,
  type StockQuantityUpdate,
} from './inventory-context'

type InventoryProviderProps = {
  children: ReactNode
}

export function InventoryProvider({ children }: InventoryProviderProps) {
  const { organization } = useOrganization()
  const { currentUser } = useAccess()
  const persistence = usePersistence()
  const version = usePersistenceVersion()

  const value = useMemo<InventoryContextValue>(() => {
    void version
    const listed = listAccessibleInventoryForUser(persistence, currentUser)
    const analytics = listInventoryForAnalytics(persistence, currentUser)

    return {
      inventory: listed.ok ? listed.value : [],
      analyticsInventory: analytics.ok ? analytics.value : [],
      getStock: (warehouseId: Id, productId: Id) => {
        const items = listInventoryForUser(persistence, currentUser, warehouseId)
        if (!items.ok) {
          return undefined
        }

        return items.value.find((item) => item.productId === productId)
      },
      setStock: (warehouseId, productId, quantity) => {
        setStockForUser(
          persistence,
          currentUser,
          organization.id,
          warehouseId,
          productId,
          quantity,
        )
      },
      applyStockChanges: (updates: StockQuantityUpdate[]) =>
        applyStockDeltasForUser(persistence, currentUser, organization.id, updates)
          .ok,
      receiveStock: (draft) =>
        receiveStockForUser(
          persistence,
          currentUser,
          organization.id,
          draft,
        ).ok,
    }
  }, [currentUser, organization.id, persistence, version])

  return (
    <InventoryContext.Provider value={value}>
      {children}
    </InventoryContext.Provider>
  )
}
