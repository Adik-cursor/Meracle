import { createContext, useContext } from 'react'
import type { DomainErrorCode, Id, IsoDateTime, PaymentMethod, RentalReturnCondition } from '../../core/types'
import type {
  PersonCustomerResult,
  PersonCustomerWrite,
  RentalAnalytics,
  RentalAvailabilityQuery,
  RentalBookingRead,
  RentalBookingWrite,
  RentalReminder,
} from '../../core/services'

export type RentalContextValue = {
  bookings: RentalBookingRead[]
  reminders: RentalReminder[]
  analytics: RentalAnalytics | null
  createBooking: (draft: RentalBookingWrite) => RentalBookingRead | undefined
  createPersonCustomer: (
    draft: PersonCustomerWrite,
  ) => PersonCustomerResult | DomainErrorCode
  getBooking: (id: Id) => RentalBookingRead | undefined
  getAvailability: (
    query: Omit<RentalAvailabilityQuery, 'organizationId'>,
  ) => { stock: number; booked: number; available: number } | undefined
  reserveBooking: (id: Id) => boolean
  cancelBooking: (id: Id) => boolean
  issueBooking: (id: Id) => boolean
  returnBooking: (
    id: Id,
    condition: RentalReturnCondition,
    comment?: string,
  ) => boolean
  payBooking: (
    id: Id,
    draft: { amount: number; method: PaymentMethod; note?: string },
  ) => boolean
  at: IsoDateTime
}

export const RentalContext = createContext<RentalContextValue | null>(null)

export function useRental(): RentalContextValue {
  const context = useContext(RentalContext)
  if (!context) {
    throw new Error('useRental must be used within RentalProvider')
  }
  return context
}
