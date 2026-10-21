import type { Contact, Customer, Id, User } from '../types'
import { fail, ok, type ServiceResult } from '../types/domain-error'
import type { Persistence } from '../repositories/persistence'
import { belongsToOrganization } from './catalog'
import { requireActorInOrganization } from './access'
import { requireModuleEnabledForUser } from './organization-modules'
import { newId, nowIso, optionalText } from './primitives'
import {
  createCustomer,
  type CustomerPartyLookup,
  type CustomerWrite,
} from './customers'
import { requireRentalActor } from './rental-access'

export type ContactWrite = {
  firstName: string
  lastName: string
  email?: string
  phone?: string
  status?: Extract<Contact['status'], 'active' | 'inactive'>
}

export type PersonCustomerWrite = {
  fullName: string
  phone: string
}

export type PersonCustomerResult = {
  status: 'created' | 'duplicate'
  customer: Customer
  contact: Contact
}

export function normalizeContactPhone(phone: string): string {
  let digits = phone.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('8')) {
    digits = `7${digits.slice(1)}`
  }
  return digits
}

export function splitPersonName(fullName: string): {
  firstName: string
  lastName: string
} | undefined {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) {
    return undefined
  }
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: parts[0] }
  }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  }
}

export function listContactsForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  organizationId: Id,
): ServiceResult<Contact[]> {
  const gated = requireModuleEnabledForUser(persistence, currentUser, 'crm')
  if (!gated.ok) {
    return gated
  }

  const actor = requireActorInOrganization(currentUser, organizationId)
  if (!actor.ok) {
    return actor
  }

  return ok(persistence.contacts.list(actor.value.organizationId))
}

export function getContactForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  id: Id,
): ServiceResult<Contact> {
  const gated = requireModuleEnabledForUser(persistence, currentUser, 'crm')
  if (!gated.ok) {
    return gated
  }

  const actor = requireCurrentOrgActor(currentUser)
  if (!actor.ok) {
    return actor
  }

  const contact = persistence.contacts.getById(id)
  if (!contact) {
    return fail({ code: 'CUSTOMER_NOT_FOUND' })
  }
  if (!belongsToOrganization(contact, actor.value.organizationId)) {
    return fail({ code: 'ORGANIZATION_MISMATCH' })
  }

  return ok(contact)
}

export function findContactByPhoneInOrganization(
  persistence: Persistence,
  organizationId: Id,
  phone: string,
): Contact | undefined {
  const digits = normalizeContactPhone(phone)
  if (!digits) {
    return undefined
  }

  return persistence.contacts
    .list(organizationId)
    .find((contact) => normalizeContactPhone(contact.phone ?? '') === digits)
}

export function findCustomerByContactPhone(
  persistence: Persistence,
  organizationId: Id,
  phone: string,
): { customer: Customer; contact: Contact } | undefined {
  const contact = findContactByPhoneInOrganization(
    persistence,
    organizationId,
    phone,
  )
  if (!contact) {
    return undefined
  }

  const customer = persistence.customers
    .list(organizationId)
    .find((item) => item.type === 'contact' && item.contactId === contact.id)

  if (!customer) {
    return undefined
  }

  return { customer, contact }
}

export function createContact(
  persistence: Persistence,
  organizationId: Id,
  draft: ContactWrite,
): ServiceResult<Contact> {
  const firstName = draft.firstName.trim()
  const lastName = draft.lastName.trim()
  if (!firstName || !lastName) {
    return fail({ code: 'CUSTOMER_INVALID' })
  }

  const now = nowIso()
  const contact: Contact = {
    id: newId(),
    organizationId,
    firstName,
    lastName,
    email: optionalText(draft.email) ?? null,
    phone: optionalText(draft.phone) ?? null,
    companyId: null,
    status: draft.status === 'inactive' ? 'inactive' : 'active',
    createdAt: now,
    updatedAt: now,
  }

  return ok(persistence.contacts.create(contact))
}

export function createContactForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  draft: ContactWrite,
): ServiceResult<Contact> {
  const actor = requireCrmActor(persistence, currentUser)
  if (!actor.ok) {
    return actor
  }

  return createContact(persistence, actor.value.organizationId, draft)
}

export function createCustomerForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  draft: CustomerWrite,
  lookup: CustomerPartyLookup,
): ServiceResult<Customer> {
  const actor = requireCrmActor(persistence, currentUser)
  if (!actor.ok) {
    return actor
  }

  return createCustomer(persistence, actor.value.organizationId, draft, lookup)
}

export function createPersonCustomerInOrganization(
  persistence: Persistence,
  organizationId: Id,
  draft: PersonCustomerWrite,
): ServiceResult<PersonCustomerResult> {
  const names = splitPersonName(draft.fullName)
  const phone = draft.phone.trim()
  if (!names) {
    return fail({ code: 'CUSTOMER_INVALID' })
  }
  if (!phone || !normalizeContactPhone(phone)) {
    return fail({ code: 'CUSTOMER_PHONE_REQUIRED' })
  }

  const existing = findCustomerByContactPhone(persistence, organizationId, phone)
  if (existing) {
    return ok({
      status: 'duplicate',
      customer: existing.customer,
      contact: existing.contact,
    })
  }

  const existingContact = findContactByPhoneInOrganization(
    persistence,
    organizationId,
    phone,
  )

  return persistence.runInTransaction(() => {
    const contact = existingContact
      ? ok(existingContact)
      : createContact(persistence, organizationId, {
          firstName: names.firstName,
          lastName: names.lastName,
          phone,
          status: 'active',
        })
    if (!contact.ok) {
      return contact
    }

    const customer = createCustomer(
      persistence,
      organizationId,
      {
        type: 'contact',
        contactId: contact.value.id,
        status: 'active',
      },
      {
        getContact: (id) => persistence.contacts.getById(id),
        getCompany: () => undefined,
      },
    )
    if (!customer.ok) {
      return customer
    }

    return ok({
      status: 'created' as const,
      customer: customer.value,
      contact: contact.value,
    })
  })
}

export function createPersonCustomerForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  draft: PersonCustomerWrite,
): ServiceResult<PersonCustomerResult> {
  const actor = requireCrmActor(persistence, currentUser)
  if (!actor.ok) {
    return actor
  }

  return createPersonCustomerInOrganization(
    persistence,
    actor.value.organizationId,
    draft,
  )
}

export function createPersonCustomerForRentalBookingForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  draft: PersonCustomerWrite,
): ServiceResult<PersonCustomerResult> {
  if (!currentUser) {
    return fail({ code: 'CURRENT_USER_REQUIRED' })
  }

  const actor = requireRentalActor(
    persistence,
    currentUser,
    currentUser.organizationId,
  )
  if (!actor.ok) {
    return actor
  }

  if (actor.value.status !== 'active') {
    return fail({ code: 'USER_INACTIVE' })
  }

  return createPersonCustomerInOrganization(
    persistence,
    actor.value.organizationId,
    draft,
  )
}

function requireCurrentOrgActor(
  currentUser: User | null | undefined,
): ServiceResult<User> {
  if (!currentUser) {
    return fail({ code: 'CURRENT_USER_REQUIRED' })
  }

  return requireActorInOrganization(currentUser, currentUser.organizationId)
}

function requireCrmActor(
  persistence: Persistence,
  currentUser: User | null | undefined,
): ServiceResult<User> {
  const gated = requireModuleEnabledForUser(persistence, currentUser, 'crm')
  if (!gated.ok) {
    return gated
  }

  return requireCurrentOrgActor(currentUser)
}
