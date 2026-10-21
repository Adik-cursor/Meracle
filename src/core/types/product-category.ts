import type { BaseEntity, Id } from './common'
import type { SupplyContractProfile } from './supply-contract'

export type ProductCategoryStatus = 'active' | 'inactive'

export type ProductCategory = BaseEntity & {
  name: string
  status: ProductCategoryStatus
  createdBy: Id
  description?: string
  supplyProfile?: SupplyContractProfile
}
