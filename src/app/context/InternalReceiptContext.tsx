import { useMemo, type ReactNode } from 'react'
import type { Id } from '../../core/types'
import {
  getInternalReceiptForUser,
  listInternalReceiptsForUser,
} from '../../core/services'
import { useAccess } from './access-context'
import { usePersistence, usePersistenceVersion } from './persistence-context'
import {
  InternalReceiptContext,
  type InternalReceiptContextValue,
} from './internal-receipt-context'

type InternalReceiptProviderProps = {
  children: ReactNode
}

export function InternalReceiptProvider({
  children,
}: InternalReceiptProviderProps) {
  const { currentUser } = useAccess()
  const persistence = usePersistence()
  const version = usePersistenceVersion()

  const value = useMemo<InternalReceiptContextValue>(() => {
    void version
    const listed = listInternalReceiptsForUser(persistence, currentUser)
    const receipts = listed.ok ? listed.value : []

    return {
      receipts,
      getBySaleId: (saleId: Id) =>
        receipts.find(
          (item) => item.saleId === saleId && item.receiptType === 'sale',
        ),
      listBySaleId: (saleId: Id) =>
        receipts
          .filter((item) => item.saleId === saleId && item.receiptType === 'sale')
          .sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
      getById: (id: Id) => {
        const allowed = getInternalReceiptForUser(persistence, currentUser, id)
        return allowed.ok ? allowed.value : undefined
      },
      getReceiptAccess: (id: Id) => {
        const allowed = getInternalReceiptForUser(persistence, currentUser, id)
        if (allowed.ok) {
          return { ok: true as const, receipt: allowed.value }
        }

        const code = allowed.error.code
        if (
          code === 'SALE_NOT_FOUND' ||
          code === 'ACCESS_DENIED' ||
          code === 'CURRENT_USER_REQUIRED'
        ) {
          return { ok: false as const, code }
        }

        return { ok: false as const, code: 'ACCESS_DENIED' as const }
      },
      getBySaleReturnId: (saleReturnId: Id) =>
        receipts.find((item) => item.saleReturnId === saleReturnId),
    }
  }, [currentUser, persistence, version])

  return (
    <InternalReceiptContext.Provider value={value}>
      {children}
    </InternalReceiptContext.Provider>
  )
}
