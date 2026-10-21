import type { Id, StockWriteoff, User } from '../types'
import { fail, ok, type ServiceResult } from '../types/domain-error'
import type { Persistence } from '../repositories/persistence'
import { applyStockDeltas } from './inventory'
import { isPositiveQuantity, nowIso } from './primitives'
import {
  aggregateProductQuantities,
  requireProductInWarehouse,
  requireWarehouse,
} from './stock-documents'
import { createMovements } from './stock-movements'
import { requireActorInOrganization } from './access'
import { requireModuleEnabledForUser } from './organization-modules'
import {
  canCompleteWriteoff as canCompleteWriteoffAccess,
  requireAccessibleWarehouse,
} from './warehouse-access'

function canCompleteWriteoff(status: StockWriteoff['status']): boolean {
  return status === 'draft' || status === 'confirmed'
}

export function completeWriteoff(
  persistence: Persistence,
  organizationId: Id,
  writeoffId: Id,
): ServiceResult<StockWriteoff> {
  const writeoff = persistence.stockWriteoffs.getById(writeoffId)
  const lockKey = `completeWriteoff:${writeoffId}`

  if (!writeoff) {
    return fail({ code: 'WRITEOFF_NOT_FOUND' })
  }

  if (writeoff.organizationId !== organizationId) {
    return fail({ code: 'ORGANIZATION_MISMATCH' })
  }

  if (writeoff.status === 'completed') {
    return ok(writeoff)
  }

  if (!persistence.locks.tryAcquire(lockKey)) {
    return fail({ code: 'INVALID_INPUT' })
  }

  try {
    return persistence.runInTransaction(
    () => {
      if (!canCompleteWriteoff(writeoff.status)) {
        return fail({ code: 'INVALID_INPUT' })
      }

      const warehouseCheck = requireWarehouse(
        persistence,
        organizationId,
        writeoff.warehouseId,
      )
      if (!warehouseCheck.ok) {
        return warehouseCheck
      }

      const items = persistence.stockWriteoffItems.listByWriteoffId(writeoffId)
      if (items.length === 0) {
        return fail({ code: 'INVALID_INPUT' })
      }

      for (const item of items) {
        if (item.organizationId !== organizationId) {
          return fail({
            code: 'ORGANIZATION_MISMATCH',
            productId: item.productId,
          })
        }

        if (item.warehouseId !== writeoff.warehouseId) {
          return fail({
            code: 'WAREHOUSE_NOT_FOUND',
            warehouseId: item.warehouseId,
            productId: item.productId,
          })
        }

        if (!isPositiveQuantity(item.quantity)) {
          return fail({
            code: 'INVALID_QUANTITY',
            warehouseId: item.warehouseId,
            productId: item.productId,
            requestedQuantity: item.quantity,
          })
        }

        const catalogCheck = requireProductInWarehouse(
          persistence,
          organizationId,
          item.warehouseId,
          item.productId,
        )
        if (!catalogCheck.ok) {
          return catalogCheck
        }

        const stock = persistence.inventory.getByWarehouseAndProduct(
          organizationId,
          item.warehouseId,
          item.productId,
        )

        if (!stock || stock.organizationId !== organizationId) {
          return fail({
            code: 'INSUFFICIENT_STOCK',
            warehouseId: item.warehouseId,
            productId: item.productId,
            requestedQuantity: item.quantity,
            availableQuantity: 0,
          })
        }
      }

      const updates = aggregateProductQuantities(items).map((item) => ({
        warehouseId: item.warehouseId,
        productId: item.productId,
        delta: -item.quantity,
      }))

      for (const update of updates) {
        const stock = persistence.inventory.getByWarehouseAndProduct(
          organizationId,
          update.warehouseId,
          update.productId,
        )
        const available = stock?.quantity ?? 0

        if (available < -update.delta) {
          return fail({
            code: 'INSUFFICIENT_STOCK',
            warehouseId: update.warehouseId,
            productId: update.productId,
            requestedQuantity: -update.delta,
            availableQuantity: available,
          })
        }
      }

      const applied = applyStockDeltas(persistence, organizationId, updates)
      if (!applied.ok) {
        return applied
      }

      const moved = createMovements(
        persistence,
        organizationId,
        organizationId,
        items.map((item) => ({
          warehouseId: item.warehouseId,
          productId: item.productId,
          type: 'shipment' as const,
          quantity: item.quantity,
          note: writeoff.id,
        })),
      )
      if (!moved.ok) {
        return moved
      }

      const updated = persistence.stockWriteoffs.update(writeoffId, {
        status: 'completed',
        updatedAt: nowIso(),
      })

      if (!updated) {
        return fail({ code: 'WRITEOFF_NOT_FOUND' })
      }

      return ok(updated)
    },
    {
      onRollback: () => persistence.locks.release(lockKey),
    },
  )
  } finally {
    persistence.locks.release(lockKey)
  }
}

export function completeWriteoffForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  organizationId: Id,
  writeoffId: Id,
): ServiceResult<StockWriteoff> {
  const gated = requireModuleEnabledForUser(persistence, currentUser, 'warehouse')
  if (!gated.ok) {
    return gated
  }

  const actor = requireActorInOrganization(currentUser, organizationId)
  if (!actor.ok) {
    return actor
  }

  const writeoff = persistence.stockWriteoffs.getById(writeoffId)
  if (!writeoff) {
    return fail({ code: 'WRITEOFF_NOT_FOUND' })
  }

  const warehouse = requireAccessibleWarehouse(
    persistence,
    actor.value,
    writeoff.warehouseId,
  )
  if (!warehouse.ok) {
    return warehouse
  }

  const allowed = canCompleteWriteoffAccess(actor.value, warehouse.value)
  if (!allowed.ok) {
    return allowed
  }

  return completeWriteoff(persistence, organizationId, writeoffId)
}
