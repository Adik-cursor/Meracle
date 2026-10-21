import type { BaseEntity, Id } from './common'

export type RentalBookingItem = BaseEntity & {
  bookingId: Id
  productId: Id
  quantity: number
  /** Legacy physical-unit id. Not used by new availability. */
  unitId?: Id
}
