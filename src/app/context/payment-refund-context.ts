import { createContext, useContext } from 'react'
import type { Id, PaymentRefund } from '../../core/types'

export type PaymentRefundDraft = {
  paymentId: Id
  amount: number
  returnId?: string
  note?: string
}

export type PaymentRefundContextValue = {
  refunds: PaymentRefund[]
  createRefund: (draft: PaymentRefundDraft) => boolean
  cancelRefund: (id: Id) => boolean
  getPaymentRefunds: (paymentId: Id) => PaymentRefund[]
  getRefundedAmount: (paymentId: Id) => number
  getRefundableAmount: (paymentId: Id) => number
  getReturnRefundableAmount: (returnId: Id) => number
  getSaleRefundedAmount: (saleId: Id) => number
  getSaleNetPaidAmount: (saleId: Id) => number
}

export const PaymentRefundContext =
  createContext<PaymentRefundContextValue | null>(null)

export function usePaymentRefunds(): PaymentRefundContextValue {
  const context = useContext(PaymentRefundContext)

  if (!context) {
    throw new Error(
      'usePaymentRefunds must be used within PaymentRefundProvider',
    )
  }

  return context
}
