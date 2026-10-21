import type { Id, InternalReceipt } from '../types'
import type { EntityRepository } from './entity-repository'

export type InternalReceiptRepository = EntityRepository<InternalReceipt> & {
  getBySaleId: (organizationId: Id, saleId: Id) => InternalReceipt | undefined
  getByPaymentId: (organizationId: Id, paymentId: Id) => InternalReceipt | undefined
  getByNumber: (
    organizationId: Id,
    receiptNumber: string,
  ) => InternalReceipt | undefined
  listBySaleId: (organizationId: Id, saleId: Id) => InternalReceipt[]
  getBySaleReturnId: (
    organizationId: Id,
    saleReturnId: Id,
  ) => InternalReceipt | undefined
}
