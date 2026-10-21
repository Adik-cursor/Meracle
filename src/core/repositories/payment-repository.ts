import type { Id, Payment } from '../types'
import type { EntityRepository } from './entity-repository'

export type PaymentRepository = EntityRepository<Payment> & {
  listBySaleId: (organizationId: Id, saleId: Id) => Payment[]
  listByRentalBookingId: (organizationId: Id, rentalBookingId: Id) => Payment[]
  listByCareChargeId: (organizationId: Id, careChargeId: Id) => Payment[]
}
