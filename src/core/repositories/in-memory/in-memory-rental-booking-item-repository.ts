import type { Id, RentalBookingItem } from '../../types'
import type { RentalBookingItemRepository } from '../rental-booking-item-repository'
import { createInMemoryEntityRepository } from './in-memory-entity-repository'

export function createInMemoryRentalBookingItemRepository(
  onChange: () => void,
): RentalBookingItemRepository & {
  snapshot: () => RentalBookingItem[]
  restore: (items: RentalBookingItem[]) => void
} {
  const base = createInMemoryEntityRepository<RentalBookingItem>(onChange)

  return {
    ...base,
    listByBookingId: (bookingId: Id) =>
      base.store.list().filter((item) => item.bookingId === bookingId),
  }
}
