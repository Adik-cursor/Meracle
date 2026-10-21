import type { StockReceipt } from '../../types'
import type { StockReceiptRepository } from '../stock-receipt-repository'
import { createInMemoryEntityRepository } from './in-memory-entity-repository'

export function createInMemoryStockReceiptRepository(
  onChange: () => void,
): StockReceiptRepository & {
  snapshot: () => StockReceipt[]
  restore: (items: StockReceipt[]) => void
} {
  const base = createInMemoryEntityRepository<StockReceipt>(onChange)

  return {
    ...base,
    listByWarehouse: (organizationId, warehouseId) =>
      base
        .list(organizationId)
        .filter((item) => item.warehouseId === warehouseId),
  }
}
