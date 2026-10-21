import type { BaseEntity, Id, Nullable } from './common'

export type ContactStatus = 'active' | 'inactive' | 'archived'

export type Contact = BaseEntity & {
  firstName: string
  lastName: string
  email: Nullable<string>
  phone: Nullable<string>
  companyId: Nullable<Id>
  status: ContactStatus
}
