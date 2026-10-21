import type { Id, Organization, PartySnapshot, User } from '../types'
import type { Persistence } from '../repositories/persistence'
import { getCustomerDisplayName } from '../../modules/crm/customers/customer-name'
import { customerTaxIdLabel } from './customers'
import { organizationTaxIdLabel } from '../pdf/invoice-format'
import { fail, ok, type ServiceResult } from '../types/domain-error'
import { hasEffectiveFinancialPermission, requireActorInOrganization } from './access'
import { requireModuleEnabledForUser } from './organization-modules'

export function requireSalesDocumentActor(
  persistence: Persistence,
  currentUser: User | null | undefined,
) {
  const gated = requireModuleEnabledForUser(persistence, currentUser, 'sales')
  if (!gated.ok) {
    return gated
  }
  return requireActorInOrganization(gated.value, gated.value.organizationId)
}

export function canIssueSalesDocuments(user: User): boolean {
  return (
    hasEffectiveFinancialPermission(user, 'sales.documents.create') ||
    hasEffectiveFinancialPermission(user, 'financial_documents.manage')
  )
}

export function requireSalesDocumentManage(
  persistence: Persistence,
  currentUser: User | null | undefined,
): ServiceResult<User> {
  const actor = requireSalesDocumentActor(persistence, currentUser)
  if (!actor.ok) {
    return actor
  }
  if (!hasEffectiveFinancialPermission(actor.value, 'financial_documents.manage')) {
    return fail({ code: 'FORBIDDEN' })
  }
  return actor
}

export function requireSalesDocumentIssue(
  persistence: Persistence,
  currentUser: User | null | undefined,
): ServiceResult<User> {
  const actor = requireSalesDocumentActor(persistence, currentUser)
  if (!actor.ok) {
    return actor
  }
  if (!canIssueSalesDocuments(actor.value)) {
    return fail({ code: 'FORBIDDEN' })
  }
  return actor
}

export function requireSalesDocumentRead(
  persistence: Persistence,
  currentUser: User | null | undefined,
): ServiceResult<User> {
  const actor = requireSalesDocumentActor(persistence, currentUser)
  if (!actor.ok) {
    return actor
  }
  if (!hasEffectiveFinancialPermission(actor.value, 'sales.read')) {
    return fail({ code: 'FORBIDDEN' })
  }
  return actor
}

export function nextDocumentNumber(
  numbers: readonly string[],
): string {
  let max = 0
  for (const value of numbers) {
    const parsed = Number.parseInt(value.replace(/\D/g, ''), 10)
    if (Number.isFinite(parsed) && parsed > max) {
      max = parsed
    }
  }
  return String(max + 1)
}

export function vatLabelFromOrganization(org?: Organization): string {
  return org?.vatStatus === 'vat' ? 'НДС' : 'Без НДС'
}

export function snapshotOrganization(
  persistence: Persistence,
  organizationId: Id,
): PartySnapshot {
  const org = persistence.organizations.getById(organizationId)
  return {
    name: org?.legalName?.trim() || org?.name || '',
    taxId: org?.taxId?.trim() || org?.bin?.trim() || '',
    taxLabel: organizationTaxIdLabel(org?.legalName),
    address: org?.legalAddress?.trim() || '',
    phone: '',
    bankName: org?.bankName?.trim() || '',
    iban: org?.iban?.trim() || '',
    bik: org?.bik?.trim() || '',
    kbe: org?.kbe?.trim() || '',
    knp: org?.knp?.trim() || '',
    vatLabel: vatLabelFromOrganization(org),
    stamp: org?.stamp?.trim() || '',
  }
}

export function snapshotCustomer(
  persistence: Persistence,
  organizationId: Id,
  customerId: Id,
): ServiceResult<PartySnapshot> {
  const customer = persistence.customers.getById(customerId)
  if (!customer || customer.organizationId !== organizationId) {
    return fail({ code: 'CUSTOMER_NOT_FOUND' })
  }
  const contacts = persistence.contacts.list(organizationId)
  const name = getCustomerDisplayName(customer, contacts, [])
  if (!name.trim()) {
    return fail({ code: 'CUSTOMER_NAME_REQUIRED' })
  }
  const contact = customer.contactId
    ? contacts.find((item) => item.id === customer.contactId)
    : undefined
  return ok({
    name,
    taxId: customer.taxId?.trim() || '',
    taxLabel: customerTaxIdLabel(customer.type),
    address: customer.legalAddress?.trim() || '',
    phone: contact?.phone?.trim() || '',
    bankName: '',
    iban: '',
    bik: '',
    kbe: '',
    knp: '',
    vatLabel: '',
    stamp: '',
  })
}

export function formatPartyRequisites(party: PartySnapshot): string {
  const chunks = [party.name]
  if (party.taxId) {
    chunks.push(`${party.taxLabel} ${party.taxId}`.trim())
  }
  if (party.address) {
    chunks.push(party.address)
  }
  if (party.phone) {
    chunks.push(`тел. ${party.phone}`)
  }
  const bank = [party.bankName, party.iban, party.bik, party.kbe, party.knp]
    .filter((item) => item.trim())
    .join(', ')
  if (bank) {
    chunks.push(bank)
  }
  return chunks.filter((item) => item.trim()).join(', ')
}

export function dayKey(iso: string): string {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(iso)
  return match?.[1] ?? iso.slice(0, 10)
}
