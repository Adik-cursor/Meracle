import type { BaseEntity, Id } from './common'

export type WarehouseTransferStatus =
  | 'draft'
  | 'pending'
  | 'completed'
  | 'cancelled'

export type WarehouseTransfer = BaseEntity & {
  sourceWarehouseId: Id
  destinationWarehouseId: Id
  productId: Id
  quantity: number
  status: WarehouseTransferStatus
}
