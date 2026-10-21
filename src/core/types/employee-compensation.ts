import type { BaseEntity, Id } from './common'

export type EmployeeCompensationRecordStatus = 'open' | 'cancelled'

export type EmployeePayoutKind = 'advance' | 'salary'

export type EmployeePeriodPayStatus = 'none' | 'accrued' | 'partial' | 'paid'

export type EmployeeCompensation = BaseEntity & {
  employeeUserId: Id
  period: string
  salaryAmount: number
  bonusAmount: number
  accruedAmount: number
  currency: string
  expenseId?: Id
  status: EmployeeCompensationRecordStatus
  createdBy: Id
}

export type EmployeePayout = BaseEntity & {
  compensationId: Id
  employeeUserId: Id
  kind: EmployeePayoutKind
  amount: number
  currency: string
  paidAt: string
  createdBy: Id
}

export function isEmployeeCompensationPeriod(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value)
}
