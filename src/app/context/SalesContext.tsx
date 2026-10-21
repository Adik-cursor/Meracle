import { useMemo, type ReactNode } from 'react'
import type { Id, Sale, SaleStockCheckResult } from '../../core/types'
import {
  cancelSaleForUser,
  checkoutSaleForUser,
  checkoutOnCreditForUser,
  completeSaleForUser,
  confirmSaleForUser,
  createSaleForUser,
  getSaleForUser,
  listSalesForAnalytics,
  listSalesForUser,
  toSaleStockCheckResult,
  updateSaleForUser,
} from '../../core/services'
import { getSaleRecord } from '../../core/services/sale-record'
import { toSaleFinancialView } from '../../core/services/financial-access'
import { useAccess } from './access-context'
import { useOrganization } from './organization-context'
import { usePersistence, usePersistenceVersion } from './persistence-context'
import {
  SalesContext,
  type SaleDraft,
  type SaleRecord,
  type SalesContextValue,
} from './sales-context'

type SalesProviderProps = {
  children: ReactNode
}

function toRecord(
  persistence: ReturnType<typeof usePersistence>,
  currentUser: ReturnType<typeof useAccess>['currentUser'],
  sale: Sale,
): SaleRecord {
  const view = toSaleFinancialView(persistence, currentUser, sale)
  return {
    sale,
    items: persistence.saleItems.listBySaleId(sale.id),
    financialView: view.ok ? view.value : null,
  }
}

export function SalesProvider({ children }: SalesProviderProps) {
  const { organization, settings } = useOrganization()
  const { currentUser } = useAccess()
  const persistence = usePersistence()
  const version = usePersistenceVersion()

  const value = useMemo<SalesContextValue>(() => {
    void version
    const listed = listSalesForUser(persistence, currentUser)
    const analytics = listSalesForAnalytics(persistence, currentUser)

    const getSale = (id: Id): SaleRecord | undefined => {
      const allowed = getSaleForUser(persistence, currentUser, id)
      if (!allowed.ok) {
        return undefined
      }

      const record = getSaleRecord(persistence, organization.id, id)
      if (!record) {
        return undefined
      }

      return toRecord(persistence, currentUser, record.sale)
    }

    const createSale = (draft: SaleDraft): SaleStockCheckResult => {
      const result = createSaleForUser(
        persistence,
        currentUser,
        organization.id,
        settings.currency,
        draft,
      )
      if (!result.ok) {
        return toSaleStockCheckResult(result)
      }

      return { ok: true, saleId: result.value.sale.id }
    }

    const updateSale = (id: Id, draft: SaleDraft): SaleStockCheckResult =>
      toSaleStockCheckResult(
        updateSaleForUser(
          persistence,
          currentUser,
          organization.id,
          id,
          settings.currency,
          draft,
        ),
      )

    const confirmSale = (id: Id): SaleStockCheckResult =>
      toSaleStockCheckResult(
        confirmSaleForUser(persistence, currentUser, organization.id, id),
      )

    const cancelSale = (id: Id): boolean =>
      cancelSaleForUser(persistence, currentUser, organization.id, id).ok

    const completeSale = (id: Id): SaleStockCheckResult =>
      toSaleStockCheckResult(
        completeSaleForUser(persistence, currentUser, organization.id, id),
      )

    const checkoutSale: SalesContextValue['checkoutSale'] = (id, draft) =>
      checkoutSaleForUser(
        persistence,
        currentUser,
        organization.id,
        id,
        draft,
      )

    const checkoutOnCredit: SalesContextValue['checkoutOnCredit'] = (id, draft) =>
      checkoutOnCreditForUser(
        persistence,
        currentUser,
        organization.id,
        id,
        draft ?? {},
      )

    return {
      sales: listed.ok
        ? listed.value.map((sale) => toRecord(persistence, currentUser, sale))
        : [],
      analyticsSales: analytics.ok
        ? analytics.value.map((sale) => {
            const record = toRecord(persistence, currentUser, sale)
            if (record.financialView?.canReadAmount) {
              return record
            }

            return {
              ...record,
              sale: {
                ...record.sale,
                subtotal: 0,
                discount: 0,
                total: 0,
              },
            }
          })
        : [],
      createSale,
      updateSale,
      confirmSale,
      cancelSale,
      completeSale,
      checkoutSale,
      checkoutOnCredit,
      getSale,
      getSaleAccess: (id: Id) => {
        const allowed = getSaleForUser(persistence, currentUser, id)
        if (allowed.ok) {
          return { ok: true as const, sale: allowed.value }
        }

        const code = allowed.error.code
        if (
          code === 'SALE_NOT_FOUND' ||
          code === 'ACCESS_DENIED' ||
          code === 'CURRENT_USER_REQUIRED' ||
          code === 'MODULE_NOT_ENABLED'
        ) {
          return { ok: false as const, code }
        }

        return { ok: false as const, code: 'ACCESS_DENIED' as const }
      },
    }
  }, [
    currentUser,
    organization.id,
    persistence,
    settings.currency,
    version,
  ])

  return (
    <SalesContext.Provider value={value}>{children}</SalesContext.Provider>
  )
}
