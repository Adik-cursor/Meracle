import { useMemo, type ReactNode } from 'react'
import type { Id, Payment } from '../../core/types'
import {
  cancelPaymentForUser,
  createPaymentForUser,
  listPaymentsForUser,
} from '../../core/services'
import {
  deriveSalePaymentStatus,
  getDueAmount,
  roundMoney,
  sumCompletedPayments,
  sumCompletedPaymentsByMethod,
} from '../../modules/sales/sale-payment'
import { useAccess } from './access-context'
import { useOrganization } from './organization-context'
import { useSales } from './sales-context'
import { usePersistence, usePersistenceVersion } from './persistence-context'
import {
  PaymentContext,
  type PaymentContextValue,
  type PaymentDraft,
} from './payment-context'

type PaymentProviderProps = {
  children: ReactNode
}

function sortNewestFirst(items: Payment[]): Payment[] {
  return [...items].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  )
}

export function PaymentProvider({ children }: PaymentProviderProps) {
  const { organization } = useOrganization()
  const { currentUser } = useAccess()
  const { getSale, sales } = useSales()
  const persistence = usePersistence()
  const version = usePersistenceVersion()

  const value = useMemo<PaymentContextValue>(() => {
    void version
    const listed = listPaymentsForUser(persistence, currentUser)
    const orgPayments = listed.ok ? listed.value : []

    const getSalePayments = (saleId: Id) =>
      sortNewestFirst(orgPayments.filter((payment) => payment.saleId === saleId))

    const getSalePaidAmount = (saleId: Id) => {
      const record = getSale(saleId)
      if (!record?.financialView?.canReadAmount) {
        return 0
      }

      return sumCompletedPayments(getSalePayments(saleId))
    }

    const getSaleDueAmount = (saleId: Id) => {
      const record = getSale(saleId)
      if (!record?.financialView?.canReadAmount) {
        return 0
      }

      return getDueAmount(record.sale.total, getSalePaidAmount(saleId))
    }

    return {
      payments: sortNewestFirst(orgPayments),
      createPayment: (draft: PaymentDraft) =>
        createPaymentForUser(persistence, currentUser, {
          organizationId: organization.id,
          createdBy: currentUser?.id ?? organization.id,
          saleId: draft.saleId,
          amount: draft.amount,
          method: draft.method,
          note: draft.note,
        }).ok,
      cancelPayment: (id: Id) =>
        cancelPaymentForUser(persistence, currentUser, organization.id, id).ok,
      getSalePayments,
      getSalePaidAmount,
      getSaleDueAmount,
      getSalePaymentStatus: (saleId: Id) => {
        const record = getSale(saleId)
        if (!record?.financialView?.canReadAmount) {
          return 'unpaid'
        }

        return deriveSalePaymentStatus(
          record.sale.total,
          getSalePaidAmount(saleId),
        )
      },
      getPaidAmountByMethod: () => sumCompletedPaymentsByMethod(orgPayments),
      getOutstandingAmount: () =>
        roundMoney(
          sales
            .filter(
              (record) =>
                record.financialView?.canReadAmount === true &&
                record.sale.status !== 'cancelled' &&
                record.sale.organizationId === organization.id,
            )
            .reduce(
              (sum, record) => sum + getSaleDueAmount(record.sale.id),
              0,
            ),
        ),
    }
  }, [currentUser, getSale, organization.id, persistence, sales, version])

  return (
    <PaymentContext.Provider value={value}>{children}</PaymentContext.Provider>
  )
}
