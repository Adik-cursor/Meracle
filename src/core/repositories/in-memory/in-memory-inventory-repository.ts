import type { Id, InventoryItem, NonNegativeQuantity } from '../../types'
import type { InventoryDelta } from '../inventory-delta'
import type { InventoryRepository } from '../inventory-repository'
import { createInMemoryEntityRepository } from './in-memory-entity-repository'

function stockKey(warehouseId: Id, productId: Id): string {
  return `${warehouseId}:${productId}`
}

export function createInMemoryInventoryRepository(
  onChange: () => void,
  createId: () => string,
  now: () => string,
): InventoryRepository & {
  snapshot: () => InventoryItem[]
  restore: (items: InventoryItem[]) => void
} {
  const base = createInMemoryEntityRepository<InventoryItem>(onChange, 'end')

  const getByWarehouseAndProduct = (
    organizationId: Id,
    warehouseId: Id,
    productId: Id,
  ) =>
    base
      .list(organizationId)
      .find(
        (item) =>
          item.warehouseId === warehouseId && item.productId === productId,
      )

  const applyDeltas = (
    organizationId: Id,
    updates: InventoryDelta[],
  ): boolean => {
    if (updates.length === 0) {
      return false
    }

    const seen = new Set<string>()

    for (const update of updates) {
      const key = stockKey(update.warehouseId, update.productId)

      if (seen.has(key)) {
        return false
      }

      seen.add(key)

      if (!Number.isFinite(update.delta) || update.delta === 0) {
        return false
      }
    }

    const snapshot = base.snapshot()
    const timestamp = now()

    for (const update of updates) {
      const existing = snapshot.find(
        (item) =>
          item.organizationId === organizationId &&
          item.warehouseId === update.warehouseId &&
          item.productId === update.productId,
      )

      if (existing) {
        const quantity = existing.quantity + update.delta

        if (quantity < 0) {
          return false
        }

        existing.quantity = quantity
        existing.updatedAt = timestamp
        continue
      }

      if (update.delta < 0) {
        return false
      }

      snapshot.push({
        id: createId(),
        organizationId,
        warehouseId: update.warehouseId,
        productId: update.productId,
        quantity: update.delta,
        unitCost: 0,
        reservedQuantity: 0 as NonNegativeQuantity,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
    }

    base.restore(snapshot)
    return true
  }

  return {
    ...base,
    getByWarehouseAndProduct,
    applyDeltas,
  }
}
