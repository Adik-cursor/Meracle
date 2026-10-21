import type {
  Id,
  InventoryItem,
  Product,
  User,
  Warehouse,
  WarehousePermission,
} from '../types'
import { fail, ok, type ServiceResult } from '../types/domain-error'
import type { Persistence } from '../repositories/persistence'
import {
  getAccessScope,
  hasEffectiveWarehousePermission,
  getEffectiveWarehousePermissions,
  requireCurrentUser,
} from './access'

function requireActor(
  currentUser: User | null | undefined,
): ServiceResult<User> {
  return requireCurrentUser(currentUser)
}

function requireSameOrganization(
  actor: User,
  organizationId: Id,
): ServiceResult<User> {
  if (actor.organizationId !== organizationId) {
    return fail({ code: 'ORGANIZATION_MISMATCH' })
  }

  return ok(actor)
}

function requirePermission(
  actor: User,
  permission: WarehousePermission,
): ServiceResult<User> {
  if (!hasEffectiveWarehousePermission(actor, permission)) {
    return fail({ code: 'ACCESS_DENIED' })
  }

  return ok(actor)
}

function warehouseScopeError(
  actor: User,
  warehouse: Warehouse,
): ServiceResult<User> {
  if (actor.organizationId !== warehouse.organizationId) {
    return fail({ code: 'WAREHOUSE_ORGANIZATION_MISMATCH' })
  }

  const scope = getAccessScope(actor)

  if (actor.role === 'sales_employee' || scope === 'warehouse') {
    if (!actor.warehouseId) {
      return fail({ code: 'USER_WAREHOUSE_REQUIRED' })
    }

    if (actor.warehouseId !== warehouse.id) {
      return fail({ code: 'ACCESS_DENIED' })
    }

    return ok(actor)
  }

  if (scope === 'organization') {
    return ok(actor)
  }

  if (!actor.branchId || actor.branchId !== warehouse.branchId) {
    return fail({ code: 'WAREHOUSE_BRANCH_MISMATCH' })
  }

  return ok(actor)
}

function requireWarehouseAccess(
  currentUser: User | null | undefined,
  warehouse: Warehouse,
): ServiceResult<User> {
  const actor = requireActor(currentUser)
  if (!actor.ok) {
    return actor
  }

  return warehouseScopeError(actor.value, warehouse)
}

function requireWarehousePermission(
  currentUser: User | null | undefined,
  warehouse: Warehouse,
  permission: WarehousePermission,
): ServiceResult<User> {
  const access = requireWarehouseAccess(currentUser, warehouse)
  if (!access.ok) {
    return access
  }

  return requirePermission(access.value, permission)
}

export function canAccessWarehouse(
  currentUser: User | null | undefined,
  warehouse: Warehouse,
): ServiceResult<User> {
  return requireWarehouseAccess(currentUser, warehouse)
}

export function requireAccessibleWarehouse(
  persistence: Persistence,
  currentUser: User | null | undefined,
  warehouseId: Id,
): ServiceResult<Warehouse> {
  const actor = requireActor(currentUser)
  if (!actor.ok) {
    return actor
  }

  const warehouse = persistence.warehouses.getById(warehouseId)
  if (!warehouse) {
    return fail({ code: 'WAREHOUSE_NOT_FOUND' })
  }

  const access = requireWarehouseAccess(actor.value, warehouse)
  if (!access.ok) {
    return access
  }

  return ok(warehouse)
}

export function requireWarehousePermissionById(
  persistence: Persistence,
  currentUser: User | null | undefined,
  warehouseId: Id,
  permission: WarehousePermission,
): ServiceResult<Warehouse> {
  const warehouse = requireAccessibleWarehouse(
    persistence,
    currentUser,
    warehouseId,
  )
  if (!warehouse.ok) {
    return warehouse
  }

  const allowed = requireWarehousePermission(
    currentUser,
    warehouse.value,
    permission,
  )
  if (!allowed.ok) {
    return allowed
  }

  return warehouse
}

export function canAccessWarehouseBranch(
  currentUser: User | null | undefined,
  organizationId: Id,
  branchId: Id,
): ServiceResult<User> {
  const actor = requireActor(currentUser)
  if (!actor.ok) {
    return actor
  }

  const sameOrg = requireSameOrganization(actor.value, organizationId)
  if (!sameOrg.ok) {
    return sameOrg
  }

  const scope = getAccessScope(actor.value)
  if (scope === 'organization') {
    return actor
  }

  if (scope === 'own' || scope === 'warehouse') {
    return fail({ code: 'ACCESS_DENIED' })
  }

  if (actor.value.branchId && actor.value.branchId === branchId) {
    return actor
  }

  return fail({ code: 'ACCESS_DENIED' })
}

export function canReadProduct(
  currentUser: User | null | undefined,
  product: Product,
): ServiceResult<User> {
  const actor = requireActor(currentUser)
  if (!actor.ok) {
    return actor
  }

  const sameOrg = requireSameOrganization(actor.value, product.organizationId)
  if (!sameOrg.ok) {
    return sameOrg
  }

  return requirePermission(actor.value, 'products.read')
}

export function canReadInventory(
  persistence: Persistence,
  currentUser: User | null | undefined,
  inventoryItem: InventoryItem,
): ServiceResult<User> {
  const actor = requireActor(currentUser)
  if (!actor.ok) {
    return actor
  }

  const sameOrg = requireSameOrganization(
    actor.value,
    inventoryItem.organizationId,
  )
  if (!sameOrg.ok) {
    return sameOrg
  }

  const warehouse = persistence.warehouses.getById(inventoryItem.warehouseId)
  if (!warehouse) {
    return fail({ code: 'ACCESS_DENIED' })
  }

  const warehouseAccess = requireWarehouseAccess(actor.value, warehouse)
  if (!warehouseAccess.ok) {
    return warehouseAccess
  }

  return requirePermission(actor.value, 'inventory.read')
}

export function canCreateReceipt(
  currentUser: User | null | undefined,
  warehouse: Warehouse,
): ServiceResult<User> {
  return requireWarehousePermission(currentUser, warehouse, 'receipt.create')
}

export function canCompleteReceipt(
  currentUser: User | null | undefined,
  warehouse: Warehouse,
): ServiceResult<User> {
  return requireWarehousePermission(currentUser, warehouse, 'receipt.complete')
}

export function canCreateWriteoff(
  currentUser: User | null | undefined,
  warehouse: Warehouse,
): ServiceResult<User> {
  return requireWarehousePermission(currentUser, warehouse, 'writeoff.create')
}

export function canCompleteWriteoff(
  currentUser: User | null | undefined,
  warehouse: Warehouse,
): ServiceResult<User> {
  return requireWarehousePermission(currentUser, warehouse, 'writeoff.complete')
}

export function canCreateAudit(
  currentUser: User | null | undefined,
  warehouse: Warehouse,
): ServiceResult<User> {
  return requireWarehousePermission(currentUser, warehouse, 'audit.create')
}

export function canCompleteAudit(
  currentUser: User | null | undefined,
  warehouse: Warehouse,
): ServiceResult<User> {
  return requireWarehousePermission(currentUser, warehouse, 'audit.complete')
}

export function canCreateTransfer(
  currentUser: User | null | undefined,
  sourceWarehouse: Warehouse,
  destinationWarehouse: Warehouse,
): ServiceResult<User> {
  const actor = requireActor(currentUser)
  if (!actor.ok) {
    return actor
  }

  if (sourceWarehouse.organizationId !== destinationWarehouse.organizationId) {
    return fail({ code: 'ORGANIZATION_MISMATCH' })
  }

  const source = requireWarehousePermission(
    actor.value,
    sourceWarehouse,
    'transfer.create',
  )
  if (!source.ok) {
    return source
  }

  return requireWarehouseAccess(actor.value, destinationWarehouse)
}

export function canCompleteTransfer(
  currentUser: User | null | undefined,
  sourceWarehouse: Warehouse,
  destinationWarehouse: Warehouse,
): ServiceResult<User> {
  const actor = requireActor(currentUser)
  if (!actor.ok) {
    return actor
  }

  if (sourceWarehouse.organizationId !== destinationWarehouse.organizationId) {
    return fail({ code: 'ORGANIZATION_MISMATCH' })
  }

  const source = requireWarehousePermission(
    actor.value,
    sourceWarehouse,
    'transfer.complete',
  )
  if (!source.ok) {
    return source
  }

  return requireWarehouseAccess(actor.value, destinationWarehouse)
}

export function canCreateSale(
  currentUser: User | null | undefined,
  warehouse: Warehouse,
): ServiceResult<User> {
  return requireWarehousePermission(currentUser, warehouse, 'sales.create')
}

export function canCompleteSale(
  currentUser: User | null | undefined,
  warehouse: Warehouse,
): ServiceResult<User> {
  return requireWarehousePermission(currentUser, warehouse, 'sales.complete')
}

export function canCreateReturn(
  currentUser: User | null | undefined,
  warehouse: Warehouse,
): ServiceResult<User> {
  return requireWarehousePermission(currentUser, warehouse, 'returns.create')
}

export function canCompleteReturn(
  currentUser: User | null | undefined,
  warehouse: Warehouse,
): ServiceResult<User> {
  return requireWarehousePermission(currentUser, warehouse, 'returns.complete')
}

export function canReadWarehouseAnalytics(
  currentUser: User | null | undefined,
  warehouse: Warehouse,
): ServiceResult<User> {
  return requireWarehousePermission(currentUser, warehouse, 'analytics.read')
}

export function listWarehousePermissionsForUser(
  currentUser: User | null | undefined,
): ServiceResult<readonly WarehousePermission[]> {
  const actor = requireActor(currentUser)
  if (!actor.ok) {
    return actor
  }

  return ok(getEffectiveWarehousePermissions(actor.value))
}
