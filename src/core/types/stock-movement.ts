import type { Id, IsoDateTime } from './common'

export type StockMovementType =
  | 'receipt'
  | 'shipment'
  | 'transfer'
  | 'adjustment'
  | 'return'

export type StockMovement = {
  id: Id
  organizationId: Id
  warehouseId: Id
  productId: Id
  type: StockMovementType
  quantity: number
  createdAt: IsoDateTime
  createdBy: Id
  note?: string
}
