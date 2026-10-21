import type { Id, StockWriteoff } from '../types'
import type { EntityRepository } from './entity-repository'

export type StockWriteoffRepository = EntityRepository<StockWriteoff> & {
  listByWarehouse: (organizationId: Id, warehouseId: Id) => StockWriteoff[]
}
