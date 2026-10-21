import type { Id, IsoDateTime } from './common'
import type { PaymentMethod, PaymentStatus } from './payment'
import type { PaymentRefundStatus } from './payment-refund'

export type SaleFinancialView = {
  id: Id
  saleId: Id
  canRead: boolean
  canReadAmount: boolean
  subtotal?: number
  discount?: number
  total?: number
  paidAmount?: number
  outstandingAmount?: number
}

export type PaymentFinancialView = {
  id: Id
  paymentId: Id
  saleId?: Id
  rentalBookingId?: Id
  method: PaymentMethod
  amount: number
  status: PaymentStatus
  createdAt: IsoDateTime
}

export type RefundFinancialView = {
  id: Id
  refundId: Id
  paymentId: Id
  returnId?: string
  amount: number
  status: PaymentRefundStatus
  createdAt: IsoDateTime
}
