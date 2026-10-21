import type { BaseEntity, Id } from './common'

export type StockWriteoffStatus =
  | 'draft'
  | 'confirmed'
  | 'cancelled'
  | 'completed'

export type StockWriteoff = BaseEntity & {
  warehouseId: Id
  status: StockWriteoffStatus
  reason?: string
  note?: string
}
