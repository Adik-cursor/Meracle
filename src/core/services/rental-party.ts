import type { Customer, Id } from '../types'
import { fail, ok, type ServiceResult } from '../types/domain-error'

export type RentalPartyLookup = {
  getContact: (id: Id) =>
    | {
        organizationId: Id
        phone?: string | null
        firstName?: string
        lastName?: string
      }
    | undefined
  getCompany: (id: Id) =>
    | {
        organizationId: Id
        name?: string
      }
    | undefined
}

export function rentalCustomerPhone(
  customer: Customer,
  lookup: RentalPartyLookup,
): string | undefined {
  if (customer.type !== 'contact' || !customer.contactId) {
    return undefined
  }

  const contact = lookup.getContact(customer.contactId)
  if (!contact || contact.organizationId !== customer.organizationId) {
    return undefined
  }

  const phone = contact.phone?.trim()
  return phone || undefined
}

export function requireRentalCustomerPhone(
  customer: Customer,
  lookup: RentalPartyLookup,
): ServiceResult<string> {
  const phone = rentalCustomerPhone(customer, lookup)
  if (!phone) {
    return fail({ code: 'CUSTOMER_PHONE_REQUIRED' })
  }

  return ok(phone)
}
