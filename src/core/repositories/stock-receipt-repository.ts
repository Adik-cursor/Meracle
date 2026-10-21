import type { Id, StockReceipt } from '../types'
import type { EntityRepository } from './entity-repository'

export type StockReceiptRepository = EntityRepository<StockReceipt> & {
  listByWarehouse: (organizationId: Id, warehouseId: Id) => StockReceipt[]
}
