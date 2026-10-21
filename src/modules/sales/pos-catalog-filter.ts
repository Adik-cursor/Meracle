import type { Product } from '../../core/types'

export type PosCategoryFilter = 'all' | 'uncategorized' | string

export function productBarcode(product: Product): string {
  const record = product as Product & { barcode?: string }
  return record.barcode?.trim() ?? ''
}

export function matchesPosSearch(product: Product, query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (!needle) {
    return true
  }
  return (
    product.name.toLowerCase().includes(needle) ||
    product.sku.toLowerCase().includes(needle) ||
    productBarcode(product).toLowerCase().includes(needle)
  )
}

export function matchesPosCategory(
  product: Product,
  categoryId: PosCategoryFilter,
): boolean {
  if (categoryId === 'all') {
    return true
  }
  if (categoryId === 'uncategorized') {
    return !product.categoryId
  }
  return product.categoryId === categoryId
}

export function filterPosCatalog(
  products: Product[],
  query: string,
  categoryId: PosCategoryFilter,
): Product[] {
  return products.filter(
    (product) =>
      matchesPosCategory(product, categoryId) && matchesPosSearch(product, query),
  )
}
