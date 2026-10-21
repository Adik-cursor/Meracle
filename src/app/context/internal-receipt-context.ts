import { createContext, useContext } from 'react'
import type { Id, InternalReceipt } from '../../core/types'

export type InternalReceiptContextValue = {
  receipts: InternalReceipt[]
  getBySaleId: (saleId: Id) => InternalReceipt | undefined
  listBySaleId: (saleId: Id) => InternalReceipt[]
  getById: (id: Id) => InternalReceipt | undefined
  getReceiptAccess: (
    id: Id,
  ) =>
    | { ok: true; receipt: InternalReceipt }
    | {
        ok: false
        code: 'SALE_NOT_FOUND' | 'ACCESS_DENIED' | 'CURRENT_USER_REQUIRED'
      }
  getBySaleReturnId: (saleReturnId: Id) => InternalReceipt | undefined
}

export const InternalReceiptContext =
  createContext<InternalReceiptContextValue | null>(null)

export function useInternalReceipts(): InternalReceiptContextValue {
  const context = useContext(InternalReceiptContext)

  if (!context) {
    throw new Error(
      'useInternalReceipts must be used within InternalReceiptProvider',
    )
  }

  return context
}
