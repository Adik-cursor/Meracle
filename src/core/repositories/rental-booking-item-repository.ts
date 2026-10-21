import type { Id, RentalBookingItem } from '../types'
import type { EntityRepository } from './entity-repository'

export type RentalBookingItemRepository = EntityRepository<RentalBookingItem> & {
  listByBookingId: (bookingId: Id) => RentalBookingItem[]
}
