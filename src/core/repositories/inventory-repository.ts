import type { Id, InventoryItem } from '../types'
import type { EntityRepository } from './entity-repository'
import type { InventoryDelta } from './inventory-delta'

export type InventoryRepository = EntityRepository<InventoryItem> & {
  getByWarehouseAndProduct: (
    organizationId: Id,
    warehouseId: Id,
    productId: Id,
  ) => InventoryItem | undefined
  applyDeltas: (organizationId: Id, updates: InventoryDelta[]) => boolean
}
