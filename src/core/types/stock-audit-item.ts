import type { BaseEntity, Id } from './common'

export type StockAuditItem = BaseEntity & {
  auditId: Id
  warehouseId: Id
  productId: Id
  systemQuantity: number
  actualQuantity?: number
  difference?: number
  note?: string
}
