import type { Id, Payment } from '../../types'
import type { PaymentRepository } from '../payment-repository'
import { createInMemoryEntityRepository } from './in-memory-entity-repository'

export function createInMemoryPaymentRepository(
  onChange: () => void,
): PaymentRepository & {
  snapshot: () => Payment[]
  restore: (items: Payment[]) => void
} {
  const base = createInMemoryEntityRepository<Payment>(onChange)

  const listBySaleId = (organizationId: Id, saleId: Id) =>
    base
      .list(organizationId)
      .filter((payment) => payment.saleId === saleId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))

  const listByRentalBookingId = (organizationId: Id, rentalBookingId: Id) =>
    base
      .list(organizationId)
      .filter((payment) => payment.rentalBookingId === rentalBookingId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))

  const listByCareChargeId = (organizationId: Id, careChargeId: Id) =>
    base
      .list(organizationId)
      .filter((payment) => payment.careChargeId === careChargeId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))

  return {
    ...base,
    listBySaleId,
    listByRentalBookingId,
    listByCareChargeId,
  }
}
