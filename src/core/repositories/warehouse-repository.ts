import type { Id, Warehouse } from '../types'
import type { EntityRepository } from './entity-repository'

export type WarehouseRepository = EntityRepository<Warehouse> & {
  listByBranch: (organizationId: Id, branchId: Id) => Warehouse[]
}
