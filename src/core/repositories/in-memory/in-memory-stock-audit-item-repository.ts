import type { StockAuditItem } from '../../types'
import type { StockAuditItemRepository } from '../stock-audit-item-repository'
import { createInMemoryEntityRepository } from './in-memory-entity-repository'

export function createInMemoryStockAuditItemRepository(
  onChange: () => void,
): StockAuditItemRepository & {
  snapshot: () => StockAuditItem[]
  restore: (items: StockAuditItem[]) => void
} {
  const base = createInMemoryEntityRepository<StockAuditItem>(onChange)

  return {
    ...base,
    listByAuditId: (auditId) =>
      base.store.list().filter((item) => item.auditId === auditId),
  }
}
