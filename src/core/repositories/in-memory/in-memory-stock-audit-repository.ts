import type { StockAudit } from '../../types'
import type { StockAuditRepository } from '../stock-audit-repository'
import { createInMemoryEntityRepository } from './in-memory-entity-repository'

export function createInMemoryStockAuditRepository(
  onChange: () => void,
): StockAuditRepository & {
  snapshot: () => StockAudit[]
  restore: (items: StockAudit[]) => void
} {
  const base = createInMemoryEntityRepository<StockAudit>(onChange)

  return {
    ...base,
    listByWarehouse: (organizationId, warehouseId) =>
      base
        .list(organizationId)
        .filter((item) => item.warehouseId === warehouseId),
  }
}
