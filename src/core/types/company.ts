import type { BaseEntity, Nullable } from './common'

export type CompanyStatus = 'active' | 'inactive' | 'archived'

export type Company = BaseEntity & {
  name: string
  website: Nullable<string>
  status: CompanyStatus
}
