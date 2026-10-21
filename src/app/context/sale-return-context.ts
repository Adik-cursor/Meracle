import { createContext, useContext } from 'react'
import type { Id, SaleReturn, SaleReturnItem } from '../../core/types'

export type SaleReturnItemDraft = {
  saleItemId: Id
  quantity: number
}

export type SaleReturnDraft = {
  saleId: Id
  reason: string
  note?: string
  items: SaleReturnItemDraft[]
}

export type SaleReturnRecord = {
  return: SaleReturn
  items: SaleReturnItem[]
}

export type SaleReturnContextValue = {
  returns: SaleReturnRecord[]
  createReturn: (draft: SaleReturnDraft) => boolean
  completeReturn: (id: Id) => boolean
  cancelReturn: (id: Id) => boolean
  getSaleReturns: (saleId: Id) => SaleReturnRecord[]
  getReturnedQuantity: (saleItemId: Id) => number
  getReturnableQuantity: (saleItemId: Id) => number
}

export const SaleReturnContext = createContext<SaleReturnContextValue | null>(
  null,
)

export function useSaleReturns(): SaleReturnContextValue {
  const context = useContext(SaleReturnContext)

  if (!context) {
    throw new Error('useSaleReturns must be used within SaleReturnProvider')
  }

  return context
}
