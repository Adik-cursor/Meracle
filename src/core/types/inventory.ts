import type { BaseEntity, Id } from './common'

export type NonNegativeQuantity = number & {
  readonly __nonNegativeQuantity: never
}

export type InventoryItem = BaseEntity & {
  warehouseId: Id
  productId: Id
  quantity: number
  unitCost: number
  reservedQuantity: NonNegativeQuantity
}
