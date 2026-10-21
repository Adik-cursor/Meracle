import type { StockReceiptItem } from '../../types'
import type { StockReceiptItemRepository } from '../stock-receipt-item-repository'
import { createInMemoryEntityRepository } from './in-memory-entity-repository'

export function createInMemoryStockReceiptItemRepository(
  onChange: () => void,
): StockReceiptItemRepository & {
  snapshot: () => StockReceiptItem[]
  restore: (items: StockReceiptItem[]) => void
} {
  const base = createInMemoryEntityRepository<StockReceiptItem>(onChange)

  return {
    ...base,
    listByReceiptId: (receiptId) =>
      base.store.list().filter((item) => item.receiptId === receiptId),
  }
}
