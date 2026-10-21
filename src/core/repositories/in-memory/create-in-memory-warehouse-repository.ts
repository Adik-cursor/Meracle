import type { Warehouse } from '../../types'
import type { WarehouseRepository } from '../warehouse-repository'
import { createInMemoryEntityRepository } from './in-memory-entity-repository'

export function createInMemoryWarehouseRepository(
  onChange: () => void,
): WarehouseRepository & {
  snapshot: () => Warehouse[]
  restore: (items: Warehouse[]) => void
} {
  const inner = createInMemoryEntityRepository<Warehouse>(onChange, 'end')

  return {
    getById: inner.getById,
    list: inner.list,
    create: inner.create,
    update: inner.update,
    listByBranch: (organizationId, branchId) =>
      inner
        .list(organizationId)
        .filter((warehouse) => warehouse.branchId === branchId),
    snapshot: inner.snapshot,
    restore: inner.restore,
  }
}
