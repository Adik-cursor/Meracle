import type { Organization, User } from '../types'
import { fail, ok, type ServiceResult } from '../types/domain-error'
import type { Persistence } from '../repositories/persistence'
import type { Id } from '../types'
import { denyUnless, requireActorInOrganization } from './access'
import { nowIso, optionalText } from './primitives'

export const COMPANY_ORGANIZATION_CURRENCIES = ['KZT', 'USD', 'EUR', 'RUB'] as const
export const COMPANY_ORGANIZATION_TIMEZONES = [
  'Asia/Almaty',
  'Asia/Aqtobe',
  'Asia/Qyzylorda',
  'UTC',
] as const

export type CompanyOrganizationCurrency =
  (typeof COMPANY_ORGANIZATION_CURRENCIES)[number]
export type CompanyOrganizationTimezone =
  (typeof COMPANY_ORGANIZATION_TIMEZONES)[number]

export type CompanyOrganizationWrite = {
  name: string
  bin?: string
  currency: string
  timezone: string
  legalName?: string
  taxId?: string
  legalAddress?: string
  bankName?: string
  iban?: string
  bik?: string
  kbe?: string
  knp?: string
  vatStatus?: Organization['vatStatus']
  invoiceFooterNote?: string
  invoiceWarningNote?: string
  invoiceSignature?: string
}

export function canUpdateCompanyOrganization(
  currentUser: User | null | undefined,
): boolean {
  return currentUser?.role === 'owner'
}

function isAllowedCurrency(value: string): value is CompanyOrganizationCurrency {
  return COMPANY_ORGANIZATION_CURRENCIES.includes(
    value as CompanyOrganizationCurrency,
  )
}

function isAllowedTimezone(value: string): value is CompanyOrganizationTimezone {
  return COMPANY_ORGANIZATION_TIMEZONES.includes(
    value as CompanyOrganizationTimezone,
  )
}

export function updateCompanyOrganizationForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  organizationId: Id,
  draft: CompanyOrganizationWrite,
): ServiceResult<Organization> {
  const actor = requireActorInOrganization(currentUser, organizationId)
  if (!actor.ok) {
    return actor
  }

  const allowed = denyUnless(canUpdateCompanyOrganization(actor.value))
  if (!allowed.ok) {
    return allowed
  }

  const existing = persistence.organizations.getById(organizationId)
  if (!existing) {
    return fail({ code: 'ORGANIZATION_NOT_FOUND' })
  }

  if (existing.organizationId !== organizationId) {
    return fail({ code: 'ORGANIZATION_MISMATCH' })
  }

  const name = draft.name.trim()
  if (!name) {
    return fail({ code: 'INVALID_INPUT' })
  }

  const currency = draft.currency.trim()
  const timezone = draft.timezone.trim()
  if (!isAllowedCurrency(currency) || !isAllowedTimezone(timezone)) {
    return fail({ code: 'INVALID_INPUT' })
  }

  const bin = optionalText(draft.bin)
  if (bin && !/^[0-9A-Za-z]{1,12}$/.test(bin)) {
    return fail({ code: 'INVALID_INPUT' })
  }

  const updated = persistence.organizations.update(organizationId, {
    name,
    bin,
    currency,
    timezone,
    legalName: optionalText(draft.legalName),
    taxId: optionalText(draft.taxId),
    legalAddress: optionalText(draft.legalAddress),
    bankName: optionalText(draft.bankName),
    iban: optionalText(draft.iban),
    bik: optionalText(draft.bik),
    kbe: optionalText(draft.kbe) ?? '',
    knp: optionalText(draft.knp) ?? '',
    vatStatus: draft.vatStatus,
    invoiceFooterNote: optionalText(draft.invoiceFooterNote),
    invoiceWarningNote: optionalText(draft.invoiceWarningNote),
    invoiceSignature: optionalText(draft.invoiceSignature),
    updatedAt: nowIso(),
  })
  if (!updated) {
    return fail({ code: 'ORGANIZATION_NOT_FOUND' })
  }

  return ok(updated)
}
