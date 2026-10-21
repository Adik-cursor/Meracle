import type { StockWriteoffItem } from '../../types'
import type { StockWriteoffItemRepository } from '../stock-writeoff-item-repository'
import { createInMemoryEntityRepository } from './in-memory-entity-repository'

export function createInMemoryStockWriteoffItemRepository(
  onChange: () => void,
): StockWriteoffItemRepository & {
  snapshot: () => StockWriteoffItem[]
  restore: (items: StockWriteoffItem[]) => void
} {
  const base = createInMemoryEntityRepository<StockWriteoffItem>(onChange)

  return {
    ...base,
    listByWriteoffId: (writeoffId) =>
      base.store.list().filter((item) => item.writeoffId === writeoffId),
  }
}
