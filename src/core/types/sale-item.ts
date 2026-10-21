import type { BaseEntity, Id } from './common'

export type SaleItem = BaseEntity & {
  saleId: Id
  warehouseId?: Id
  productId: Id
  quantity: number
  unitPrice: number
  discount: number
  costPrice: number
  total: number
}
