import type { AccessChangeLog, Id, User } from '../types'
import { fail, type ServiceResult } from '../types/domain-error'
import type { Persistence } from '../repositories/persistence'
import {
  hasEffectiveFinancialPermission,
  hasEffectiveWarehousePermission,
  requireActorInOrganization,
} from './access'
import { requireModuleEnabledForUser } from './organization-modules'
import { requireAccessibleWarehouse } from './warehouse-access'
import { newId, nowIso } from './primitives'

export function requireRentalActor(
  persistence: Persistence,
  currentUser: User | null | undefined,
  organizationId: Id,
): ServiceResult<User> {
  const gated = requireModuleEnabledForUser(persistence, currentUser, 'rental')
  if (!gated.ok) {
    return gated
  }

  return requireActorInOrganization(currentUser, organizationId)
}

export function canReadRental(actor: User): boolean {
  return (
    hasEffectiveWarehousePermission(actor, 'products.read') ||
    hasEffectiveFinancialPermission(actor, 'sales.read')
  )
}

export function canManageRentalBookings(actor: User): boolean {
  return (
    hasEffectiveFinancialPermission(actor, 'sales.create') ||
    hasEffectiveWarehousePermission(actor, 'products.manage')
  )
}

export function canIssueOrReturnRental(actor: User): boolean {
  return (
    hasEffectiveFinancialPermission(actor, 'sales.complete') ||
    hasEffectiveWarehousePermission(actor, 'inventory.adjust')
  )
}

export function requireRentalReader(
  persistence: Persistence,
  currentUser: User | null | undefined,
  organizationId: Id,
): ServiceResult<User> {
  const actor = requireRentalActor(persistence, currentUser, organizationId)
  if (!actor.ok) {
    return actor
  }

  if (!canReadRental(actor.value)) {
    return fail({ code: 'ACCESS_DENIED' })
  }

  return actor
}

export function requireRentalManager(
  persistence: Persistence,
  currentUser: User | null | undefined,
  organizationId: Id,
  warehouseId: Id,
): ServiceResult<User> {
  const actor = requireRentalActor(persistence, currentUser, organizationId)
  if (!actor.ok) {
    return actor
  }

  if (!canManageRentalBookings(actor.value)) {
    return fail({ code: 'ACCESS_DENIED' })
  }

  const warehouse = requireAccessibleWarehouse(
    persistence,
    actor.value,
    warehouseId,
  )
  if (!warehouse.ok) {
    return warehouse
  }

  return actor
}

export function canTakeRentalPayment(actor: User): boolean {
  return hasEffectiveFinancialPermission(actor, 'payments.create')
}

export function requireRentalPayer(
  persistence: Persistence,
  currentUser: User | null | undefined,
  organizationId: Id,
  warehouseId: Id,
): ServiceResult<User> {
  const actor = requireRentalActor(persistence, currentUser, organizationId)
  if (!actor.ok) {
    return actor
  }

  if (!canTakeRentalPayment(actor.value)) {
    return fail({ code: 'ACCESS_DENIED' })
  }

  const warehouse = requireAccessibleWarehouse(
    persistence,
    actor.value,
    warehouseId,
  )
  if (!warehouse.ok) {
    return warehouse
  }

  return actor
}

export function requireRentalIssuer(
  persistence: Persistence,
  currentUser: User | null | undefined,
  organizationId: Id,
  warehouseId: Id,
): ServiceResult<User> {
  const actor = requireRentalActor(persistence, currentUser, organizationId)
  if (!actor.ok) {
    return actor
  }

  if (!canIssueOrReturnRental(actor.value)) {
    return fail({ code: 'ACCESS_DENIED' })
  }

  const warehouse = requireAccessibleWarehouse(
    persistence,
    actor.value,
    warehouseId,
  )
  if (!warehouse.ok) {
    return warehouse
  }

  return actor
}

export function recordRentalBookingAudit(
  persistence: Persistence,
  organizationId: Id,
  actorUserId: Id,
  bookingId: Id,
  field: string,
  previousValue: string,
  nextValue: string,
): void {
  const now = nowIso()
  const entry: AccessChangeLog = {
    id: newId(),
    organizationId,
    actorUserId,
    field: `rental.booking.${bookingId}.${field}`,
    previousValue,
    nextValue,
    reason: bookingId,
    createdAt: now,
    updatedAt: now,
  }
  persistence.accessChangeLogs.create(entry)
}

export function rentalUnitLockKey(unitId: Id): string {
  return `rentalUnit:${unitId}`
}

export function rentalProductLockKey(
  organizationId: Id,
  warehouseId: Id,
  productId: Id,
): string {
  return `rentalProduct:${organizationId}:${warehouseId}:${productId}`
}

export function runWithRentalProductLocks<T>(
  persistence: Persistence,
  keys: readonly string[],
  work: () => ServiceResult<T>,
): ServiceResult<T> {
  const unique = [...new Set(keys)].sort()
  const acquired: string[] = []

  for (const key of unique) {
    if (!persistence.locks.tryAcquire(key)) {
      for (const held of acquired) {
        persistence.locks.release(held)
      }
      return fail({ code: 'RENTAL_QUANTITY_UNAVAILABLE' })
    }
    acquired.push(key)
  }

  try {
    return persistence.runInTransaction(work)
  } finally {
    for (const held of acquired) {
      persistence.locks.release(held)
    }
  }
}

export function runWithRentalUnitLocks<T>(
  persistence: Persistence,
  unitIds: readonly Id[],
  work: () => ServiceResult<T>,
): ServiceResult<T> {
  const keys = [...new Set(unitIds)].sort().map(rentalUnitLockKey)
  const acquired: string[] = []

  for (const key of keys) {
    if (!persistence.locks.tryAcquire(key)) {
      for (const held of acquired) {
        persistence.locks.release(held)
      }
      return fail({ code: 'RENTAL_UNIT_UNAVAILABLE' })
    }
    acquired.push(key)
  }

  try {
    return persistence.runInTransaction(work)
  } finally {
    for (const key of acquired) {
      persistence.locks.release(key)
    }
  }
}
