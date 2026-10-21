import type { Id, User, Warehouse, WarehouseStatus } from '../types'
import { fail, ok, okVoid, type ServiceResult } from '../types/domain-error'
import type { Persistence } from '../repositories/persistence'
import { belongsToOrganization } from './catalog'
import {
  canAccessWarehouse,
  canAccessWarehouseBranch,
  canReadWarehouseAnalytics,
  requireAccessibleWarehouse,
} from './warehouse-access'
import { hasEffectiveWarehousePermission, requireActorInOrganization, requireCurrentUser } from './access'
import { nowIso, newId, optionalText } from './primitives'
import { requireModuleEnabledForUser } from './organization-modules'

export type WarehouseWrite = {
  name: string
  description?: string
  address?: string
  status: WarehouseStatus
  branchId: Id
}

function requireWarehouse(
  persistence: Persistence,
  organizationId: Id,
  id: Id,
): ServiceResult<Warehouse> {
  const warehouse = persistence.warehouses.getById(id)

  if (!warehouse) {
    return fail({ code: 'WAREHOUSE_NOT_FOUND' })
  }

  if (!belongsToOrganization(warehouse, organizationId)) {
    return fail({ code: 'ORGANIZATION_MISMATCH' })
  }

  return ok(warehouse)
}

function requireOrgBranch(
  persistence: Persistence,
  organizationId: Id,
  branchId: Id,
): ServiceResult {
  const trimmed = branchId.trim()
  if (!trimmed) {
    return fail({ code: 'INVALID_INPUT' })
  }

  const branch = persistence.branches.getById(trimmed)

  if (!branch) {
    return fail({ code: 'BRANCH_NOT_FOUND' })
  }

  if (!belongsToOrganization(branch, organizationId)) {
    return fail({ code: 'BRANCH_ORGANIZATION_MISMATCH' })
  }

  return okVoid()
}

function normalizeWrite(
  persistence: Persistence,
  organizationId: Id,
  draft: WarehouseWrite,
): ServiceResult<WarehouseWrite> {
  const name = draft.name.trim()
  const branchId = draft.branchId.trim()

  if (!name || !branchId) {
    return fail({ code: 'INVALID_INPUT' })
  }

  const branch = requireOrgBranch(persistence, organizationId, branchId)
  if (!branch.ok) {
    return branch
  }

  return ok({
    name,
    description: optionalText(draft.description),
    address: optionalText(draft.address),
    status: draft.status,
    branchId,
  })
}

export function createWarehouse(
  persistence: Persistence,
  organizationId: Id,
  draft: WarehouseWrite,
): ServiceResult<Warehouse> {
  const normalized = normalizeWrite(persistence, organizationId, draft)
  if (!normalized.ok) {
    return normalized
  }

  const now = nowIso()
  const warehouse: Warehouse = {
    id: newId(),
    organizationId,
    ...normalized.value,
    createdAt: now,
    updatedAt: now,
  }

  return ok(persistence.warehouses.create(warehouse))
}

export function updateWarehouse(
  persistence: Persistence,
  organizationId: Id,
  id: Id,
  draft: WarehouseWrite,
): ServiceResult<Warehouse> {
  const existing = requireWarehouse(persistence, organizationId, id)
  if (!existing.ok) {
    return existing
  }

  const normalized = normalizeWrite(persistence, organizationId, draft)
  if (!normalized.ok) {
    return normalized
  }

  const updated = persistence.warehouses.update(id, {
    ...normalized.value,
    updatedAt: nowIso(),
  })

  if (!updated) {
    return fail({ code: 'WAREHOUSE_NOT_FOUND' })
  }

  return ok(updated)
}

export function setWarehouseStatus(
  persistence: Persistence,
  organizationId: Id,
  id: Id,
  status: WarehouseStatus,
): ServiceResult {
  const existing = requireWarehouse(persistence, organizationId, id)
  if (!existing.ok) {
    return existing
  }

  const updated = persistence.warehouses.update(id, {
    status,
    updatedAt: nowIso(),
  })

  if (!updated) {
    return fail({ code: 'WAREHOUSE_NOT_FOUND' })
  }

  return okVoid()
}

export function listWarehousesForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
): ServiceResult<Warehouse[]> {
  const actor = requireModuleEnabledForUser(persistence, currentUser, 'warehouse')
  if (!actor.ok) {
    return actor
  }

  return ok(
    persistence.warehouses
      .list(actor.value.organizationId)
      .filter((warehouse) => canAccessWarehouse(actor.value, warehouse).ok),
  )
}

export function getWarehouseForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  warehouseId: Id,
): ServiceResult<Warehouse> {
  const gated = requireModuleEnabledForUser(persistence, currentUser, 'warehouse')
  if (!gated.ok) {
    return gated
  }

  return requireAccessibleWarehouse(persistence, currentUser, warehouseId)
}

export function listWarehousesForAnalytics(
  persistence: Persistence,
  currentUser: User | null | undefined,
): ServiceResult<Warehouse[]> {
  const actor = requireCurrentUser(currentUser)
  if (!actor.ok) {
    return actor
  }

  return ok(
    persistence.warehouses
      .list(actor.value.organizationId)
      .filter(
        (warehouse) => canReadWarehouseAnalytics(actor.value, warehouse).ok,
      ),
  )
}

function requireWarehouseManager(
  currentUser: User | null | undefined,
  organizationId: Id,
  branchId: Id,
): ServiceResult<User> {
  const actor = requireActorInOrganization(currentUser, organizationId)
  if (!actor.ok) {
    return actor
  }

  if (!hasEffectiveWarehousePermission(actor.value, 'warehouses.manage')) {
    return fail({ code: 'ACCESS_DENIED' })
  }

  const branchAccess = canAccessWarehouseBranch(
    actor.value,
    organizationId,
    branchId,
  )
  if (!branchAccess.ok) {
    return branchAccess
  }

  return actor
}

export function createWarehouseForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  organizationId: Id,
  draft: WarehouseWrite,
): ServiceResult<Warehouse> {
  const gated = requireModuleEnabledForUser(persistence, currentUser, 'warehouse')
  if (!gated.ok) {
    return gated
  }

  const allowed = requireWarehouseManager(
    currentUser,
    organizationId,
    draft.branchId,
  )
  if (!allowed.ok) {
    return allowed
  }

  return createWarehouse(persistence, organizationId, draft)
}

export function updateWarehouseForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  organizationId: Id,
  id: Id,
  draft: WarehouseWrite,
): ServiceResult<Warehouse> {
  const existing = getWarehouseForUser(persistence, currentUser, id)
  if (!existing.ok) {
    return existing
  }

  const allowed = requireWarehouseManager(
    currentUser,
    organizationId,
    draft.branchId,
  )
  if (!allowed.ok) {
    return allowed
  }

  return updateWarehouse(persistence, organizationId, id, draft)
}

export function setWarehouseStatusForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  organizationId: Id,
  id: Id,
  status: WarehouseStatus,
): ServiceResult {
  const existing = getWarehouseForUser(persistence, currentUser, id)
  if (!existing.ok) {
    return existing
  }

  const allowed = requireWarehouseManager(
    currentUser,
    organizationId,
    existing.value.branchId,
  )
  if (!allowed.ok) {
    return allowed
  }

  return setWarehouseStatus(persistence, organizationId, id, status)
}
