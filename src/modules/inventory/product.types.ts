import type { Product, ProductItemType, ProductStatus } from '../../core/types'

export type ProductDraft = Pick<
  Product,
  'name' | 'sku' | 'unit' | 'status' | 'itemType' | 'basePrice' | 'costPrice'
> & {
  description?: string
  warehouseId?: string
  initialQuantity?: number
  categoryId?: string
  imageUrl?: string
}

export type ProductFormMode = 'create' | 'edit'

export type { Product, ProductItemType, ProductStatus }
