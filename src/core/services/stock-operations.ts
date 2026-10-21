import type {
  Id,
  StockAudit,
  StockAuditItem,
  StockReceipt,
  StockReceiptItem,
  StockWriteoff,
  StockWriteoffItem,
  User,
} from '../types'
import { fail, ok, type ServiceResult } from '../types/domain-error'
import type { Persistence } from '../repositories/persistence'
import { catalogExists } from './catalog'
import { isPositiveQuantity, newId, nowIso } from './primitives'
import { requireActorInOrganization } from './access'
import { requireModuleEnabledForUser } from './organization-modules'
import {
  canCreateAudit,
  canCreateReceipt,
  canCreateWriteoff,
  requireAccessibleWarehouse,
} from './warehouse-access'

export type StockReceiptItemWrite = {
  productId: Id
  quantity: number
  unitCost: number
}

export type StockReceiptWrite = {
  warehouseId: Id
  note?: string
  items: StockReceiptItemWrite[]
}

export type StockWriteoffItemWrite = {
  productId: Id
  quantity: number
}

export type StockWriteoffWrite = {
  warehouseId: Id
  reason?: string
  note?: string
  items: StockWriteoffItemWrite[]
}

export type StockAuditItemWrite = {
  productId: Id
  actualQuantity: number
}

export type StockAuditWrite = {
  warehouseId: Id
  note?: string
  items: StockAuditItemWrite[]
}

export function createReceiptForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  organizationId: Id,
  draft: StockReceiptWrite,
): ServiceResult<StockReceipt> {
  const gated = requireModuleEnabledForUser(persistence, currentUser, 'warehouse')
  if (!gated.ok) {
    return gated
  }

  const actor = requireActorInOrganization(currentUser, organizationId)
  if (!actor.ok) {
    return actor
  }

  const warehouse = requireAccessibleWarehouse(
    persistence,
    actor.value,
    draft.warehouseId,
  )
  if (!warehouse.ok) {
    return warehouse
  }

  const allowed = canCreateReceipt(actor.value, warehouse.value)
  if (!allowed.ok) {
    return allowed
  }

  if (draft.items.length === 0) {
    return fail({ code: 'INVALID_INPUT' })
  }

  for (const item of draft.items) {
    if (!isPositiveQuantity(item.quantity) || item.unitCost < 0) {
      return fail({ code: 'INVALID_QUANTITY', productId: item.productId })
    }

    if (
      !catalogExists(
        persistence,
        organizationId,
        draft.warehouseId,
        item.productId,
      )
    ) {
      return fail({ code: 'PRODUCT_NOT_FOUND', productId: item.productId })
    }
  }

  const now = nowIso()
  const receipt: StockReceipt = {
    id: newId(),
    organizationId,
    warehouseId: draft.warehouseId,
    status: 'draft',
    note: draft.note,
    createdAt: now,
    updatedAt: now,
  }

  return persistence.runInTransaction(() => {
    persistence.stockReceipts.create(receipt)
    for (const item of draft.items) {
      const receiptItem: StockReceiptItem = {
        id: newId(),
        organizationId,
        receiptId: receipt.id,
        warehouseId: draft.warehouseId,
        productId: item.productId,
        quantity: item.quantity,
        unitCost: item.unitCost,
        total: item.quantity * item.unitCost,
        createdAt: now,
        updatedAt: now,
      }
      persistence.stockReceiptItems.create(receiptItem)
    }
    return ok(receipt)
  })
}

export function createWriteoffForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  organizationId: Id,
  draft: StockWriteoffWrite,
): ServiceResult<StockWriteoff> {
  const gated = requireModuleEnabledForUser(persistence, currentUser, 'warehouse')
  if (!gated.ok) {
    return gated
  }

  const actor = requireActorInOrganization(currentUser, organizationId)
  if (!actor.ok) {
    return actor
  }

  const warehouse = requireAccessibleWarehouse(
    persistence,
    actor.value,
    draft.warehouseId,
  )
  if (!warehouse.ok) {
    return warehouse
  }

  const allowed = canCreateWriteoff(actor.value, warehouse.value)
  if (!allowed.ok) {
    return allowed
  }

  if (draft.items.length === 0) {
    return fail({ code: 'INVALID_INPUT' })
  }

  for (const item of draft.items) {
    if (!isPositiveQuantity(item.quantity)) {
      return fail({ code: 'INVALID_QUANTITY', productId: item.productId })
    }

    if (
      !catalogExists(
        persistence,
        organizationId,
        draft.warehouseId,
        item.productId,
      )
    ) {
      return fail({ code: 'PRODUCT_NOT_FOUND', productId: item.productId })
    }
  }

  const now = nowIso()
  const writeoff: StockWriteoff = {
    id: newId(),
    organizationId,
    warehouseId: draft.warehouseId,
    status: 'draft',
    reason: draft.reason,
    note: draft.note,
    createdAt: now,
    updatedAt: now,
  }

  return persistence.runInTransaction(() => {
    persistence.stockWriteoffs.create(writeoff)
    for (const item of draft.items) {
      const writeoffItem: StockWriteoffItem = {
        id: newId(),
        organizationId,
        writeoffId: writeoff.id,
        warehouseId: draft.warehouseId,
        productId: item.productId,
        quantity: item.quantity,
        createdAt: now,
        updatedAt: now,
      }
      persistence.stockWriteoffItems.create(writeoffItem)
    }
    return ok(writeoff)
  })
}

export function createAuditForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  organizationId: Id,
  draft: StockAuditWrite,
): ServiceResult<StockAudit> {
  const gated = requireModuleEnabledForUser(persistence, currentUser, 'warehouse')
  if (!gated.ok) {
    return gated
  }

  const actor = requireActorInOrganization(currentUser, organizationId)
  if (!actor.ok) {
    return actor
  }

  const warehouse = requireAccessibleWarehouse(
    persistence,
    actor.value,
    draft.warehouseId,
  )
  if (!warehouse.ok) {
    return warehouse
  }

  const allowed = canCreateAudit(actor.value, warehouse.value)
  if (!allowed.ok) {
    return allowed
  }

  if (draft.items.length === 0) {
    return fail({ code: 'INVALID_INPUT' })
  }

  for (const item of draft.items) {
    if (
      !catalogExists(
        persistence,
        organizationId,
        draft.warehouseId,
        item.productId,
      )
    ) {
      return fail({ code: 'PRODUCT_NOT_FOUND', productId: item.productId })
    }
  }

  const now = nowIso()
  const audit: StockAudit = {
    id: newId(),
    organizationId,
    warehouseId: draft.warehouseId,
    status: 'in_progress',
    note: draft.note,
    createdAt: now,
    updatedAt: now,
  }

  return persistence.runInTransaction(() => {
    persistence.stockAudits.create(audit)
    for (const item of draft.items) {
      const systemQuantity =
        persistence.inventory.getByWarehouseAndProduct(
          organizationId,
          draft.warehouseId,
          item.productId,
        )?.quantity ?? 0
      const auditItem: StockAuditItem = {
        id: newId(),
        organizationId,
        auditId: audit.id,
        warehouseId: draft.warehouseId,
        productId: item.productId,
        systemQuantity,
        actualQuantity: item.actualQuantity,
        difference: item.actualQuantity - systemQuantity,
        createdAt: now,
        updatedAt: now,
      }
      persistence.stockAuditItems.create(auditItem)
    }
    return ok(audit)
  })
}
