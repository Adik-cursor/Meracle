import type { BaseEntity, Id, IsoDateTime } from './common'

export type RentalBookingStatus =
  | 'draft'
  | 'reserved'
  | 'issued'
  | 'returned'
  | 'cancelled'

export const RENTAL_BOOKING_STATUSES: readonly RentalBookingStatus[] = [
  'draft',
  'reserved',
  'issued',
  'returned',
  'cancelled',
]

export const RENTAL_BLOCKING_BOOKING_STATUSES: readonly RentalBookingStatus[] = [
  'reserved',
  'issued',
]

export type RentalReturnCondition = 'ok' | 'damaged' | 'incomplete' | 'other'

export const RENTAL_RETURN_CONDITIONS: readonly RentalReturnCondition[] = [
  'ok',
  'damaged',
  'incomplete',
  'other',
]

/** Read-time only. Never persisted. */
export type RentalBookingViewStatus = RentalBookingStatus | 'active' | 'overdue'

export type RentalBooking = BaseEntity & {
  customerId: Id
  warehouseId: Id
  startAt: IsoDateTime
  endAt: IsoDateTime
  status: RentalBookingStatus
  subtotal: number
  discount: number
  total: number
  /** Agreed prepayment. Persisted as `deposit` so existing local data still loads. */
  deposit: number
  /** Legacy field. Kept for stored records; no longer updated or used. */
  depositHeld: number
  /** Legacy field. Kept for stored records; no longer updated or used. */
  depositReturned: number
  paidAmount: number
  saleId?: Id
  comment?: string
  createdBy: Id
  issuedAt?: IsoDateTime
  issuedBy?: Id
  returnedAt?: IsoDateTime
  returnedBy?: Id
  returnCondition?: RentalReturnCondition
  returnComment?: string
}

export function isRentalBookingStatus(
  value: string,
): value is RentalBookingStatus {
  return RENTAL_BOOKING_STATUSES.includes(value as RentalBookingStatus)
}

export function isRentalReturnCondition(
  value: string,
): value is RentalReturnCondition {
  return RENTAL_RETURN_CONDITIONS.includes(value as RentalReturnCondition)
}

export function isBlockingRentalBookingStatus(
  status: RentalBookingStatus,
): boolean {
  return RENTAL_BLOCKING_BOOKING_STATUSES.includes(status)
}

export function deriveRentalBookingViewStatus(
  booking: Pick<RentalBooking, 'status' | 'startAt' | 'endAt'>,
  at: IsoDateTime,
): RentalBookingViewStatus {
  if (booking.status !== 'issued') {
    return booking.status
  }

  if (at < booking.endAt && at >= booking.startAt) {
    return 'active'
  }

  if (at >= booking.endAt) {
    return 'overdue'
  }

  return 'issued'
}
