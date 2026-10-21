import type { BaseEntity, Id, Nullable } from './common'

export type DealStatus = 'new' | 'in_progress' | 'won' | 'lost'

export type Deal = BaseEntity & {
  title: string
  amount: Nullable<number>
  currency: string
  companyId: Nullable<Id>
  contactId: Nullable<Id>
  status: DealStatus
  assignedUserId?: Id
  ownerUserId?: Id
  branchId?: Id
  departmentId?: Id
}
