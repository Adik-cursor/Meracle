import type { Product } from '../types'
import { filterPosCatalog, matchesPosSearch } from '../../modules/sales/pos-catalog-filter'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function product(
  partial: Partial<Product> & Pick<Product, 'id' | 'name' | 'sku'>,
  barcode?: string,
): Product {
  return {
    organizationId: 'org-pos',
    unit: 'шт',
    itemType: 'product',
    basePrice: 100,
    costPrice: 50,
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...partial,
    ...(barcode ? { barcode } : {}),
  } as Product
}

export function runSalesPosSearchChecks(): void {
  const products = [
    product({ id: 'p1', name: 'Титановый имплант', sku: 'DSK-100' }),
    product({ id: 'p2', name: 'Винт', sku: 'SCR-9' }, '4601234567890'),
  ]
  assert(matchesPosSearch(products[0]!, 'имплант'), 'name')
  assert(matchesPosSearch(products[0]!, 'dsk-100'), 'sku')
  assert(matchesPosSearch(products[1]!, '4601234567890'), 'barcode if present')
  assert(filterPosCatalog(products, 'dsk', 'all').length === 1, 'sku filter')
  assert(filterPosCatalog(products, 'винт', 'all')[0]?.id === 'p2', 'name filter')
  console.log('sales-pos-search.verify: ok')
}

runSalesPosSearchChecks()
