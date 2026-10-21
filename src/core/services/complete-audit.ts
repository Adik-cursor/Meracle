import type { Id, StockAudit, User } from '../types'
import { fail, ok, type ServiceResult } from '../types/domain-error'
import type { Persistence } from '../repositories/persistence'
import { setStock } from './inventory'
import { isNonNegativeQuantity, nowIso } from './primitives'
import { requireProductInWarehouse, requireWarehouse } from './stock-documents'
import { createMovements } from './stock-movements'
import { requireActorInOrganization } from './access'
import { requireModuleEnabledForUser } from './organization-modules'
import {
  canCompleteAudit as canCompleteAuditAccess,
  requireAccessibleWarehouse,
} from './warehouse-access'

function canCompleteAudit(status: StockAudit['status']): boolean {
  return status === 'draft' || status === 'in_progress'
}

export function completeAudit(
  persistence: Persistence,
  organizationId: Id,
  auditId: Id,
  actorId?: Id,
): ServiceResult<StockAudit> {
  const audit = persistence.stockAudits.getById(auditId)
  const lockKey = `completeAudit:${auditId}`

  if (!audit) {
    return fail({ code: 'AUDIT_NOT_FOUND' })
  }

  if (audit.organizationId !== organizationId) {
    return fail({ code: 'ORGANIZATION_MISMATCH' })
  }

  if (audit.status === 'completed') {
    return fail({ code: 'AUDIT_ALREADY_COMPLETED' })
  }

  if (!persistence.locks.tryAcquire(lockKey)) {
    return fail({ code: 'INVALID_INPUT' })
  }

  try {
    return persistence.runInTransaction(
    () => {
      if (!canCompleteAudit(audit.status)) {
        return fail({ code: 'INVALID_INPUT' })
      }

      const warehouseCheck = requireWarehouse(
        persistence,
        organizationId,
        audit.warehouseId,
      )
      if (!warehouseCheck.ok) {
        return warehouseCheck
      }

      const items = persistence.stockAuditItems.listByAuditId(auditId)
      if (items.length === 0) {
        return fail({ code: 'INVALID_INPUT' })
      }

      const seen = new Set<string>()
      const movementDrafts: {
        warehouseId: Id
        productId: Id
        type: 'adjustment'
        quantity: number
        note: string
      }[] = []

      for (const item of items) {
        if (item.organizationId !== organizationId) {
          return fail({
            code: 'ORGANIZATION_MISMATCH',
            productId: item.productId,
          })
        }

        if (item.warehouseId !== audit.warehouseId) {
          return fail({
            code: 'WAREHOUSE_NOT_FOUND',
            warehouseId: item.warehouseId,
            productId: item.productId,
          })
        }

        if (
          item.actualQuantity === undefined ||
          !isNonNegativeQuantity(item.actualQuantity)
        ) {
          return fail({
            code: 'INVALID_ACTUAL_QUANTITY',
            warehouseId: item.warehouseId,
            productId: item.productId,
            requestedQuantity: item.actualQuantity,
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

        const key = `${item.warehouseId}:${item.productId}`
        if (seen.has(key)) {
          return fail({
            code: 'DUPLICATE_INVENTORY',
            warehouseId: item.warehouseId,
            productId: item.productId,
          })
        }
        seen.add(key)

        const stock = persistence.inventory.getByWarehouseAndProduct(
          organizationId,
          item.warehouseId,
          item.productId,
        )

        if (stock && stock.organizationId !== organizationId) {
          return fail({ code: 'ORGANIZATION_MISMATCH', productId: item.productId })
        }

        const systemQuantity = stock?.quantity ?? 0
        const actualQuantity = item.actualQuantity
        const difference = actualQuantity - systemQuantity

        const updatedItem = persistence.stockAuditItems.update(item.id, {
          systemQuantity,
          actualQuantity,
          difference,
          updatedAt: nowIso(),
        })

        if (!updatedItem) {
          return fail({ code: 'AUDIT_NOT_FOUND' })
        }

        const applied = setStock(
          persistence,
          organizationId,
          item.warehouseId,
          item.productId,
          actualQuantity,
        )
        if (!applied.ok) {
          return applied
        }

        if (difference !== 0) {
          movementDrafts.push({
            warehouseId: item.warehouseId,
            productId: item.productId,
            type: 'adjustment',
            quantity: Math.abs(difference),
            note: `audit:${audit.id};before:${systemQuantity};actual:${actualQuantity};diff:${difference};after:${actualQuantity}`,
          })
        }
      }

      if (movementDrafts.length > 0) {
        const moved = createMovements(
          persistence,
          organizationId,
          actorId ?? organizationId,
          movementDrafts,
        )
        if (!moved.ok) {
          return moved
        }
      }

      const updated = persistence.stockAudits.update(auditId, {
        status: 'completed',
        completedAt: nowIso(),
        updatedAt: nowIso(),
      })

      if (!updated) {
        return fail({ code: 'AUDIT_NOT_FOUND' })
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

export function completeAuditForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  organizationId: Id,
  auditId: Id,
): ServiceResult<StockAudit> {
  const gated = requireModuleEnabledForUser(persistence, currentUser, 'warehouse')
  if (!gated.ok) {
    return gated
  }

  const actor = requireActorInOrganization(currentUser, organizationId)
  if (!actor.ok) {
    return actor
  }

  const audit = persistence.stockAudits.getById(auditId)
  if (!audit) {
    return fail({ code: 'AUDIT_NOT_FOUND' })
  }

  const warehouse = requireAccessibleWarehouse(
    persistence,
    actor.value,
    audit.warehouseId,
  )
  if (!warehouse.ok) {
    return warehouse
  }

  const allowed = canCompleteAuditAccess(actor.value, warehouse.value)
  if (!allowed.ok) {
    return fail({ code: 'FORBIDDEN' })
  }

  return completeAudit(persistence, organizationId, auditId, actor.value.id)
}
