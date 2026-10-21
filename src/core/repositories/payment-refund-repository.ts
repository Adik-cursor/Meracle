import type { Id, PaymentRefund } from '../types'
import type { EntityRepository } from './entity-repository'

export type PaymentRefundRepository = EntityRepository<PaymentRefund> & {
  listByPaymentId: (organizationId: Id, paymentId: Id) => PaymentRefund[]
  listBySaleId: (organizationId: Id, saleId: Id) => PaymentRefund[]
  listByReturnId: (organizationId: Id, returnId: Id) => PaymentRefund[]
}
