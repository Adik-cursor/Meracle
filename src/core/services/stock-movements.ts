import type { Id, StockMovement, User } from '../types'
import { fail, ok, type ServiceResult } from '../types/domain-error'
import type { Persistence } from '../repositories/persistence'
import { catalogExists } from './catalog'
import { isPositiveQuantity, newId, nowIso, optionalText } from './primitives'
import { requireWarehousePermissionById } from './warehouse-access'
import { requireModuleEnabledForUser } from './organization-modules'

export type MovementWrite = {
  warehouseId: Id
  productId: Id
  type: Exclude<StockMovement['type'], 'transfer'>
  quantity: number
  note?: string
}

function buildMovement(
  persistence: Persistence,
  organizationId: Id,
  createdBy: Id,
  draft: MovementWrite,
  createdAt: string,
): ServiceResult<StockMovement> {
  if (!isPositiveQuantity(draft.quantity)) {
    return fail({
      code: 'INVALID_QUANTITY',
      warehouseId: draft.warehouseId,
      productId: draft.productId,
      requestedQuantity: draft.quantity,
    })
  }

  if (!catalogExists(persistence, organizationId, draft.warehouseId, draft.productId)) {
    const warehouse = persistence.warehouses.getById(draft.warehouseId)
    if (!warehouse || warehouse.organizationId !== organizationId) {
      return fail({
        code: 'WAREHOUSE_NOT_FOUND',
        warehouseId: draft.warehouseId,
        productId: draft.productId,
      })
    }

    return fail({
      code: 'PRODUCT_NOT_FOUND',
      warehouseId: draft.warehouseId,
      productId: draft.productId,
    })
  }

  return ok({
    id: newId(),
    organizationId,
    warehouseId: draft.warehouseId,
    productId: draft.productId,
    type: draft.type,
    quantity: draft.quantity,
    createdAt,
    createdBy,
    note: optionalText(draft.note),
  })
}

export function createMovement(
  persistence: Persistence,
  organizationId: Id,
  createdBy: Id,
  draft: MovementWrite,
): ServiceResult<StockMovement> {
  const movement = buildMovement(
    persistence,
    organizationId,
    createdBy,
    draft,
    nowIso(),
  )

  if (!movement.ok) {
    return movement
  }

  return ok(persistence.stockMovements.create(movement.value))
}

export function createMovements(
  persistence: Persistence,
  organizationId: Id,
  createdBy: Id,
  drafts: MovementWrite[],
): ServiceResult<StockMovement[]> {
  if (drafts.length === 0) {
    return fail({ code: 'INVALID_QUANTITY' })
  }

  const now = nowIso()
  const movements: StockMovement[] = []

  for (const draft of drafts) {
    const movement = buildMovement(
      persistence,
      organizationId,
      createdBy,
      draft,
      now,
    )

    if (!movement.ok) {
      return movement
    }

    movements.push(movement.value)
  }

  if (!persistence.stockMovements.createMany(movements)) {
    return fail({ code: 'INVALID_INPUT' })
  }

  return ok(movements)
}

export function listMovementsForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  warehouseId: Id,
): ServiceResult<StockMovement[]> {
  const gated = requireModuleEnabledForUser(persistence, currentUser, 'warehouse')
  if (!gated.ok) {
    return gated
  }

  const warehouse = requireWarehousePermissionById(
    persistence,
    currentUser,
    warehouseId,
    'movements.read',
  )
  if (!warehouse.ok) {
    return warehouse
  }

  return ok(
    persistence.stockMovements
      .list(warehouse.value.organizationId)
      .filter((movement) => movement.warehouseId === warehouseId),
  )
}

export function listAccessibleMovementsForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
): ServiceResult<StockMovement[]> {
  const actor = requireModuleEnabledForUser(persistence, currentUser, 'warehouse')
  if (!actor.ok) {
    return actor
  }

  const movements: StockMovement[] = []

  for (const movement of persistence.stockMovements.list(
    actor.value.organizationId,
  )) {
    const allowed = requireWarehousePermissionById(
      persistence,
      actor.value,
      movement.warehouseId,
      'movements.read',
    )
    if (allowed.ok) {
      movements.push(movement)
    }
  }

  return ok(movements)
}

export function createMovementForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  organizationId: Id,
  createdBy: Id,
  draft: MovementWrite,
): ServiceResult<StockMovement> {
  const gated = requireModuleEnabledForUser(persistence, currentUser, 'warehouse')
  if (!gated.ok) {
    return gated
  }

  const allowed = requireWarehousePermissionById(
    persistence,
    currentUser,
    draft.warehouseId,
    'inventory.adjust',
  )
  if (!allowed.ok) {
    return allowed
  }

  if (allowed.value.organizationId !== organizationId) {
    return fail({ code: 'ORGANIZATION_MISMATCH' })
  }

  return createMovement(persistence, organizationId, createdBy, draft)
}

export function createMovementsForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  organizationId: Id,
  createdBy: Id,
  drafts: MovementWrite[],
): ServiceResult<StockMovement[]> {
  const gated = requireModuleEnabledForUser(persistence, currentUser, 'warehouse')
  if (!gated.ok) {
    return gated
  }

  for (const draft of drafts) {
    const allowed = requireWarehousePermissionById(
      persistence,
      currentUser,
      draft.warehouseId,
      'inventory.adjust',
    )
    if (!allowed.ok) {
      return allowed
    }

    if (allowed.value.organizationId !== organizationId) {
      return fail({ code: 'ORGANIZATION_MISMATCH' })
    }
  }

  return createMovements(persistence, organizationId, createdBy, drafts)
}
