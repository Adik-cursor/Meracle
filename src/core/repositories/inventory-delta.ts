import type { Id } from '../types'

export type InventoryDelta = {
  warehouseId: Id
  productId: Id
  delta: number
}
