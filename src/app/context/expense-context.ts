import { createContext, useContext } from 'react'
import type { Expense } from '../../core/types'
import type { ExpenseWrite } from '../../core/services'
import type { ServiceResult } from '../../core/types/domain-error'

export type ExpenseContextValue = {
  expenses: Expense[]
  createExpense: (draft: ExpenseWrite) => ServiceResult<Expense>
}

export const ExpenseContext = createContext<ExpenseContextValue | null>(null)

export function useExpenses(): ExpenseContextValue {
  const context = useContext(ExpenseContext)

  if (!context) {
    throw new Error('useExpenses must be used within ExpenseProvider')
  }

  return context
}
