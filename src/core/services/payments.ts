import type { Id, User } from '../types'
import { fail, ok, type ServiceResult } from '../types/domain-error'
import type { Persistence } from '../repositories/persistence'
import { belongsToOrganization } from './catalog'
import { requireActorInOrganization } from './access'
import { requireModuleEnabledForUser } from './organization-modules'
import { requireAccessibleWarehouse } from './warehouse-access'
import { canCancelPayment } from './financial-access'

export function cancelPayment(
  persistence: Persistence,
  organizationId: Id,
  id: Id,
): ServiceResult {
  const existing = persistence.payments.getById(id)

  if (!existing) {
    return fail({ code: 'PAYMENT_NOT_FOUND' })
  }

  if (!belongsToOrganization(existing, organizationId)) {
    return fail({ code: 'ORGANIZATION_MISMATCH' })
  }

  if (existing.status !== 'completed') {
    return fail({ code: 'PAYMENT_NOT_COMPLETED' })
  }

  const updated = persistence.payments.update(id, {
    status: 'cancelled',
  })

  if (!updated) {
    return fail({ code: 'PAYMENT_NOT_FOUND' })
  }

  return ok(undefined)
}

export function cancelPaymentForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  organizationId: Id,
  id: Id,
): ServiceResult {
  const existing = persistence.payments.getById(id)
  if (!existing) {
    return fail({ code: 'PAYMENT_NOT_FOUND' })
  }

  if (existing.rentalBookingId && !existing.saleId) {
    const gated = requireModuleEnabledForUser(persistence, currentUser, 'rental')
    if (!gated.ok) {
      return gated
    }

    const actor = requireActorInOrganization(currentUser, organizationId)
    if (!actor.ok) {
      return actor
    }

    if (existing.organizationId !== actor.value.organizationId) {
      return fail({ code: 'ORGANIZATION_MISMATCH' })
    }

    const booking = persistence.rentalBookings.getById(existing.rentalBookingId)
    if (!booking) {
      return fail({ code: 'RENTAL_BOOKING_NOT_FOUND' })
    }

    if (booking.organizationId !== actor.value.organizationId) {
      return fail({ code: 'ORGANIZATION_MISMATCH' })
    }

    const warehouse = requireAccessibleWarehouse(
      persistence,
      actor.value,
      booking.warehouseId,
    )
    if (!warehouse.ok) {
      return warehouse
    }

    const allowed = canCancelPayment(persistence, actor.value, existing)
    if (!allowed.ok) {
      return allowed
    }

    return cancelPayment(persistence, organizationId, id)
  }

  const gated = requireModuleEnabledForUser(persistence, currentUser, 'sales')
  if (!gated.ok) {
    return gated
  }

  const actor = requireActorInOrganization(currentUser, organizationId)
  if (!actor.ok) {
    return actor
  }

  if (!existing.saleId) {
    return fail({ code: 'SALE_NOT_FOUND' })
  }

  const sale = persistence.sales.getById(existing.saleId)
  if (!sale) {
    return fail({ code: 'SALE_NOT_FOUND' })
  }

  if (
    existing.organizationId !== actor.value.organizationId ||
    sale.organizationId !== actor.value.organizationId
  ) {
    return fail({ code: 'ORGANIZATION_MISMATCH' })
  }

  if (sale.warehouseId) {
    const warehouse = requireAccessibleWarehouse(
      persistence,
      actor.value,
      sale.warehouseId,
    )
    if (!warehouse.ok) {
      return warehouse
    }
  }

  const allowed = canCancelPayment(persistence, actor.value, existing)
  if (!allowed.ok) {
    return allowed
  }

  return cancelPayment(persistence, organizationId, id)
}
