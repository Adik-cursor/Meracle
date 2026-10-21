import { createContext, useContext } from 'react'
import type { Deal, DealStatus, Id, Nullable } from '../../core/types'

export type DealDraft = {
  title: string
  amount: Nullable<number>
  companyId: Nullable<Id>
  contactId: Nullable<Id>
  status: DealStatus
  assignedUserId?: Id
}

export type DealContextValue = {
  deals: Deal[]
  getDeal: (id: Id) => Deal | undefined
  getDealAccess: (id: Id) => { ok: true; deal: Deal } | { ok: false; code: 'DEAL_NOT_FOUND' | 'ACCESS_DENIED' | 'CURRENT_USER_REQUIRED' | 'MODULE_NOT_ENABLED' }
  searchDeals: (query: string) => Deal[]
  createDeal: (draft: DealDraft) => Deal | undefined
  updateDeal: (id: Id, draft: DealDraft) => boolean
  setDealStatus: (id: Id, status: DealStatus) => void
  deleteDeal: (id: Id) => boolean
}

export const DealContext = createContext<DealContextValue | null>(null)

export function useDeals(): DealContextValue {
  const context = useContext(DealContext)

  if (!context) {
    throw new Error('useDeals must be used within DealProvider')
  }

  return context
}
