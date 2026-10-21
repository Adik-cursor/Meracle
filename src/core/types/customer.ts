import type { BaseEntity } from './common'

export type CustomerType = 'contact' | 'company'

export type CustomerStatus = 'active' | 'inactive'

export type Customer = BaseEntity & {
  type: CustomerType
  contactId?: string
  companyId?: string
  status: CustomerStatus
  taxId?: string
  legalAddress?: string
}
