import type { BaseEntity, Id } from './common'

export type SaleReturnItem = BaseEntity & {
  returnId: Id
  saleItemId: Id
  warehouseId?: Id
  productId: Id
  quantity: number
  unitPrice: number
  total: number
}
