import type { BaseEntity, Id } from './common'

export type MotivationPeriodKey = string

export type EmployeeMotivationPeriod = BaseEntity & {
  userId: Id
  periodKey: MotivationPeriodKey
  createdBy: Id
}

export type EmployeeMotivationLine = BaseEntity & {
  periodId: Id
  categoryId: Id
  planAmount: number
  bonusPercent: number
  reducedBonusCoefficient: number
  fullBonusCompletionPercent: number
  thresholdPercent: number
}
