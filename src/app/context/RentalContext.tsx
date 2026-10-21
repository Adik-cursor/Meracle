import { useMemo, type ReactNode } from 'react'
import {
  cancelRentalBookingForUser,
  createAndReserveRentalBookingForUser,
  createPersonCustomerForRentalBookingForUser,
  createRentalBookingPaymentForUser,
  getRentalAnalyticsForUser,
  getRentalAvailabilityForUser,
  getRentalBookingForUser,
  issueRentalBookingForUser,
  listRentalBookingsForUser,
  listRentalRemindersForUser,
  reserveRentalBookingForUser,
  returnRentalBookingForUser,
  type PersonCustomerWrite,
  type RentalBookingWrite,
} from '../../core/services'
import type { Id, PaymentMethod, RentalReturnCondition } from '../../core/types'
import { nowIso } from '../../core/services/primitives'
import { useAccess } from './access-context'
import { useCompanies } from './company-context'
import { useOrganization } from './organization-context'
import { usePersistence, usePersistenceVersion } from './persistence-context'
import { RentalContext, type RentalContextValue } from './rental-context'

type RentalProviderProps = {
  children: ReactNode
}

export function RentalProvider({ children }: RentalProviderProps) {
  const persistence = usePersistence()
  const { settings } = useOrganization()
  const version = usePersistenceVersion()
  const { currentUser } = useAccess()
  const { getCompany } = useCompanies()

  const lookup = useMemo(
    () => ({
      getContact: (id: Id) => {
        const contact = persistence.contacts.getById(id)
        return contact?.organizationId ===
          (currentUser?.organizationId ?? '')
          ? contact
          : undefined
      },
      getCompany: (id: Id) => getCompany(id),
    }),
    [currentUser?.organizationId, getCompany, persistence],
  )

  const value = useMemo((): RentalContextValue => {
    void version
    const organizationId = currentUser?.organizationId ?? ''
    const at = nowIso()
    const bookingsResult = currentUser
      ? listRentalBookingsForUser(persistence, currentUser, organizationId, at)
      : undefined
    const remindersResult = currentUser
      ? listRentalRemindersForUser(
          persistence,
          currentUser,
          organizationId,
          at,
          settings.timezone,
        )
      : undefined
    const analyticsResult = currentUser
      ? getRentalAnalyticsForUser(persistence, currentUser, organizationId, at)
      : undefined

    return {
      at,
      bookings: bookingsResult?.ok ? bookingsResult.value : [],
      reminders: remindersResult?.ok ? remindersResult.value : [],
      analytics: analyticsResult?.ok ? analyticsResult.value : null,
      createBooking: (draft: RentalBookingWrite) => {
        const created = createAndReserveRentalBookingForUser(
          persistence,
          currentUser,
          organizationId,
          draft,
          lookup,
        )
        return created.ok ? created.value : undefined
      },
      createPersonCustomer: (draft: PersonCustomerWrite) => {
        const created = createPersonCustomerForRentalBookingForUser(
          persistence,
          currentUser,
          draft,
        )
        return created.ok ? created.value : created.error.code
      },
      getBooking: (id: Id) => {
        const result = getRentalBookingForUser(
          persistence,
          currentUser,
          id,
          at,
        )
        return result.ok ? result.value : undefined
      },
      getAvailability: (query) => {
        const result = getRentalAvailabilityForUser(persistence, currentUser, {
          ...query,
          organizationId,
        })
        return result.ok ? result.value : undefined
      },
      reserveBooking: (id) =>
        reserveRentalBookingForUser(persistence, currentUser, id, lookup).ok,
      cancelBooking: (id) =>
        cancelRentalBookingForUser(persistence, currentUser, id).ok,
      issueBooking: (id) =>
        issueRentalBookingForUser(persistence, currentUser, id).ok,
      returnBooking: (id, condition: RentalReturnCondition, comment?: string) =>
        returnRentalBookingForUser(
          persistence,
          currentUser,
          id,
          condition,
          comment,
        ).ok,
      payBooking: (id, draft: { amount: number; method: PaymentMethod; note?: string }) =>
        createRentalBookingPaymentForUser(persistence, currentUser, {
          organizationId,
          rentalBookingId: id,
          amount: draft.amount,
          method: draft.method,
          note: draft.note,
          currency: settings.currency,
        }).ok,
    }
  }, [
    currentUser,
    lookup,
    persistence,
    settings.currency,
    settings.timezone,
    version,
  ])

  return (
    <RentalContext.Provider value={value}>{children}</RentalContext.Provider>
  )
}
