import type { BaseEntity } from './common'

export type OrganizationStatus = 'active' | 'inactive' | 'suspended' | 'archived'

export type OrganizationVatStatus = 'vat' | 'no_vat'

export type Organization = BaseEntity & {
  name: string
  status: OrganizationStatus
  bin?: string
  currency?: string
  timezone?: string
  /** Configuration label only. Access is always OrganizationModuleConfig. */
  businessTypeId?: string
  legalName?: string
  taxId?: string
  legalAddress?: string
  bankName?: string
  iban?: string
  bik?: string
  kbe?: string
  knp?: string
  vatStatus?: OrganizationVatStatus
  logo?: string
  stamp?: string
  invoiceSignature?: string
  invoiceFooterNote?: string
  invoiceWarningNote?: string
}
