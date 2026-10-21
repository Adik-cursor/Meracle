import type { Id, StockReceiptItem } from '../types'
import type { EntityRepository } from './entity-repository'

export type StockReceiptItemRepository = EntityRepository<StockReceiptItem> & {
  listByReceiptId: (receiptId: Id) => StockReceiptItem[]
}
