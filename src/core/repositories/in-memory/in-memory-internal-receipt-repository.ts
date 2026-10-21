import type { Id, InternalReceipt } from '../../types'
import type { InternalReceiptRepository } from '../internal-receipt-repository'
import { createInMemoryEntityRepository } from './in-memory-entity-repository'

export function createInMemoryInternalReceiptRepository(
  onChange: () => void,
): InternalReceiptRepository & {
  snapshot: () => InternalReceipt[]
  restore: (items: InternalReceipt[]) => void
} {
  const base = createInMemoryEntityRepository<InternalReceipt>(onChange, 'end')

  const listBySaleId = (organizationId: Id, saleId: Id) =>
    base
      .list(organizationId)
      .filter((item) => item.saleId === saleId)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))

  return {
    ...base,
    listBySaleId,
    getByPaymentId: (organizationId, paymentId) =>
      base
        .list(organizationId)
        .find((item) => item.paymentId === paymentId),
    getBySaleId: (organizationId, saleId) =>
      listBySaleId(organizationId, saleId).find(
        (item) => item.receiptType === 'sale',
      ) ?? listBySaleId(organizationId, saleId)[0],
    getByNumber: (organizationId, receiptNumber) =>
      base
        .list(organizationId)
        .find((item) => item.receiptNumber === receiptNumber),
    getBySaleReturnId: (organizationId, saleReturnId) =>
      base
        .list(organizationId)
        .find((item) => item.saleReturnId === saleReturnId),
  }
}
