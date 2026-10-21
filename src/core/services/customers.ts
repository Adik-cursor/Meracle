import type { Customer, CustomerStatus, CustomerType, Id, User } from '../types'
import { fail, ok, okVoid, type ServiceResult } from '../types/domain-error'
import type { Persistence } from '../repositories/persistence'
import { belongsToOrganization } from './catalog'
import { requireActorInOrganization } from './access'
import { requireModuleEnabledForUser } from './organization-modules'
import { nowIso, newId } from './primitives'

export function normalizeCustomerTaxId(
  value: string | undefined,
): ServiceResult<string | undefined> {
  if (value == null || value.trim() === '') {
    return ok(undefined)
  }

  const digits = value.replace(/\s+/g, '')
  if (!/^\d{12}$/.test(digits)) {
    return fail({ code: 'CUSTOMER_TAX_ID_INVALID' })
  }

  return ok(digits)
}

export function customerTaxIdLabel(type: CustomerType): 'ИИН' | 'БИН' {
  return type === 'company' ? 'БИН' : 'ИИН'
}

export type CustomerWrite = {
  type: CustomerType
  contactId?: string
  companyId?: string
  status: CustomerStatus
  taxId?: string
  legalAddress?: string
}

export type CustomerPartyLookup = {
  getContact: (id: Id) => { organizationId: Id } | undefined
  getCompany: (id: Id) => { organizationId: Id } | undefined
}

function requireCustomer(
  persistence: Persistence,
  organizationId: Id,
  id: Id,
): ServiceResult<Customer> {
  const customer = persistence.customers.getById(id)

  if (!customer) {
    return fail({ code: 'CUSTOMER_NOT_FOUND' })
  }

  if (!belongsToOrganization(customer, organizationId)) {
    return fail({ code: 'ORGANIZATION_MISMATCH' })
  }

  return ok(customer)
}

function buildCustomer(
  organizationId: Id,
  draft: CustomerWrite,
  lookup: CustomerPartyLookup,
  existing?: Customer,
): ServiceResult<Customer> {
  if (draft.contactId?.trim() && draft.companyId?.trim()) {
    return fail({ code: 'CUSTOMER_INVALID' })
  }

  const now = nowIso()

  const taxId = normalizeCustomerTaxId(draft.taxId)
  if (!taxId.ok) {
    return taxId
  }

  if (draft.type === 'contact') {
    const contactId = draft.contactId?.trim()

    if (!contactId || draft.companyId?.trim()) {
      return fail({ code: 'CUSTOMER_INVALID' })
    }

    const contact = lookup.getContact(contactId)
    if (!contact || contact.organizationId !== organizationId) {
      return fail({ code: 'CUSTOMER_INVALID' })
    }

    return ok({
      id: existing?.id ?? newId(),
      organizationId,
      type: 'contact',
      contactId,
      status: draft.status,
      taxId: taxId.value,
      legalAddress: draft.legalAddress?.trim() || undefined,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    })
  }

  const companyId = draft.companyId?.trim()

  if (!companyId || draft.contactId?.trim()) {
    return fail({ code: 'CUSTOMER_INVALID' })
  }

  const company = lookup.getCompany(companyId)
  if (!company || company.organizationId !== organizationId) {
    return fail({ code: 'CUSTOMER_INVALID' })
  }

  return ok({
    id: existing?.id ?? newId(),
    organizationId,
    type: 'company',
    companyId,
    status: draft.status,
    taxId: taxId.value,
    legalAddress: draft.legalAddress?.trim() || undefined,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  })
}

export function createCustomer(
  persistence: Persistence,
  organizationId: Id,
  draft: CustomerWrite,
  lookup: CustomerPartyLookup,
): ServiceResult<Customer> {
  const customer = buildCustomer(organizationId, draft, lookup)
  if (!customer.ok) {
    return customer
  }

  return ok(persistence.customers.create(customer.value))
}

export function updateCustomer(
  persistence: Persistence,
  organizationId: Id,
  id: Id,
  draft: CustomerWrite,
  lookup: CustomerPartyLookup,
): ServiceResult<Customer> {
  const existing = requireCustomer(persistence, organizationId, id)
  if (!existing.ok) {
    return existing
  }

  const customer = buildCustomer(organizationId, draft, lookup, existing.value)
  if (!customer.ok) {
    return customer
  }

  const updated = persistence.customers.update(id, customer.value)
  if (!updated) {
    return fail({ code: 'CUSTOMER_NOT_FOUND' })
  }

  return ok(updated)
}

export function updateCustomerForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  id: Id,
  draft: CustomerWrite,
  lookup: CustomerPartyLookup,
): ServiceResult<Customer> {
  const gated = requireModuleEnabledForUser(persistence, currentUser, 'crm')
  if (!gated.ok) {
    return gated
  }

  const actor = requireActorInOrganization(currentUser, gated.value.organizationId)
  if (!actor.ok) {
    return actor
  }

  return updateCustomer(persistence, actor.value.organizationId, id, draft, lookup)
}

export function setCustomerStatus(
  persistence: Persistence,
  organizationId: Id,
  id: Id,
  status: CustomerStatus,
): ServiceResult {
  const existing = requireCustomer(persistence, organizationId, id)
  if (!existing.ok) {
    return existing
  }

  const updated = persistence.customers.update(id, {
    status,
    updatedAt: nowIso(),
  })

  if (!updated) {
    return fail({ code: 'CUSTOMER_NOT_FOUND' })
  }

  return okVoid()
}
