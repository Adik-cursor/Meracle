import type { Id, Payment, PaymentMethod, User } from '../types'
import { fail, ok, type ServiceResult } from '../types/domain-error'
import {
  getDueAmount,
  roundMoney,
  sumCompletedPayments,
} from '../../modules/sales/sale-payment'
import type { Persistence } from '../repositories/persistence'
import { isPositiveAmount, newId, nowIso, optionalText } from './primitives'
import {
  recordRentalBookingAudit,
  requireRentalPayer,
  requireRentalReader,
} from './rental-access'
import { requireAccessibleWarehouse } from './warehouse-access'
import { hasEffectiveFinancialPermission } from './access'

export type CreateRentalBookingPaymentInput = {
  organizationId: Id
  createdBy: Id
  rentalBookingId: Id
  amount: number
  method: PaymentMethod
  currency: string
  note?: string
}

export function listCompletedRentalBookingPayments(
  persistence: Persistence,
  organizationId: Id,
  rentalBookingId: Id,
): Payment[] {
  return persistence.payments.listByRentalBookingId(
    organizationId,
    rentalBookingId,
  )
}

export function rentalBookingPaidAmount(
  persistence: Persistence,
  organizationId: Id,
  rentalBookingId: Id,
): number {
  return sumCompletedPayments(
    listCompletedRentalBookingPayments(
      persistence,
      organizationId,
      rentalBookingId,
    ),
  )
}

export function createRentalBookingPayment(
  persistence: Persistence,
  input: CreateRentalBookingPaymentInput,
): ServiceResult<Payment> {
  const amount = roundMoney(input.amount)
  const booking = persistence.rentalBookings.getById(input.rentalBookingId)
  if (!booking) {
    return fail({ code: 'RENTAL_BOOKING_NOT_FOUND' })
  }

  if (booking.organizationId !== input.organizationId) {
    return fail({ code: 'ORGANIZATION_MISMATCH' })
  }

  if (booking.status === 'cancelled') {
    return fail({ code: 'RENTAL_INVALID_STATUS' })
  }

  if (!isPositiveAmount(amount) || booking.total <= 0) {
    return fail({ code: 'INVALID_INPUT' })
  }

  if (input.method === 'invoice') {
    return fail({ code: 'INVALID_INPUT' })
  }

  const paidAmount = rentalBookingPaidAmount(
    persistence,
    booking.organizationId,
    booking.id,
  )
  const dueAmount = getDueAmount(booking.total, paidAmount)
  if (amount > dueAmount) {
    return fail({ code: 'PAYMENT_LIMIT_EXCEEDED' })
  }

  const currency = input.currency.trim() || 'KZT'
  const now = nowIso()
  const payment: Payment = {
    id: newId(),
    organizationId: booking.organizationId,
    rentalBookingId: booking.id,
    amount,
    currency,
    method: input.method,
    status: 'completed',
    createdAt: now,
    createdBy: input.createdBy,
    note: optionalText(input.note),
  }

  return persistence.runInTransaction(() => {
    const created = persistence.payments.create(payment)
    recordRentalBookingAudit(
      persistence,
      booking.organizationId,
      input.createdBy,
      booking.id,
      'payment',
      String(paidAmount),
      String(roundMoney(paidAmount + amount)),
    )
    return ok(created)
  })
}

export function createRentalBookingPaymentForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  input: Omit<CreateRentalBookingPaymentInput, 'createdBy' | 'organizationId'> & {
    organizationId: Id
  },
): ServiceResult<Payment> {
  const booking = persistence.rentalBookings.getById(input.rentalBookingId)
  if (!booking) {
    return fail({ code: 'RENTAL_BOOKING_NOT_FOUND' })
  }

  if (booking.organizationId !== input.organizationId) {
    return fail({ code: 'ORGANIZATION_MISMATCH' })
  }

  const actor = requireRentalPayer(
    persistence,
    currentUser,
    booking.organizationId,
    booking.warehouseId,
  )
  if (!actor.ok) {
    return actor
  }

  return createRentalBookingPayment(persistence, {
    ...input,
    organizationId: actor.value.organizationId,
    createdBy: actor.value.id,
  })
}

export function listRentalBookingPaymentsForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  rentalBookingId: Id,
): ServiceResult<Payment[]> {
  const booking = persistence.rentalBookings.getById(rentalBookingId)
  if (!booking) {
    return fail({ code: 'RENTAL_BOOKING_NOT_FOUND' })
  }

  const actor = requireRentalReader(
    persistence,
    currentUser,
    booking.organizationId,
  )
  if (!actor.ok) {
    return actor
  }

  if (booking.organizationId !== actor.value.organizationId) {
    return fail({ code: 'ACCESS_DENIED' })
  }

  if (!requireAccessibleWarehouse(persistence, actor.value, booking.warehouseId).ok) {
    return fail({ code: 'ACCESS_DENIED' })
  }

  if (!hasEffectiveFinancialPermission(actor.value, 'payments.read')) {
    return fail({ code: 'ACCESS_DENIED' })
  }

  return ok(
    listCompletedRentalBookingPayments(
      persistence,
      actor.value.organizationId,
      booking.id,
    ),
  )
}
