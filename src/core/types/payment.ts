import type { Id, IsoDateTime } from './common'

export type PaymentMethod =
  | 'cash'
  | 'card'
  | 'bank_transfer'
  | 'invoice'
  | 'on_credit'
  | 'other'

export type PaymentStatus = 'completed' | 'cancelled'

export type SalePaymentStatus = 'unpaid' | 'partially_paid' | 'paid'

export type Payment = {
  id: Id
  organizationId: Id
  saleId?: Id
  rentalBookingId?: Id
  careChargeId?: Id
  amount: number
  currency: string
  method: PaymentMethod
  status: PaymentStatus
  note?: string
  bankName?: string
  terminalName?: string
  accountReference?: string
  paymentReference?: string
  paymentComment?: string
  methodDetail?: string
  createdAt: IsoDateTime
  createdBy: Id
}

export function isSalePayment(
  payment: Payment,
): payment is Payment & { saleId: Id } {
  return Boolean(payment.saleId) && !payment.rentalBookingId && !payment.careChargeId
}

export function isRentalBookingPayment(
  payment: Payment,
): payment is Payment & { rentalBookingId: Id } {
  return Boolean(payment.rentalBookingId) && !payment.saleId && !payment.careChargeId
}

export function isCareChargePayment(
  payment: Payment,
): payment is Payment & { careChargeId: Id } {
  return Boolean(payment.careChargeId) && !payment.saleId && !payment.rentalBookingId
}

export function normalizePaymentMethod(value: unknown): PaymentMethod {
  if (
    value === 'cash' ||
    value === 'card' ||
    value === 'bank_transfer' ||
    value === 'invoice' ||
    value === 'on_credit' ||
    value === 'other'
  ) {
    return value
  }

  return 'other'
}
