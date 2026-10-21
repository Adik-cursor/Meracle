import type { Id, StockAudit } from '../types'
import type { EntityRepository } from './entity-repository'

export type StockAuditRepository = EntityRepository<StockAudit> & {
  listByWarehouse: (organizationId: Id, warehouseId: Id) => StockAudit[]
}
