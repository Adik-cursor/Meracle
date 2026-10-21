import type { Product } from '../types'
import { filterPosCatalog } from '../../modules/sales/pos-catalog-filter'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

export function runSalesPos300ProductsChecks(): void {
  const products: Product[] = []
  for (let index = 0; index < 320; index += 1) {
    products.push({
      id: `p-${index}`,
      organizationId: 'org-pos',
      name: `Товар ${index}`,
      sku: `SKU-${String(index).padStart(4, '0')}`,
      unit: 'шт',
      itemType: 'product',
      basePrice: 1000 + index,
      costPrice: 400,
      status: 'active',
      categoryId: index % 7 === 0 ? undefined : `cat-${index % 6}`,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })
  }
  const started = Date.now()
  const named = filterPosCatalog(products, 'товар 219', 'all')
  const sku = filterPosCatalog(products, 'sku-0219', 'all')
  const category = filterPosCatalog(products, '', 'cat-1')
  const elapsed = Date.now() - started
  assert(named.length === 1 && named[0]?.id === 'p-219', 'name among 300+')
  assert(sku.length === 1 && sku[0]?.id === 'p-219', 'sku among 300+')
  assert(category.length > 0 && category.every((item) => item.categoryId === 'cat-1'), 'category slice')
  assert(filterPosCatalog(products, '', 'uncategorized').length > 0, 'uncategorized among 300+')
  assert(elapsed < 250, `catalog filter stays fast (${elapsed}ms)`)
  console.log('sales-pos-300-products.verify: ok')
}

runSalesPos300ProductsChecks()
