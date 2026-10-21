import type { BaseEntity, Id } from './common'

export type StockReceiptStatus =
  | 'draft'
  | 'confirmed'
  | 'cancelled'
  | 'completed'

export type StockReceipt = BaseEntity & {
  warehouseId: Id
  status: StockReceiptStatus
  note?: string
}
