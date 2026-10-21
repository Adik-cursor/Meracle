import type { Id, StockAuditItem } from '../types'
import type { EntityRepository } from './entity-repository'

export type StockAuditItemRepository = EntityRepository<StockAuditItem> & {
  listByAuditId: (auditId: Id) => StockAuditItem[]
}
