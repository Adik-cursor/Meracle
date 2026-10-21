import { createContext, useContext } from 'react'
import type {
  Id,
  PaymentMethod,
  Sale,
  SaleFinancialView,
  SaleItem,
  SaleStockCheckResult,
  ServiceResult,
} from '../../core/types'
import type { SaleCheckoutResult } from '../../core/services/checkout-sale'
import type { SaleOnCreditResult } from '../../core/services/checkout-on-credit'

export type SaleItemDraft = {
  productId: Id
  quantity: number
  unitPrice: number
  discount: number
}

export type SaleDraft = {
  warehouseId?: Id
  discount: number
  note?: string
  invoiceNumber?: string
  invoiceDueDate?: string
  invoiceComment?: string
  customerId?: Id
  items: SaleItemDraft[]
}

export type SaleRecord = {
  sale: Sale
  items: SaleItem[]
  financialView: SaleFinancialView | null
}

export type SalesContextValue = {
  sales: SaleRecord[]
  analyticsSales: SaleRecord[]
  createSale: (draft: SaleDraft) => SaleStockCheckResult
  updateSale: (id: Id, draft: SaleDraft) => SaleStockCheckResult
  confirmSale: (id: Id) => SaleStockCheckResult
  cancelSale: (id: Id) => boolean
  completeSale: (id: Id) => SaleStockCheckResult
  checkoutSale: (
    id: Id,
    draft: {
      amount: number
      method: PaymentMethod
      bankName?: string
      terminalName?: string
      accountReference?: string
      paymentReference?: string
      paymentComment?: string
      methodDetail?: string
    },
  ) => ServiceResult<SaleCheckoutResult>
  checkoutOnCredit: (
    id: Id,
    draft?: {
      dueDate?: string
      comment?: string
    },
  ) => ServiceResult<SaleOnCreditResult>
  getSale: (id: Id) => SaleRecord | undefined
  getSaleAccess: (
    id: Id,
  ) =>
    | { ok: true; sale: Sale }
    | { ok: false; code: 'SALE_NOT_FOUND' | 'ACCESS_DENIED' | 'CURRENT_USER_REQUIRED' | 'MODULE_NOT_ENABLED' }
}

export const SalesContext = createContext<SalesContextValue | null>(null)

export function useSales(): SalesContextValue {
  const context = useContext(SalesContext)

  if (!context) {
    throw new Error('useSales must be used within SalesProvider')
  }

  return context
}
