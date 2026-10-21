import type { BaseEntity, Id } from './common'
import type { PaymentMethod } from './payment'

export type CustomerDebtPayment = BaseEntity & {
  customerId: Id
  amount: number
  method: PaymentMethod
  actorUserId: Id
  remainingAfter: number
  bankName?: string
  accountReference?: string
  paymentReference?: string
  comment?: string
}
