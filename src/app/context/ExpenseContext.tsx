import { useMemo, type ReactNode } from 'react'
import {
  createExpenseForUser,
  listExpensesForUser,
} from '../../core/services'
import { useAccess } from './access-context'
import { useOrganization } from './organization-context'
import { usePersistence, usePersistenceVersion } from './persistence-context'
import { ExpenseContext, type ExpenseContextValue } from './expense-context'

type ExpenseProviderProps = {
  children: ReactNode
}

export function ExpenseProvider({ children }: ExpenseProviderProps) {
  const { organization } = useOrganization()
  const { currentUser } = useAccess()
  const persistence = usePersistence()
  const version = usePersistenceVersion()

  const value = useMemo<ExpenseContextValue>(() => {
    void version
    const listed = listExpensesForUser(persistence, currentUser)

    return {
      expenses: listed.ok ? listed.value : [],
      createExpense: (draft) =>
        createExpenseForUser(
          persistence,
          currentUser,
          organization.id,
          draft,
        ),
    }
  }, [currentUser, organization.id, persistence, version])

  return (
    <ExpenseContext.Provider value={value}>{children}</ExpenseContext.Provider>
  )
}
