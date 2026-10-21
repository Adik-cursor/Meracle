import type { Id, SaleItem } from '../../types'
import type { SaleItemRepository } from '../sale-item-repository'
import { createInMemoryEntityRepository } from './in-memory-entity-repository'

export function createInMemorySaleItemRepository(
  onChange: () => void,
): SaleItemRepository & {
  snapshot: () => SaleItem[]
  restore: (items: SaleItem[]) => void
} {
  const base = createInMemoryEntityRepository<SaleItem>(onChange)

  const listBySaleId = (saleId: Id) =>
    base.store.list().filter((item) => item.saleId === saleId)

  const replaceForSale = (saleId: Id, items: SaleItem[]) => {
    base.store.replaceWhere((item) => item.saleId !== saleId, items)
  }

  return {
    ...base,
    listBySaleId,
    replaceForSale,
  }
}
