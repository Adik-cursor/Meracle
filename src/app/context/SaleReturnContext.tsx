import { useMemo, type ReactNode } from 'react'
import type { Id, SaleReturn } from '../../core/types'
import {
  cancelReturnForUser,
  completeReturnForUser,
  createReturnForUser,
  getReturnableQuantity as getReturnableQuantityService,
  getReturnedQuantity as getReturnedQuantityService,
  listReturnsForUser,
} from '../../core/services'
import { useAccess } from './access-context'
import { useOrganization } from './organization-context'
import { usePersistence, usePersistenceVersion } from './persistence-context'
import {
  SaleReturnContext,
  type SaleReturnContextValue,
  type SaleReturnDraft,
  type SaleReturnRecord,
} from './sale-return-context'

type SaleReturnProviderProps = {
  children: ReactNode
}

export function SaleReturnProvider({ children }: SaleReturnProviderProps) {
  const { organization } = useOrganization()
  const { currentUser } = useAccess()
  const persistence = usePersistence()
  const version = usePersistenceVersion()

  const value = useMemo<SaleReturnContextValue>(() => {
    void version

    const toRecord = (saleReturn: SaleReturn): SaleReturnRecord => ({
      return: saleReturn,
      items: persistence.saleReturnItems.listByReturnId(saleReturn.id),
    })

    const listed = listReturnsForUser(persistence, currentUser)
    const records = listed.ok ? listed.value.map(toRecord) : []

    return {
      returns: records,
      createReturn: (draft: SaleReturnDraft) =>
        createReturnForUser(persistence, currentUser, organization.id, draft)
          .ok,
      completeReturn: (id: Id) =>
        completeReturnForUser(persistence, currentUser, organization.id, id)
          .ok,
      cancelReturn: (id: Id) =>
        cancelReturnForUser(persistence, currentUser, organization.id, id).ok,
      getSaleReturns: (saleId: Id) =>
        records.filter((record) => record.return.saleId === saleId),
      getReturnedQuantity: (saleItemId: Id) =>
        getReturnedQuantityService(persistence, organization.id, saleItemId),
      getReturnableQuantity: (saleItemId: Id) =>
        getReturnableQuantityService(persistence, organization.id, saleItemId),
    }
  }, [currentUser, organization.id, persistence, version])

  return (
    <SaleReturnContext.Provider value={value}>
      {children}
    </SaleReturnContext.Provider>
  )
}
