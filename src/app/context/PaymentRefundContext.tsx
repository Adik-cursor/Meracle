import { useMemo, type ReactNode } from 'react'
import type { Id, PaymentRefund } from '../../core/types'
import {
  cancelRefundForUser,
  createPaymentRefundForUser,
  listRefundsForUser,
} from '../../core/services'
import { roundMoney } from '../../modules/sales/sale-payment'
import { useAccess } from './access-context'
import { useOrganization } from './organization-context'
import { usePayments } from './payment-context'
import { useSaleReturns } from './sale-return-context'
import { usePersistence, usePersistenceVersion } from './persistence-context'
import {
  PaymentRefundContext,
  type PaymentRefundContextValue,
  type PaymentRefundDraft,
} from './payment-refund-context'

type PaymentRefundProviderProps = {
  children: ReactNode
}

function sortNewestFirst(items: PaymentRefund[]): PaymentRefund[] {
  return [...items].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  )
}

function sumCompletedRefunds(items: PaymentRefund[]): number {
  return roundMoney(
    items
      .filter((item) => item.status === 'completed')
      .reduce((sum, item) => sum + item.amount, 0),
  )
}

export function PaymentRefundProvider({ children }: PaymentRefundProviderProps) {
  const { organization } = useOrganization()
  const { currentUser } = useAccess()
  const { payments, getSalePaidAmount } = usePayments()
  const { returns } = useSaleReturns()
  const persistence = usePersistence()
  const version = usePersistenceVersion()

  const value = useMemo<PaymentRefundContextValue>(() => {
    void version
    const listed = listRefundsForUser(persistence, currentUser)
    const accessibleRefunds = listed.ok ? listed.value : []

    const getPaymentRefunds = (paymentId: Id) =>
      sortNewestFirst(
        accessibleRefunds.filter((refund) => refund.paymentId === paymentId),
      )

    const getRefundedAmount = (paymentId: Id) =>
      sumCompletedRefunds(getPaymentRefunds(paymentId))

    return {
      refunds: sortNewestFirst(accessibleRefunds),
      createRefund: (draft: PaymentRefundDraft) =>
        createPaymentRefundForUser(persistence, currentUser, {
          organizationId: organization.id,
          createdBy: currentUser?.id ?? organization.id,
          paymentId: draft.paymentId,
          amount: draft.amount,
          returnId: draft.returnId,
          note: draft.note,
        }).ok,
      cancelRefund: (id: Id) =>
        cancelRefundForUser(persistence, currentUser, organization.id, id).ok,
      getPaymentRefunds,
      getRefundedAmount,
      getRefundableAmount: (paymentId: Id) => {
        const payment = payments.find((item) => item.id === paymentId)

        if (
          !payment ||
          payment.status !== 'completed' ||
          payment.organizationId !== organization.id
        ) {
          return 0
        }

        return Math.max(
          0,
          roundMoney(payment.amount - getRefundedAmount(paymentId)),
        )
      },
      getReturnRefundableAmount: (returnId: Id) => {
        const record = returns.find((item) => item.return.id === returnId)

        if (
          !record ||
          record.return.organizationId !== organization.id ||
          record.return.status === 'cancelled'
        ) {
          return 0
        }

        const refundedForReturn = sumCompletedRefunds(
          accessibleRefunds.filter((refund) => refund.returnId === returnId),
        )

        return Math.max(0, roundMoney(record.return.total - refundedForReturn))
      },
      getSaleRefundedAmount: (saleId: Id) =>
        sumCompletedRefunds(
          accessibleRefunds.filter((refund) => refund.saleId === saleId),
        ),
      getSaleNetPaidAmount: (saleId: Id) =>
        roundMoney(
          getSalePaidAmount(saleId) -
            sumCompletedRefunds(
              accessibleRefunds.filter((refund) => refund.saleId === saleId),
            ),
        ),
    }
  }, [
    currentUser,
    getSalePaidAmount,
    organization.id,
    payments,
    persistence,
    returns,
    version,
  ])

  return (
    <PaymentRefundContext.Provider value={value}>
      {children}
    </PaymentRefundContext.Provider>
  )
}
