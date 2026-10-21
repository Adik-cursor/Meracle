import type { BaseEntity, Id } from './common'

export type StockReceiptItem = BaseEntity & {
  receiptId: Id
  warehouseId: Id
  productId: Id
  quantity: number
  unitCost: number
  total: number
}
