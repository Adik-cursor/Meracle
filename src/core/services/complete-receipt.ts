import type { Id, StockReceipt, User } from '../types'
import { fail, ok, type ServiceResult } from '../types/domain-error'
import type { Persistence } from '../repositories/persistence'
import { applyStockDeltas } from './inventory'
import { applyIncomingCost } from './receive-stock'
import { isPositiveQuantity, nowIso } from './primitives'
import {
  aggregateProductQuantities,
  requireProductInWarehouse,
  requireWarehouse,
} from './stock-documents'
import { createMovements } from './stock-movements'
import { canCompleteReceipt as canCompleteReceiptAccess, requireAccessibleWarehouse } from './warehouse-access'
import { requireActorInOrganization } from './access'
import { requireModuleEnabledForUser } from './organization-modules'

function canCompleteReceipt(status: StockReceipt['status']): boolean {
  return status === 'draft' || status === 'confirmed'
}

export function completeReceipt(
  persistence: Persistence,
  organizationId: Id,
  receiptId: Id,
): ServiceResult<StockReceipt> {
  const receipt = persistence.stockReceipts.getById(receiptId)
  const lockKey = `completeReceipt:${receiptId}`

  if (!receipt) {
    return fail({ code: 'RECEIPT_NOT_FOUND' })
  }

  if (receipt.organizationId !== organizationId) {
    return fail({ code: 'ORGANIZATION_MISMATCH' })
  }

  if (receipt.status === 'completed') {
    return ok(receipt)
  }

  if (!persistence.locks.tryAcquire(lockKey)) {
    return fail({ code: 'INVALID_INPUT' })
  }

  try {
    return persistence.runInTransaction(
    () => {
      if (!canCompleteReceipt(receipt.status)) {
        return fail({ code: 'INVALID_INPUT' })
      }

      const warehouseCheck = requireWarehouse(
        persistence,
        organizationId,
        receipt.warehouseId,
      )
      if (!warehouseCheck.ok) {
        return warehouseCheck
      }

      const items = persistence.stockReceiptItems.listByReceiptId(receiptId)
      if (items.length === 0) {
        return fail({ code: 'INVALID_INPUT' })
      }

      for (const item of items) {
        if (item.organizationId !== organizationId) {
          return fail({ code: 'ORGANIZATION_MISMATCH', productId: item.productId })
        }

        if (item.warehouseId !== receipt.warehouseId) {
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

        if (!Number.isFinite(item.unitCost) || item.unitCost < 0) {
          return fail({
            code: 'INVALID_QUANTITY',
            warehouseId: item.warehouseId,
            productId: item.productId,
            requestedQuantity: item.unitCost,
          })
        }

        if (item.total !== item.quantity * item.unitCost) {
          return fail({
            code: 'INVALID_QUANTITY',
            warehouseId: item.warehouseId,
            productId: item.productId,
            requestedQuantity: item.total,
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
      }

      const previous = items.map((item) => {
        const inventory = persistence.inventory.getByWarehouseAndProduct(
          organizationId,
          item.warehouseId,
          item.productId,
        )
        return {
          warehouseId: item.warehouseId,
          productId: item.productId,
          quantity: item.quantity,
          unitCost: item.unitCost,
          previousQuantity: inventory?.quantity ?? 0,
          previousUnitCost: inventory?.unitCost ?? 0,
        }
      })

      const updates = aggregateProductQuantities(items).map((item) => ({
        warehouseId: item.warehouseId,
        productId: item.productId,
        delta: item.quantity,
      }))

      const applied = applyStockDeltas(persistence, organizationId, updates)
      if (!applied.ok) {
        return applied
      }

      for (const item of previous) {
        const costed = applyIncomingCost(
          persistence,
          organizationId,
          item.warehouseId,
          item.productId,
          item.quantity,
          item.unitCost,
          item.previousQuantity,
          item.previousUnitCost,
        )
        if (!costed.ok) {
          return costed
        }
      }

      const moved = createMovements(
        persistence,
        organizationId,
        organizationId,
        items.map((item) => ({
          warehouseId: item.warehouseId,
          productId: item.productId,
          type: 'receipt' as const,
          quantity: item.quantity,
          note: receipt.id,
        })),
      )
      if (!moved.ok) {
        return moved
      }

      const updated = persistence.stockReceipts.update(receiptId, {
        status: 'completed',
        updatedAt: nowIso(),
      })

      if (!updated) {
        return fail({ code: 'RECEIPT_NOT_FOUND' })
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

export function completeReceiptForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  organizationId: Id,
  receiptId: Id,
): ServiceResult<StockReceipt> {
  const gated = requireModuleEnabledForUser(persistence, currentUser, 'warehouse')
  if (!gated.ok) {
    return gated
  }

  const actor = requireActorInOrganization(currentUser, organizationId)
  if (!actor.ok) {
    return actor
  }

  const receipt = persistence.stockReceipts.getById(receiptId)
  if (!receipt) {
    return fail({ code: 'RECEIPT_NOT_FOUND' })
  }

  const warehouse = requireAccessibleWarehouse(
    persistence,
    actor.value,
    receipt.warehouseId,
  )
  if (!warehouse.ok) {
    return warehouse
  }

  const allowed = canCompleteReceiptAccess(actor.value, warehouse.value)
  if (!allowed.ok) {
    return allowed
  }

  return completeReceipt(persistence, organizationId, receiptId)
}
