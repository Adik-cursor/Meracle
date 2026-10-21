import type { BaseEntity, Id } from './common'

export type CareChargeStatus = 'open' | 'cancelled'

export type CareCharge = BaseEntity & {
  customerId: Id
  childId: Id
  amount: number
  currency: string
  period?: string
  description: string
  dueDate?: string
  status: CareChargeStatus
  createdBy: Id
}
