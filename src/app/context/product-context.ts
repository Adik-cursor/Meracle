import { createContext, useContext } from 'react'
import type { Id, Product, ProductStatus } from '../../core/types'
import type { ProductDraft } from '../../modules/inventory/product.types'

export type ProductContextValue = {
  products: Product[]
  createProduct: (draft: ProductDraft) => boolean
  updateProduct: (id: Id, draft: ProductDraft) => boolean
  setProductStatus: (id: Id, status: ProductStatus) => void
}

export const ProductContext = createContext<ProductContextValue | null>(null)

export function useProducts(): ProductContextValue {
  const context = useContext(ProductContext)

  if (!context) {
    throw new Error('useProducts must be used within ProductProvider')
  }

  return context
}
