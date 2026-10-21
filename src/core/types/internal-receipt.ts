import type { BaseEntity, Id } from './common'
import type { PaymentMethod } from './payment'
import type { ProductItemType } from './product'

export type InternalReceiptType = 'sale' | 'return'

export type InternalReceiptItem = {
  productId: Id
  name: string
  sku: string
  itemType: ProductItemType
  quantity: number
  unitPrice: number
  discount: number
  total: number
}

export type InternalReceipt = BaseEntity & {
  receiptNumber: string
  receiptType: InternalReceiptType
  saleId: Id
  paymentId?: Id
  saleReturnId?: Id
  cashierId: Id
  warehouseId?: Id
  items: InternalReceiptItem[]
  subtotal: number
  discount: number
  total: number
  paymentMethod?: PaymentMethod
  tenderedAmount?: number
  changeAmount?: number
  bankName?: string
  terminalName?: string
  accountReference?: string
  paymentReference?: string
  paymentComment?: string
  methodDetail?: string
  comment?: string
  referenceSaleId?: Id
  referenceReceiptId?: Id
  currency: string
}
