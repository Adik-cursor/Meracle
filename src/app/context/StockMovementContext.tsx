import { useMemo, type ReactNode } from 'react'
import type { Id, StockMovement } from '../../core/types'
import {
  createMovementForUser,
  createMovementsForUser,
  listAccessibleMovementsForUser,
} from '../../core/services'
import { useAccess } from './access-context'
import { useOrganization } from './organization-context'
import { usePersistence, usePersistenceVersion } from './persistence-context'
import {
  StockMovementContext,
  type StockMovementContextValue,
  type StockMovementDraft,
} from './stock-movement-context'

type StockMovementProviderProps = {
  children: ReactNode
}

function sortNewestFirst(items: StockMovement[]): StockMovement[] {
  return [...items].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  )
}

export function StockMovementProvider({ children }: StockMovementProviderProps) {
  const { organization } = useOrganization()
  const { currentUser } = useAccess()
  const persistence = usePersistence()
  const version = usePersistenceVersion()

  const value = useMemo<StockMovementContextValue>(() => {
    void version
    const listed = listAccessibleMovementsForUser(persistence, currentUser)
    const movements = listed.ok ? sortNewestFirst(listed.value) : []

    return {
      movements,
      createMovement: (draft: StockMovementDraft) => {
        if (!currentUser) {
          return
        }

        createMovementForUser(
          persistence,
          currentUser,
          organization.id,
          currentUser.id,
          draft,
        )
      },
      createMovements: (drafts: StockMovementDraft[]) => {
        if (!currentUser) {
          return false
        }

        return createMovementsForUser(
          persistence,
          currentUser,
          organization.id,
          currentUser.id,
          drafts,
        ).ok
      },
      getProductMovements: (productId: Id) =>
        movements.filter((movement) => movement.productId === productId),
    }
  }, [currentUser, organization.id, persistence, version])

  return (
    <StockMovementContext.Provider value={value}>
      {children}
    </StockMovementContext.Provider>
  )
}
