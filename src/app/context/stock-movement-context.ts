import { createContext, useContext } from 'react'
import type { Id, StockMovement, StockMovementType } from '../../core/types'

export type JournalMovementType = Exclude<StockMovementType, 'transfer'>

export type StockMovementDraft = {
  warehouseId: Id
  productId: Id
  type: JournalMovementType
  quantity: number
  note?: string
}

export type StockMovementContextValue = {
  movements: StockMovement[]
  createMovement: (draft: StockMovementDraft) => void
  createMovements: (drafts: StockMovementDraft[]) => boolean
  getProductMovements: (productId: Id) => StockMovement[]
}

export const StockMovementContext =
  createContext<StockMovementContextValue | null>(null)

export function useStockMovements(): StockMovementContextValue {
  const context = useContext(StockMovementContext)

  if (!context) {
    throw new Error(
      'useStockMovements must be used within StockMovementProvider',
    )
  }

  return context
}
