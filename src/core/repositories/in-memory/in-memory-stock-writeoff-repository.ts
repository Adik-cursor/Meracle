import type { StockWriteoff } from '../../types'
import type { StockWriteoffRepository } from '../stock-writeoff-repository'
import { createInMemoryEntityRepository } from './in-memory-entity-repository'

export function createInMemoryStockWriteoffRepository(
  onChange: () => void,
): StockWriteoffRepository & {
  snapshot: () => StockWriteoff[]
  restore: (items: StockWriteoff[]) => void
} {
  const base = createInMemoryEntityRepository<StockWriteoff>(onChange)

  return {
    ...base,
    listByWarehouse: (organizationId, warehouseId) =>
      base
        .list(organizationId)
        .filter((item) => item.warehouseId === warehouseId),
  }
}
