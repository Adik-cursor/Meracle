import type { BaseEntity, Id } from './common'

export type SaleStatus = 'draft' | 'confirmed' | 'cancelled' | 'completed'

export type SaleStockErrorCode = 'PRODUCT_NOT_AVAILABLE'

export type ProductNotAvailableError = {
  code: 'PRODUCT_NOT_AVAILABLE'
  warehouseId: Id
  productId: Id
  requestedQuantity: number
  availableQuantity: number
}

export type SaleStockCheckResult =
  | { ok: true; saleId?: Id }
  | { ok: false; error: ProductNotAvailableError }

export type Sale = BaseEntity & {
  warehouseId?: Id
  customerId?: Id
  status: SaleStatus
  currency: string
  subtotal: number
  discount: number
  total: number
  note?: string
  invoiceNumber?: string
  invoiceDueDate?: string
  invoiceComment?: string
  packageId?: Id
  settlementMethod?: 'on_credit'
}
