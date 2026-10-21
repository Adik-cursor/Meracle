import type { Id, User } from '../types'
import { fail, okVoid, type ServiceResult } from '../types/domain-error'
import type { Persistence } from '../repositories/persistence'
import { catalogExists } from './catalog'
import { applyStockDeltas } from './inventory'
import { isPositiveQuantity, nowIso } from './primitives'
import { requireActorInOrganization } from './access'
import { requireModuleEnabledForUser } from './organization-modules'
import { canCompleteTransfer } from './warehouse-access'

export function completeTransfer(
  persistence: Persistence,
  organizationId: Id,
  transferId: Id,
): boolean {
  const transfer = persistence.warehouseTransfers.getById(transferId)
  const lockKey = `completeTransfer:${transferId}`

  if (
    !transfer ||
    transfer.organizationId !== organizationId ||
    (transfer.status !== 'draft' && transfer.status !== 'pending')
  ) {
    return false
  }

  if (!persistence.locks.tryAcquire(lockKey)) {
    return false
  }

  return persistence.runInTransaction(
    () => {
      if (transfer.sourceWarehouseId === transfer.destinationWarehouseId) {
        return false
      }

      if (!isPositiveQuantity(transfer.quantity)) {
        return false
      }

      if (
        !catalogExists(
          persistence,
          organizationId,
          transfer.sourceWarehouseId,
          transfer.productId,
        ) ||
        !catalogExists(
          persistence,
          organizationId,
          transfer.destinationWarehouseId,
          transfer.productId,
        )
      ) {
        return false
      }

      const sourceStock = persistence.inventory.getByWarehouseAndProduct(
        organizationId,
        transfer.sourceWarehouseId,
        transfer.productId,
      )

      if (!sourceStock || sourceStock.quantity < transfer.quantity) {
        return false
      }

      const applied = applyStockDeltas(persistence, organizationId, [
        {
          warehouseId: transfer.sourceWarehouseId,
          productId: transfer.productId,
          delta: -transfer.quantity,
        },
        {
          warehouseId: transfer.destinationWarehouseId,
          productId: transfer.productId,
          delta: transfer.quantity,
        },
      ])

      if (!applied.ok) {
        return false
      }

      const updated = persistence.warehouseTransfers.update(transferId, {
        status: 'completed',
        updatedAt: nowIso(),
      })

      return Boolean(updated)
    },
    {
      onRollback: () => persistence.locks.release(lockKey),
    },
  )
}

export function completeTransferForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  organizationId: Id,
  transferId: Id,
): ServiceResult {
  const gated = requireModuleEnabledForUser(persistence, currentUser, 'warehouse')
  if (!gated.ok) {
    return gated
  }

  const actor = requireActorInOrganization(currentUser, organizationId)
  if (!actor.ok) {
    return actor
  }

  const transfer = persistence.warehouseTransfers.getById(transferId)
  if (!transfer) {
    return fail({ code: 'TRANSFER_NOT_FOUND' })
  }

  if (transfer.organizationId !== organizationId) {
    return fail({ code: 'ORGANIZATION_MISMATCH' })
  }

  const source = persistence.warehouses.getById(transfer.sourceWarehouseId)
  const destination = persistence.warehouses.getById(
    transfer.destinationWarehouseId,
  )
  if (!source || !destination) {
    return fail({ code: 'WAREHOUSE_NOT_FOUND' })
  }

  const allowed = canCompleteTransfer(actor.value, source, destination)
  if (!allowed.ok) {
    return allowed
  }

  return completeTransfer(persistence, organizationId, transferId)
    ? okVoid()
    : fail({ code: 'INVALID_INPUT' })
}
