import type { Id, User } from '../types'
import { fail, ok, type ServiceResult } from '../types/domain-error'
import type { Persistence } from '../repositories/persistence'
import { belongsToOrganization } from './catalog'
import { requireActorInOrganization } from './access'
import { requireModuleEnabledForUser } from './organization-modules'
import { requireAccessibleWarehouse } from './warehouse-access'
import { canCancelRefund } from './financial-access'

export function cancelRefund(
  persistence: Persistence,
  organizationId: Id,
  id: Id,
): ServiceResult {
  const existing = persistence.paymentRefunds.getById(id)

  if (!existing) {
    return fail({ code: 'REFUND_NOT_FOUND' })
  }

  if (!belongsToOrganization(existing, organizationId)) {
    return fail({ code: 'ORGANIZATION_MISMATCH' })
  }

  if (existing.status !== 'completed') {
    return fail({ code: 'REFUND_NOT_COMPLETED' })
  }

  const updated = persistence.paymentRefunds.update(id, {
    status: 'cancelled',
  })

  if (!updated) {
    return fail({ code: 'REFUND_NOT_FOUND' })
  }

  return ok(undefined)
}

export function cancelRefundForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  organizationId: Id,
  id: Id,
): ServiceResult {
  const gated = requireModuleEnabledForUser(persistence, currentUser, 'sales')
  if (!gated.ok) {
    return gated
  }

  const actor = requireActorInOrganization(currentUser, organizationId)
  if (!actor.ok) {
    return actor
  }

  const existing = persistence.paymentRefunds.getById(id)
  if (!existing) {
    return fail({ code: 'REFUND_NOT_FOUND' })
  }

  if (existing.organizationId !== actor.value.organizationId) {
    return fail({ code: 'ORGANIZATION_MISMATCH' })
  }

  const payment = persistence.payments.getById(existing.paymentId)
  if (!payment) {
    return fail({ code: 'PAYMENT_NOT_FOUND' })
  }

  const sale = persistence.sales.getById(existing.saleId)
  if (!sale) {
    return fail({ code: 'SALE_NOT_FOUND' })
  }

  if (
    payment.organizationId !== actor.value.organizationId ||
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

  const allowed = canCancelRefund(persistence, actor.value, existing)
  if (!allowed.ok) {
    return allowed
  }

  return cancelRefund(persistence, organizationId, id)
}
