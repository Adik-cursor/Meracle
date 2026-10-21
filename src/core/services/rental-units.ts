import type { Id, RentalUnit, RentalUnitStatus, User } from '../types'
import { isRentalUnitStatus } from '../types/rental-unit'
import { fail, ok, type ServiceResult } from '../types/domain-error'
import type { Persistence } from '../repositories/persistence'
import { belongsToOrganization } from './catalog'
import { newId, nowIso, optionalText } from './primitives'
import {
  requireRentalManager,
  requireRentalReader,
} from './rental-access'
import { requireAccessibleWarehouse } from './warehouse-access'

export type RentalUnitWrite = {
  productId: Id
  warehouseId: Id
  code: string
  status?: RentalUnitStatus
  note?: string
}

function requireRentalUnitInOrganization(
  persistence: Persistence,
  organizationId: Id,
  id: Id,
): ServiceResult<RentalUnit> {
  const unit = persistence.rentalUnits.getById(id)
  if (!unit) {
    return fail({ code: 'RENTAL_UNIT_NOT_FOUND' })
  }

  if (!belongsToOrganization(unit, organizationId)) {
    return fail({ code: 'ACCESS_DENIED' })
  }

  return ok(unit)
}

function requireProductInOrganization(
  persistence: Persistence,
  organizationId: Id,
  productId: Id,
): ServiceResult {
  const product = persistence.products.getById(productId)
  if (!product) {
    return fail({ code: 'PRODUCT_NOT_FOUND' })
  }

  if (!belongsToOrganization(product, organizationId)) {
    return fail({ code: 'ORGANIZATION_MISMATCH' })
  }

  return ok(undefined)
}

function requireWarehouseInOrganization(
  persistence: Persistence,
  organizationId: Id,
  warehouseId: Id,
): ServiceResult {
  const warehouse = persistence.warehouses.getById(warehouseId)
  if (!warehouse) {
    return fail({ code: 'WAREHOUSE_NOT_FOUND' })
  }

  if (!belongsToOrganization(warehouse, organizationId)) {
    return fail({ code: 'WAREHOUSE_ORGANIZATION_MISMATCH' })
  }

  return ok(undefined)
}

export function createRentalUnit(
  persistence: Persistence,
  organizationId: Id,
  draft: RentalUnitWrite,
): ServiceResult<RentalUnit> {
  const code = draft.code.trim()
  if (!code) {
    return fail({ code: 'INVALID_INPUT' })
  }

  const status = draft.status ?? 'available'
  if (!isRentalUnitStatus(status)) {
    return fail({ code: 'INVALID_INPUT' })
  }

  const product = requireProductInOrganization(
    persistence,
    organizationId,
    draft.productId,
  )
  if (!product.ok) {
    return product
  }

  const warehouse = requireWarehouseInOrganization(
    persistence,
    organizationId,
    draft.warehouseId,
  )
  if (!warehouse.ok) {
    return warehouse
  }

  const now = nowIso()
  const unit: RentalUnit = {
    id: newId(),
    organizationId,
    productId: draft.productId,
    warehouseId: draft.warehouseId,
    code,
    status,
    note: optionalText(draft.note),
    createdAt: now,
    updatedAt: now,
  }

  return ok(persistence.rentalUnits.create(unit))
}

export function createRentalUnitForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  organizationId: Id,
  draft: RentalUnitWrite,
): ServiceResult<RentalUnit> {
  const actor = requireRentalManager(
    persistence,
    currentUser,
    organizationId,
    draft.warehouseId,
  )
  if (!actor.ok) {
    return actor
  }

  return createRentalUnit(persistence, actor.value.organizationId, draft)
}

export function getRentalUnitForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  id: Id,
): ServiceResult<RentalUnit> {
  const unit = persistence.rentalUnits.getById(id)
  if (!unit) {
    return fail({ code: 'RENTAL_UNIT_NOT_FOUND' })
  }

  const actor = requireRentalReader(
    persistence,
    currentUser,
    unit.organizationId,
  )
  if (!actor.ok) {
    return actor
  }

  const warehouse = requireAccessibleWarehouse(
    persistence,
    actor.value,
    unit.warehouseId,
  )
  if (!warehouse.ok) {
    return fail({ code: 'ACCESS_DENIED' })
  }

  return requireRentalUnitInOrganization(
    persistence,
    actor.value.organizationId,
    id,
  )
}

export function listRentalUnitsForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  organizationId: Id,
): ServiceResult<RentalUnit[]> {
  const actor = requireRentalReader(persistence, currentUser, organizationId)
  if (!actor.ok) {
    return actor
  }

  return ok(
    persistence.rentalUnits
      .list(actor.value.organizationId)
      .filter(
        (unit) =>
          requireAccessibleWarehouse(persistence, actor.value, unit.warehouseId)
            .ok,
      ),
  )
}
