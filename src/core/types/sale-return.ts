import type { BaseEntity, Id } from './common'

export type SaleReturnStatus = 'draft' | 'completed' | 'cancelled'

export type SaleReturn = BaseEntity & {
  saleId: Id
  warehouseId?: Id
  customerId?: string
  status: SaleReturnStatus
  total: number
  reason?: string
  note?: string
}
