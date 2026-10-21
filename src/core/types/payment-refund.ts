import type { Id, IsoDateTime } from './common'

export type PaymentRefundStatus = 'completed' | 'cancelled'

export type PaymentRefund = {
  id: Id
  organizationId: Id
  paymentId: Id
  saleId: Id
  returnId?: string
  amount: number
  currency: string
  status: PaymentRefundStatus
  note?: string
  createdAt: IsoDateTime
  createdBy: Id
}
