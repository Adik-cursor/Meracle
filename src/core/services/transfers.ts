import type { Id, User, WarehouseTransfer } from '../types'
import { fail, ok, type ServiceResult } from '../types/domain-error'
import type { Persistence } from '../repositories/persistence'
import { catalogExists } from './catalog'
import { isPositiveQuantity, newId, nowIso } from './primitives'
import { requireActorInOrganization } from './access'
import { requireModuleEnabledForUser } from './organization-modules'
import {
  canAccessWarehouse,
  canCompleteTransfer,
  canCreateTransfer,
} from './warehouse-access'

export type TransferWrite = {
  sourceWarehouseId: Id
  destinationWarehouseId: Id
  productId: Id
  quantity: number
}

function requireTransfer(
  persistence: Persistence,
  organizationId: Id,
  id: Id,
): ServiceResult<WarehouseTransfer> {
  const transfer = persistence.warehouseTransfers.getById(id)

  if (!transfer) {
    return fail({ code: 'TRANSFER_NOT_FOUND' })
  }

  if (transfer.organizationId !== organizationId) {
    return fail({ code: 'ORGANIZATION_MISMATCH' })
  }

  return ok(transfer)
}

export function createTransfer(
  persistence: Persistence,
  organizationId: Id,
  draft: TransferWrite,
): ServiceResult<WarehouseTransfer> {
  if (draft.sourceWarehouseId === draft.destinationWarehouseId) {
    return fail({
      code: 'TRANSFER_SAME_WAREHOUSE',
      productId: draft.productId,
    })
  }

  if (!isPositiveQuantity(draft.quantity)) {
    return fail({
      code: 'INVALID_QUANTITY',
      productId: draft.productId,
      requestedQuantity: draft.quantity,
    })
  }

  if (
    !catalogExists(
      persistence,
      organizationId,
      draft.sourceWarehouseId,
      draft.productId,
    ) ||
    !catalogExists(
      persistence,
      organizationId,
      draft.destinationWarehouseId,
      draft.productId,
    )
  ) {
    return fail({
      code: 'WAREHOUSE_NOT_FOUND',
      productId: draft.productId,
    })
  }

  const now = nowIso()
  const transfer: WarehouseTransfer = {
    id: newId(),
    organizationId,
    sourceWarehouseId: draft.sourceWarehouseId,
    destinationWarehouseId: draft.destinationWarehouseId,
    productId: draft.productId,
    quantity: draft.quantity,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  }

  return ok(persistence.warehouseTransfers.create(transfer))
}

export function submitTransfer(
  persistence: Persistence,
  organizationId: Id,
  id: Id,
): ServiceResult {
  const existing = requireTransfer(persistence, organizationId, id)
  if (!existing.ok) {
    return existing
  }

  if (existing.value.status !== 'draft') {
    return fail({ code: 'TRANSFER_INVALID_STATUS' })
  }

  const updated = persistence.warehouseTransfers.update(id, {
    status: 'pending',
    updatedAt: nowIso(),
  })

  if (!updated) {
    return fail({ code: 'TRANSFER_NOT_FOUND' })
  }

  return ok(undefined)
}

export function cancelTransfer(
  persistence: Persistence,
  organizationId: Id,
  id: Id,
): ServiceResult {
  const existing = requireTransfer(persistence, organizationId, id)
  if (!existing.ok) {
    return existing
  }

  if (
    existing.value.status !== 'draft' &&
    existing.value.status !== 'pending'
  ) {
    return fail({ code: 'TRANSFER_INVALID_STATUS' })
  }

  const updated = persistence.warehouseTransfers.update(id, {
    status: 'cancelled',
    updatedAt: nowIso(),
  })

  if (!updated) {
    return fail({ code: 'TRANSFER_NOT_FOUND' })
  }

  return ok(undefined)
}

function requireTransferWarehouses(
  persistence: Persistence,
  currentUser: User,
  sourceWarehouseId: Id,
  destinationWarehouseId: Id,
  mode: 'create' | 'complete',
): ServiceResult<User> {
  const source = persistence.warehouses.getById(sourceWarehouseId)
  const destination = persistence.warehouses.getById(destinationWarehouseId)

  if (!source || !destination) {
    return fail({ code: 'WAREHOUSE_NOT_FOUND' })
  }

  if (mode === 'create') {
    return canCreateTransfer(currentUser, source, destination)
  }

  return canCompleteTransfer(currentUser, source, destination)
}

export function listTransfersForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
): ServiceResult<WarehouseTransfer[]> {
  const actor = requireModuleEnabledForUser(persistence, currentUser, 'warehouse')
  if (!actor.ok) {
    return actor
  }

  const transfers: WarehouseTransfer[] = []
  for (const transfer of persistence.warehouseTransfers.list(
    actor.value.organizationId,
  )) {
    const source = persistence.warehouses.getById(transfer.sourceWarehouseId)
    const destination = persistence.warehouses.getById(
      transfer.destinationWarehouseId,
    )
    if (
      source &&
      destination &&
      canAccessWarehouse(actor.value, source).ok &&
      canAccessWarehouse(actor.value, destination).ok
    ) {
      transfers.push(transfer)
    }
  }

  return ok(transfers)
}

export function createTransferForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  organizationId: Id,
  draft: TransferWrite,
): ServiceResult<WarehouseTransfer> {
  const gated = requireModuleEnabledForUser(persistence, currentUser, 'warehouse')
  if (!gated.ok) {
    return gated
  }

  const actor = requireActorInOrganization(currentUser, organizationId)
  if (!actor.ok) {
    return actor
  }

  const allowed = requireTransferWarehouses(
    persistence,
    actor.value,
    draft.sourceWarehouseId,
    draft.destinationWarehouseId,
    'create',
  )
  if (!allowed.ok) {
    return allowed
  }

  return createTransfer(persistence, organizationId, draft)
}

export function submitTransferForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  organizationId: Id,
  id: Id,
): ServiceResult {
  const gated = requireModuleEnabledForUser(persistence, currentUser, 'warehouse')
  if (!gated.ok) {
    return gated
  }

  const actor = requireActorInOrganization(currentUser, organizationId)
  if (!actor.ok) {
    return actor
  }

  const existing = requireTransfer(persistence, organizationId, id)
  if (!existing.ok) {
    return existing
  }

  const allowed = requireTransferWarehouses(
    persistence,
    actor.value,
    existing.value.sourceWarehouseId,
    existing.value.destinationWarehouseId,
    'create',
  )
  if (!allowed.ok) {
    return allowed
  }

  return submitTransfer(persistence, organizationId, id)
}

export function cancelTransferForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  organizationId: Id,
  id: Id,
): ServiceResult {
  const gated = requireModuleEnabledForUser(persistence, currentUser, 'warehouse')
  if (!gated.ok) {
    return gated
  }

  const actor = requireActorInOrganization(currentUser, organizationId)
  if (!actor.ok) {
    return actor
  }

  const existing = requireTransfer(persistence, organizationId, id)
  if (!existing.ok) {
    return existing
  }

  const source = persistence.warehouses.getById(existing.value.sourceWarehouseId)
  const destination = persistence.warehouses.getById(
    existing.value.destinationWarehouseId,
  )
  if (!source || !destination) {
    return fail({ code: 'WAREHOUSE_NOT_FOUND' })
  }

  if (
    !canAccessWarehouse(actor.value, source).ok ||
    !canAccessWarehouse(actor.value, destination).ok
  ) {
    return fail({ code: 'ACCESS_DENIED' })
  }

  return cancelTransfer(persistence, organizationId, id)
}
