import type { BaseEntity, Id } from './common'

export type StockAuditStatus =
  | 'draft'
  | 'in_progress'
  | 'completed'
  | 'cancelled'

export type StockAudit = BaseEntity & {
  warehouseId: Id
  status: StockAuditStatus
  createdBy?: Id
  completedAt?: string
  note?: string
}
