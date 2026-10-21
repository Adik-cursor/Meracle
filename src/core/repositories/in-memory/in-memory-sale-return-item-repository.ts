import type { SaleReturnItem } from '../../types'
import type { SaleReturnItemRepository } from '../sale-return-item-repository'
import { createInMemoryEntityRepository } from './in-memory-entity-repository'

export function createInMemorySaleReturnItemRepository(
  onChange: () => void,
): SaleReturnItemRepository & {
  snapshot: () => SaleReturnItem[]
  restore: (items: SaleReturnItem[]) => void
} {
  const base = createInMemoryEntityRepository<SaleReturnItem>(onChange)

  return {
    ...base,
    listByReturnId: (returnId) =>
      base.store.list().filter((item) => item.returnId === returnId),
    replaceForReturn: (returnId, items) => {
      base.store.replaceWhere((item) => item.returnId !== returnId, items)
    },
  }
}
