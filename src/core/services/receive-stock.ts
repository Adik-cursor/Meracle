import type { Id, InventoryItem, NonNegativeQuantity, User } from '../types'
import { fail, ok, type ServiceResult } from '../types/domain-error'
import type { Persistence } from '../repositories/persistence'
import { isPhysicalProduct, normalizeBasePrice } from '../types/product'
import { applyStockDeltas } from './inventory'
import { isPositiveQuantity, newId, nowIso, optionalText } from './primitives'
import { createMovements } from './stock-movements'
import { requireActorInOrganization } from './access'
import { requireModuleEnabledForUser } from './organization-modules'
import {
  canCompleteReceipt,
  canCreateReceipt,
  requireAccessibleWarehouse,
} from './warehouse-access'
import { weightedAverageCost } from './weighted-average'

export type ReceiveStockWrite = {
  warehouseId: Id
  productId: Id
  quantity: number
  unitCost: number
  note?: string
}

export function applyIncomingCost(
  persistence: Persistence,
  organizationId: Id,
  warehouseId: Id,
  productId: Id,
  incomingQuantity: number,
  incomingUnitCost: number,
  previousQuantity: number,
  previousUnitCost: number,
): ServiceResult<InventoryItem> {
  const unitCost = weightedAverageCost(
    previousQuantity,
    previousUnitCost,
    incomingQuantity,
    incomingUnitCost,
  )
  const now = nowIso()

  const inventory = persistence.inventory.getByWarehouseAndProduct(
    organizationId,
    warehouseId,
    productId,
  )

  const saved = inventory
    ? persistence.inventory.update(inventory.id, {
        unitCost,
        updatedAt: now,
      })
    : persistence.inventory.create({
        id: newId(),
        organizationId,
        warehouseId,
        productId,
        quantity: previousQuantity + incomingQuantity,
        unitCost,
        reservedQuantity: 0 as NonNegativeQuantity,
        createdAt: now,
        updatedAt: now,
      })

  if (!saved) {
    return fail({ code: 'INVALID_INPUT' })
  }

  persistence.products.update(productId, {
    costPrice: unitCost,
    updatedAt: now,
  })

  return ok(saved)
}

export function receiveStockForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  organizationId: Id,
  draft: ReceiveStockWrite,
): ServiceResult<InventoryItem> {
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

  const canCreate = canCreateReceipt(actor.value, warehouse.value)
  if (!canCreate.ok) {
    return canCreate
  }

  const canComplete = canCompleteReceipt(actor.value, warehouse.value)
  if (!canComplete.ok) {
    return canComplete
  }

  const product = persistence.products.getById(draft.productId)
  if (!product || product.organizationId !== organizationId) {
    return fail({
      code: 'PRODUCT_NOT_FOUND',
      warehouseId: draft.warehouseId,
      productId: draft.productId,
    })
  }

  if (!isPhysicalProduct(product)) {
    return fail({ code: 'INVALID_INPUT' })
  }

  if (!isPositiveQuantity(draft.quantity)) {
    return fail({
      code: 'INVALID_QUANTITY',
      warehouseId: draft.warehouseId,
      productId: draft.productId,
      requestedQuantity: draft.quantity,
    })
  }

  const unitCost = normalizeBasePrice(draft.unitCost)
  const note = optionalText(draft.note)

  return persistence.runInTransaction(() => {
    const existing = persistence.inventory.getByWarehouseAndProduct(
      organizationId,
      draft.warehouseId,
      draft.productId,
    )
    const previousQuantity = existing?.quantity ?? 0
    const previousUnitCost = existing?.unitCost ?? 0

    if (existing) {
      const applied = applyStockDeltas(persistence, organizationId, [
        {
          warehouseId: draft.warehouseId,
          productId: draft.productId,
          delta: draft.quantity,
        },
      ])
      if (!applied.ok) {
        return applied
      }
    }

    const costed = applyIncomingCost(
      persistence,
      organizationId,
      draft.warehouseId,
      draft.productId,
      draft.quantity,
      unitCost,
      previousQuantity,
      previousUnitCost,
    )
    if (!costed.ok) {
      return costed
    }

    const moved = createMovements(
      persistence,
      organizationId,
      actor.value.id,
      [
        {
          warehouseId: draft.warehouseId,
          productId: draft.productId,
          type: 'receipt',
          quantity: draft.quantity,
          note: note ?? 'receipt',
        },
      ],
    )
    if (!moved.ok) {
      return moved
    }

    const receiptId = newId()
    const now = nowIso()
    persistence.stockReceipts.create({
      id: receiptId,
      organizationId,
      warehouseId: draft.warehouseId,
      status: 'completed',
      note,
      createdAt: now,
      updatedAt: now,
    })
    persistence.stockReceiptItems.create({
      id: newId(),
      organizationId,
      receiptId,
      warehouseId: draft.warehouseId,
      productId: draft.productId,
      quantity: draft.quantity,
      unitCost,
      total: draft.quantity * unitCost,
      createdAt: now,
      updatedAt: now,
    })

    return costed
  })
}
