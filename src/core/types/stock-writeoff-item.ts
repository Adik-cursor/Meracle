import type { BaseEntity, Id } from './common'

export type StockWriteoffItem = BaseEntity & {
  writeoffId: Id
  warehouseId: Id
  productId: Id
  quantity: number
}
