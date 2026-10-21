import type { BaseEntity, Id } from './common'

export type ExpenseCategory =
  | 'rent'
  | 'salary'
  | 'marketing'
  | 'delivery'
  | 'procurement'
  | 'utilities'
  | 'tax'
  | 'bank_commission'
  | 'other'

export const EXPENSE_CATEGORIES: readonly ExpenseCategory[] = [
  'rent',
  'salary',
  'marketing',
  'delivery',
  'procurement',
  'utilities',
  'tax',
  'bank_commission',
  'other',
]

export type Expense = BaseEntity & {
  branchId?: Id
  category: ExpenseCategory
  description: string
  amount: number
  date: string
  comment?: string
  createdByUserId: Id
  employeeUserId?: Id
  compensationId?: Id
}

export function isExpenseCategory(value: string): value is ExpenseCategory {
  return EXPENSE_CATEGORIES.includes(value as ExpenseCategory)
}
