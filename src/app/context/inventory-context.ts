import { createContext, useContext } from 'react'
import type { Id, InventoryItem } from '../../core/types'

export type StockQuantityUpdate = {
  warehouseId: Id
  productId: Id
  delta: number
}

export type InventoryContextValue = {
  inventory: InventoryItem[]
  analyticsInventory: InventoryItem[]
  getStock: (warehouseId: Id, productId: Id) => InventoryItem | undefined
  setStock: (warehouseId: Id, productId: Id, quantity: number) => void
  applyStockChanges: (updates: StockQuantityUpdate[]) => boolean
  receiveStock: (draft: {
    warehouseId: Id
    productId: Id
    quantity: number
    unitCost: number
    note?: string
  }) => boolean
}

export const InventoryContext = createContext<InventoryContextValue | null>(
  null,
)

export function useInventory(): InventoryContextValue {
  const context = useContext(InventoryContext)

  if (!context) {
    throw new Error('useInventory must be used within InventoryProvider')
  }

  return context
}
