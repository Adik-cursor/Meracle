import { useMemo, type ReactNode } from 'react'
import type { DealStatus, Id } from '../../core/types'
import {
  createDealForUser,
  deleteDealForUser,
  getDealForUser,
  listDealsForUser,
  searchDealsForUser,
  setDealStatusForUser,
  updateDealForUser,
} from '../../core/services'
import { useAccess } from './access-context'
import { useCompanies } from './company-context'
import { useContacts } from './contact-context'
import {
  DealContext,
  type DealContextValue,
  type DealDraft,
} from './deal-context'
import { useOrganization } from './organization-context'
import { usePersistence, usePersistenceVersion } from './persistence-context'

type DealProviderProps = {
  children: ReactNode
}

export function DealProvider({ children }: DealProviderProps) {
  const { organization, settings } = useOrganization()
  const { currentUser } = useAccess()
  const { getContact } = useContacts()
  const { getCompany } = useCompanies()
  const persistence = usePersistence()
  const version = usePersistenceVersion()

  const value = useMemo<DealContextValue>(() => {
    void version
    const lookup = { getContact, getCompany }
    const listed = listDealsForUser(persistence, currentUser)

    return {
      deals: listed.ok ? listed.value : [],
      getDeal: (id: Id) => {
        const result = getDealForUser(persistence, currentUser, id)
        return result.ok ? result.value : undefined
      },
      getDealAccess: (id: Id) => {
        const result = getDealForUser(persistence, currentUser, id)
        if (result.ok) {
          return { ok: true as const, deal: result.value }
        }

        const code = result.error.code
        if (
          code === 'DEAL_NOT_FOUND' ||
          code === 'ACCESS_DENIED' ||
          code === 'CURRENT_USER_REQUIRED' ||
          code === 'MODULE_NOT_ENABLED'
        ) {
          return { ok: false as const, code }
        }

        return { ok: false as const, code: 'ACCESS_DENIED' }
      },
      searchDeals: (query: string) => {
        const result = searchDealsForUser(
          persistence,
          currentUser,
          query,
          lookup,
        )
        return result.ok ? result.value : []
      },
      createDeal: (draft: DealDraft) => {
        const result = createDealForUser(
          persistence,
          currentUser,
          organization.id,
          { ...draft, currency: settings.currency },
          lookup,
        )
        return result.ok ? result.value : undefined
      },
      updateDeal: (id: Id, draft: DealDraft) =>
        updateDealForUser(
          persistence,
          currentUser,
          organization.id,
          id,
          { ...draft, currency: settings.currency },
          lookup,
        ).ok,
      setDealStatus: (id: Id, status: DealStatus) => {
        setDealStatusForUser(
          persistence,
          currentUser,
          organization.id,
          id,
          status,
        )
      },
      deleteDeal: (id: Id) =>
        deleteDealForUser(persistence, currentUser, organization.id, id).ok,
    }
  }, [
    currentUser,
    getCompany,
    getContact,
    organization.id,
    persistence,
    settings.currency,
    version,
  ])

  return <DealContext.Provider value={value}>{children}</DealContext.Provider>
}
