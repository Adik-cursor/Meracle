import type { Product } from '../types'
import { filterPosCatalog } from '../../modules/sales/pos-catalog-filter'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function product(partial: Partial<Product> & Pick<Product, 'id' | 'name' | 'sku'>): Product {
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
  }
}

export function runSalesPosCategoriesChecks(): void {
  const products = [
    product({ id: 'p1', name: 'Имплант', sku: 'IMP-1', categoryId: 'implants' }),
    product({ id: 'p2', name: 'Абатмент', sku: 'AB-1', categoryId: 'abutments' }),
    product({ id: 'p3', name: 'Legacy', sku: 'LEG-1' }),
  ]
  assert(filterPosCatalog(products, '', 'all').length === 3, 'all categories')
  assert(
    filterPosCatalog(products, '', 'implants').map((item) => item.id).join() === 'p1',
    'one category',
  )
  assert(
    filterPosCatalog(products, '', 'uncategorized').map((item) => item.id).join() === 'p3',
    'legacy uncategorized',
  )
  assert(
    filterPosCatalog(products, 'ab', 'abutments').map((item) => item.id).join() === 'p2',
    'category with search',
  )
  assert(filterPosCatalog(products, 'imp', 'abutments').length === 0, 'search intersects category')
  console.log('sales-pos-categories.verify: ok')
}

runSalesPosCategoriesChecks()
