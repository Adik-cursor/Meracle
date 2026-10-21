import { createContext, useContext } from 'react'
import type { Id, WarehouseTransfer } from '../../core/types'

export type WarehouseTransferDraft = {
  sourceWarehouseId: Id
  destinationWarehouseId: Id
  productId: Id
  quantity: number
}

export type WarehouseTransferContextValue = {
  transfers: WarehouseTransfer[]
  createTransfer: (draft: WarehouseTransferDraft) => boolean
  submitTransfer: (id: Id) => boolean
  completeTransfer: (id: Id) => boolean
  cancelTransfer: (id: Id) => boolean
}

export const WarehouseTransferContext =
  createContext<WarehouseTransferContextValue | null>(null)

export function useWarehouseTransfers(): WarehouseTransferContextValue {
  const context = useContext(WarehouseTransferContext)

  if (!context) {
    throw new Error(
      'useWarehouseTransfers must be used within WarehouseTransferProvider',
    )
  }

  return context
}
