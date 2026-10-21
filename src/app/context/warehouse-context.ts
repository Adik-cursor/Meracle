import { createContext, useContext } from 'react'
import type { Id, Warehouse, WarehouseStatus } from '../../core/types'
import type { WarehouseDraft } from '../../modules/warehouse/warehouse.types'

export type WarehouseContextValue = {
  warehouses: Warehouse[]
  analyticsWarehouses: Warehouse[]
  createWarehouse: (draft: WarehouseDraft) => void
  updateWarehouse: (id: Id, draft: WarehouseDraft) => void
  setWarehouseStatus: (id: Id, status: WarehouseStatus) => void
}

export const WarehouseContext = createContext<WarehouseContextValue | null>(
  null,
)

export function useWarehouses(): WarehouseContextValue {
  const context = useContext(WarehouseContext)

  if (!context) {
    throw new Error('useWarehouses must be used within WarehouseProvider')
  }

  return context
}
