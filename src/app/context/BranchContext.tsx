import { useMemo, type ReactNode } from 'react'
import type { BranchStatus, Id } from '../../core/types'
import {
  createBranchForUser,
  getBranchForUser,
  listBranchesForUser,
  setBranchStatusForUser,
  updateBranchForUser,
} from '../../core/services'
import { useAccess } from './access-context'
import { useOrganization } from './organization-context'
import { usePersistence, usePersistenceVersion } from './persistence-context'
import {
  BranchContext,
  type BranchContextValue,
  type BranchDraft,
} from './branch-context'

type BranchProviderProps = {
  children: ReactNode
}

export function BranchProvider({ children }: BranchProviderProps) {
  const { organization } = useOrganization()
  const { currentUser } = useAccess()
  const persistence = usePersistence()
  const version = usePersistenceVersion()

  const value = useMemo<BranchContextValue>(() => {
    void version
    const listed = listBranchesForUser(persistence, currentUser)

    return {
      branches: listed.ok ? listed.value : [],
      getBranch: (id: Id) => {
        const result = getBranchForUser(persistence, currentUser, id)
        return result.ok ? result.value : undefined
      },
      getBranchAccess: (id: Id) => {
        const result = getBranchForUser(persistence, currentUser, id)
        if (result.ok) {
          return { ok: true as const, branch: result.value }
        }

        const code = result.error.code
        if (code === 'BRANCH_NOT_FOUND' || code === 'ACCESS_DENIED' || code === 'CURRENT_USER_REQUIRED') {
          return { ok: false as const, code }
        }

        return { ok: false as const, code: 'ACCESS_DENIED' as const }
      },
      createBranch: (draft: BranchDraft) =>
        createBranchForUser(persistence, currentUser, organization.id, draft)
          .ok,
      updateBranch: (id: Id, draft: BranchDraft) =>
        updateBranchForUser(
          persistence,
          currentUser,
          organization.id,
          id,
          draft,
        ).ok,
      setBranchStatus: (id: Id, status: BranchStatus) => {
        setBranchStatusForUser(
          persistence,
          currentUser,
          organization.id,
          id,
          status,
        )
      },
    }
  }, [currentUser, organization.id, persistence, version])

  return (
    <BranchContext.Provider value={value}>{children}</BranchContext.Provider>
  )
}
