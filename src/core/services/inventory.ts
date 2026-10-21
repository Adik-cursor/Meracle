import type { Id, InventoryItem, NonNegativeQuantity, User } from '../types'
import { fail, ok, okVoid, type ServiceResult } from '../types/domain-error'
import type { InventoryDelta } from '../repositories/inventory-delta'
import type { Persistence } from '../repositories/persistence'
import { catalogExists } from './catalog'
import { isNonNegativeQuantity, newId, nowIso } from './primitives'
import {
  canReadWarehouseAnalytics,
  requireWarehousePermissionById,
} from './warehouse-access'
import { requireModuleEnabledForUser } from './organization-modules'

function stockKey(warehouseId: Id, productId: Id): string {
  return `${warehouseId}:${productId}`
}

export function setStock(
  persistence: Persistence,
  organizationId: Id,
  warehouseId: Id,
  productId: Id,
  quantity: number,
  unitCost?: number,
): ServiceResult<InventoryItem> {
  if (!isNonNegativeQuantity(quantity)) {
    return fail({
      code: 'INVALID_QUANTITY',
      warehouseId,
      productId,
      requestedQuantity: quantity,
    })
  }

  if (!catalogExists(persistence, organizationId, warehouseId, productId)) {
    const warehouse = persistence.warehouses.getById(warehouseId)
    if (!warehouse || warehouse.organizationId !== organizationId) {
      return fail({ code: 'WAREHOUSE_NOT_FOUND', warehouseId, productId })
    }

    return fail({ code: 'PRODUCT_NOT_FOUND', warehouseId, productId })
  }

  const existing = persistence.inventory.getByWarehouseAndProduct(
    organizationId,
    warehouseId,
    productId,
  )
  const now = nowIso()

  if (existing) {
    if (existing.organizationId !== organizationId) {
      return fail({ code: 'ORGANIZATION_MISMATCH' })
    }

    const nextUnitCost =
      unitCost !== undefined && Number.isFinite(unitCost) && unitCost >= 0
        ? unitCost
        : existing.unitCost
    const updated = persistence.inventory.update(existing.id, {
      quantity,
      unitCost: nextUnitCost,
      updatedAt: now,
    })

    if (!updated) {
      return fail({ code: 'INVALID_INPUT' })
    }

    return ok(updated)
  }

  const duplicate = persistence.inventory
    .list(organizationId)
    .find(
      (item) => item.warehouseId === warehouseId && item.productId === productId,
    )

  if (duplicate) {
    return fail({ code: 'DUPLICATE_INVENTORY', warehouseId, productId })
  }

  const item: InventoryItem = {
    id: newId(),
    organizationId,
    warehouseId,
    productId,
    quantity,
    unitCost:
      unitCost !== undefined && Number.isFinite(unitCost) && unitCost >= 0
        ? unitCost
        : 0,
    reservedQuantity: 0 as NonNegativeQuantity,
    createdAt: now,
    updatedAt: now,
  }

  return ok(persistence.inventory.create(item))
}

export function applyStockDeltas(
  persistence: Persistence,
  organizationId: Id,
  updates: InventoryDelta[],
): ServiceResult {
  if (updates.length === 0) {
    return fail({ code: 'INVALID_QUANTITY' })
  }

  const seen = new Set<string>()

  for (const update of updates) {
    const key = stockKey(update.warehouseId, update.productId)

    if (seen.has(key)) {
      return fail({
        code: 'DUPLICATE_INVENTORY',
        warehouseId: update.warehouseId,
        productId: update.productId,
      })
    }

    seen.add(key)

    if (!Number.isFinite(update.delta) || update.delta === 0) {
      return fail({
        code: 'INVALID_QUANTITY',
        warehouseId: update.warehouseId,
        productId: update.productId,
        requestedQuantity: update.delta,
      })
    }

    if (
      !catalogExists(
        persistence,
        organizationId,
        update.warehouseId,
        update.productId,
      )
    ) {
      return fail({
        code: 'PRODUCT_NOT_FOUND',
        warehouseId: update.warehouseId,
        productId: update.productId,
      })
    }

    const current = persistence.inventory.getByWarehouseAndProduct(
      organizationId,
      update.warehouseId,
      update.productId,
    )
    const nextQuantity = (current?.quantity ?? 0) + update.delta

    if (nextQuantity < 0) {
      return fail({
        code: 'INSUFFICIENT_STOCK',
        warehouseId: update.warehouseId,
        productId: update.productId,
        requestedQuantity: Math.abs(update.delta),
        availableQuantity: current?.quantity ?? 0,
      })
    }
  }

  if (!persistence.inventory.applyDeltas(organizationId, updates)) {
    return fail({ code: 'INSUFFICIENT_STOCK' })
  }

  return okVoid()
}

export function listInventoryForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  warehouseId: Id,
): ServiceResult<InventoryItem[]> {
  const gated = requireModuleEnabledForUser(persistence, currentUser, 'warehouse')
  if (!gated.ok) {
    return gated
  }

  const warehouse = requireWarehousePermissionById(
    persistence,
    currentUser,
    warehouseId,
    'inventory.read',
  )
  if (!warehouse.ok) {
    return warehouse
  }

  return ok(
    persistence.inventory
      .list(warehouse.value.organizationId)
      .filter((item) => item.warehouseId === warehouseId),
  )
}

export function getInventoryForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  warehouseId: Id,
): ServiceResult<InventoryItem[]> {
  return listInventoryForUser(persistence, currentUser, warehouseId)
}

export function listAccessibleInventoryForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
): ServiceResult<InventoryItem[]> {
  const gated = requireModuleEnabledForUser(persistence, currentUser, 'warehouse')
  if (!gated.ok) {
    return gated
  }

  if (!currentUser) {
    return fail({ code: 'CURRENT_USER_REQUIRED' })
  }

  const items: InventoryItem[] = []

  for (const item of persistence.inventory.list(currentUser.organizationId)) {
    const allowed = requireWarehousePermissionById(
      persistence,
      currentUser,
      item.warehouseId,
      'inventory.read',
    )
    if (allowed.ok) {
      items.push(item)
    }
  }

  return ok(items)
}

export function listInventoryForAnalytics(
  persistence: Persistence,
  currentUser: User | null | undefined,
): ServiceResult<InventoryItem[]> {
  if (!currentUser) {
    return fail({ code: 'CURRENT_USER_REQUIRED' })
  }

  const items: InventoryItem[] = []

  for (const item of persistence.inventory.list(currentUser.organizationId)) {
    const warehouse = persistence.warehouses.getById(item.warehouseId)
    if (warehouse && canReadWarehouseAnalytics(currentUser, warehouse).ok) {
      items.push(item)
    }
  }

  return ok(items)
}

export function setStockForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  organizationId: Id,
  warehouseId: Id,
  productId: Id,
  quantity: number,
): ServiceResult<InventoryItem> {
  const gated = requireModuleEnabledForUser(persistence, currentUser, 'warehouse')
  if (!gated.ok) {
    return gated
  }

  const allowed = requireWarehousePermissionById(
    persistence,
    currentUser,
    warehouseId,
    'inventory.adjust',
  )
  if (!allowed.ok) {
    return allowed
  }

  if (allowed.value.organizationId !== organizationId) {
    return fail({ code: 'ORGANIZATION_MISMATCH' })
  }

  return setStock(persistence, organizationId, warehouseId, productId, quantity)
}

export function applyStockDeltasForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  organizationId: Id,
  updates: InventoryDelta[],
): ServiceResult {
  const gated = requireModuleEnabledForUser(persistence, currentUser, 'warehouse')
  if (!gated.ok) {
    return gated
  }

  for (const update of updates) {
    const allowed = requireWarehousePermissionById(
      persistence,
      currentUser,
      update.warehouseId,
      'inventory.adjust',
    )
    if (!allowed.ok) {
      return allowed
    }

    if (allowed.value.organizationId !== organizationId) {
      return fail({ code: 'ORGANIZATION_MISMATCH' })
    }
  }

  return applyStockDeltas(persistence, organizationId, updates)
}
