import type { Id, PaymentRefund, User } from '../types'
import { fail, ok, type ServiceResult } from '../types/domain-error'
import { roundMoney } from '../../modules/sales/sale-payment'
import type { Persistence } from '../repositories/persistence'
import { belongsToOrganization } from './catalog'
import { isPositiveAmount, newId, nowIso, optionalText } from './primitives'
import { requireActorInOrganization } from './access'
import { requireModuleEnabledForUser } from './organization-modules'
import { requireAccessibleWarehouse } from './warehouse-access'
import {
  canCreateRefund,
  canReadRefund,
} from './financial-access'

export type CreatePaymentRefundInput = {
  organizationId: Id
  createdBy: Id
  paymentId: Id
  amount: number
  returnId?: string
  note?: string
}

function sumCompletedRefunds(items: PaymentRefund[]): number {
  return roundMoney(
    items
      .filter((item) => item.status === 'completed')
      .reduce((sum, item) => sum + item.amount, 0),
  )
}

export function createPaymentRefund(
  persistence: Persistence,
  input: CreatePaymentRefundInput,
): ServiceResult<PaymentRefund> {
  const amount = roundMoney(input.amount)
  const payment = persistence.payments.getById(input.paymentId)

  if (!belongsToOrganization(payment, input.organizationId)) {
    return fail({
      code: payment ? 'ORGANIZATION_MISMATCH' : 'PAYMENT_NOT_FOUND',
    })
  }

  if (payment.rentalBookingId && !payment.saleId) {
    return fail({ code: 'INVALID_INPUT' })
  }

  if (!payment.saleId) {
    return fail({ code: 'SALE_NOT_FOUND' })
  }

  if (payment.status !== 'completed') {
    return fail({ code: 'PAYMENT_NOT_COMPLETED' })
  }

  if (!isPositiveAmount(amount)) {
    return fail({ code: 'INVALID_INPUT' })
  }

  const refundedAmount = sumCompletedRefunds(
    persistence.paymentRefunds.listByPaymentId(
      input.organizationId,
      payment.id,
    ),
  )
  const refundableAmount = Math.max(
    0,
    roundMoney(payment.amount - refundedAmount),
  )

  if (amount > refundableAmount) {
    return fail({ code: 'REFUND_LIMIT_EXCEEDED' })
  }

  const returnId = input.returnId?.trim()

  if (returnId) {
    const saleReturn = persistence.saleReturns.getById(returnId)

    if (!belongsToOrganization(saleReturn, input.organizationId)) {
      return fail({
        code: saleReturn ? 'ORGANIZATION_MISMATCH' : 'RETURN_NOT_FOUND',
      })
    }

    if (saleReturn.saleId !== payment.saleId) {
      return fail({ code: 'ORGANIZATION_MISMATCH' })
    }

    if (saleReturn.status === 'cancelled') {
      return fail({ code: 'RETURN_INVALID_STATUS' })
    }

    const refundedForReturn = sumCompletedRefunds(
      persistence.paymentRefunds.listByReturnId(input.organizationId, returnId),
    )
    const returnRefundable = Math.max(
      0,
      roundMoney(saleReturn.total - refundedForReturn),
    )

    if (amount > returnRefundable) {
      return fail({ code: 'REFUND_LIMIT_EXCEEDED' })
    }
  }

  const now = nowIso()
  const refund: PaymentRefund = {
    id: newId(),
    organizationId: input.organizationId,
    paymentId: payment.id,
    saleId: payment.saleId,
    returnId: returnId ? returnId : undefined,
    amount,
    currency: payment.currency,
    status: 'completed',
    createdAt: now,
    createdBy: input.createdBy,
    note: optionalText(input.note),
  }

  return persistence.runInTransaction(() =>
    ok(persistence.paymentRefunds.create(refund)),
  )
}

export function createPaymentRefundForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  input: CreatePaymentRefundInput,
): ServiceResult<PaymentRefund> {
  const gated = requireModuleEnabledForUser(persistence, currentUser, 'sales')
  if (!gated.ok) {
    return gated
  }

  const actor = requireActorInOrganization(currentUser, input.organizationId)
  if (!actor.ok) {
    return actor
  }

  const payment = persistence.payments.getById(input.paymentId)
  if (!payment) {
    return fail({ code: 'PAYMENT_NOT_FOUND' })
  }

  if (payment.organizationId !== actor.value.organizationId) {
    return fail({ code: 'ORGANIZATION_MISMATCH' })
  }

  if (!payment.saleId) {
    return fail({ code: 'SALE_NOT_FOUND' })
  }

  const sale = persistence.sales.getById(payment.saleId)
  if (!sale) {
    return fail({ code: 'SALE_NOT_FOUND' })
  }

  if (sale.organizationId !== actor.value.organizationId) {
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

  const allowed = canCreateRefund(persistence, actor.value, payment)
  if (!allowed.ok) {
    return allowed
  }

  return createPaymentRefund(persistence, {
    ...input,
    createdBy: actor.value.id,
  })
}

export function listRefundsForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
): ServiceResult<PaymentRefund[]> {
  const actor = requireModuleEnabledForUser(persistence, currentUser, 'sales')
  if (!actor.ok) {
    return actor
  }

  const refunds: PaymentRefund[] = []
  for (const refund of persistence.paymentRefunds.list(
    actor.value.organizationId,
  )) {
    if (canReadRefund(persistence, actor.value, refund).ok) {
      const payment = persistence.payments.getById(refund.paymentId)
      const sale = payment?.saleId
        ? persistence.sales.getById(payment.saleId)
        : undefined
      if (!sale || sale.organizationId !== actor.value.organizationId) {
        continue
      }

      if (sale.warehouseId) {
        const warehouse = requireAccessibleWarehouse(
          persistence,
          actor.value,
          sale.warehouseId,
        )
        if (!warehouse.ok) {
          continue
        }
      }

      refunds.push(refund)
    }
  }

  return ok(refunds)
}
