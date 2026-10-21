import { createContext, useContext } from 'react'
import type { Branch, BranchStatus, Id } from '../../core/types'

export type BranchDraft = {
  name: string
  code?: string
}

export type BranchContextValue = {
  branches: Branch[]
  getBranch: (id: Id) => Branch | undefined
  getBranchAccess: (
    id: Id,
  ) =>
    | { ok: true; branch: Branch }
    | { ok: false; code: 'BRANCH_NOT_FOUND' | 'ACCESS_DENIED' | 'CURRENT_USER_REQUIRED' }
  createBranch: (draft: BranchDraft) => boolean
  updateBranch: (id: Id, draft: BranchDraft) => boolean
  setBranchStatus: (id: Id, status: BranchStatus) => void
}

export const BranchContext = createContext<BranchContextValue | null>(null)

export function useBranches(): BranchContextValue {
  const context = useContext(BranchContext)

  if (!context) {
    throw new Error('useBranches must be used within BranchProvider')
  }

  return context
}
