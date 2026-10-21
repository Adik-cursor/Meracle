import { useMemo, type ReactNode } from 'react'
import type { Id } from '../../core/types'
import {
  cancelTransferForUser,
  completeTransferForUser,
  createTransferForUser,
  listTransfersForUser,
  submitTransferForUser,
} from '../../core/services'
import { useAccess } from './access-context'
import { useOrganization } from './organization-context'
import { usePersistence, usePersistenceVersion } from './persistence-context'
import {
  WarehouseTransferContext,
  type WarehouseTransferContextValue,
  type WarehouseTransferDraft,
} from './warehouse-transfer-context'

type WarehouseTransferProviderProps = {
  children: ReactNode
}

export function WarehouseTransferProvider({
  children,
}: WarehouseTransferProviderProps) {
  const { organization } = useOrganization()
  const { currentUser } = useAccess()
  const persistence = usePersistence()
  const version = usePersistenceVersion()

  const value = useMemo<WarehouseTransferContextValue>(() => {
    void version
    const listed = listTransfersForUser(persistence, currentUser)

    return {
      transfers: listed.ok ? listed.value : [],
      createTransfer: (draft: WarehouseTransferDraft) =>
        createTransferForUser(persistence, currentUser, organization.id, draft)
          .ok,
      submitTransfer: (id: Id) =>
        submitTransferForUser(persistence, currentUser, organization.id, id)
          .ok,
      completeTransfer: (id: Id) =>
        completeTransferForUser(persistence, currentUser, organization.id, id)
          .ok,
      cancelTransfer: (id: Id) =>
        cancelTransferForUser(persistence, currentUser, organization.id, id)
          .ok,
    }
  }, [currentUser, organization.id, persistence, version])

  return (
    <WarehouseTransferContext.Provider value={value}>
      {children}
    </WarehouseTransferContext.Provider>
  )
}
