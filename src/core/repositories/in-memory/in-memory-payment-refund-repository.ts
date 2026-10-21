import type { Id, PaymentRefund } from '../../types'
import type { PaymentRefundRepository } from '../payment-refund-repository'
import { createInMemoryEntityRepository } from './in-memory-entity-repository'

export function createInMemoryPaymentRefundRepository(
  onChange: () => void,
): PaymentRefundRepository & {
  snapshot: () => PaymentRefund[]
  restore: (items: PaymentRefund[]) => void
} {
  const base = createInMemoryEntityRepository<PaymentRefund>(onChange)

  const inOrg = (organizationId: Id, item: PaymentRefund) =>
    item.organizationId === organizationId

  return {
    ...base,
    listByPaymentId: (organizationId, paymentId) =>
      base
        .list(organizationId)
        .filter(
          (item) => inOrg(organizationId, item) && item.paymentId === paymentId,
        )
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    listBySaleId: (organizationId, saleId) =>
      base.list(organizationId).filter((item) => item.saleId === saleId),
    listByReturnId: (organizationId, returnId) =>
      base.list(organizationId).filter((item) => item.returnId === returnId),
  }
}
