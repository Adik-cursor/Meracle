import { createContext, useContext } from 'react'
import type {
  Id,
  Payment,
  PaymentMethod,
  SalePaymentStatus,
} from '../../core/types'

export type PaymentDraft = {
  saleId: Id
  amount: number
  method: PaymentMethod
  note?: string
}

export type PaymentContextValue = {
  payments: Payment[]
  createPayment: (draft: PaymentDraft) => boolean
  cancelPayment: (id: Id) => boolean
  getSalePayments: (saleId: Id) => Payment[]
  getSalePaidAmount: (saleId: Id) => number
  getSaleDueAmount: (saleId: Id) => number
  getSalePaymentStatus: (saleId: Id) => SalePaymentStatus
  getPaidAmountByMethod: () => Record<PaymentMethod, number>
  getOutstandingAmount: () => number
}

export const PaymentContext = createContext<PaymentContextValue | null>(null)

export function usePayments(): PaymentContextValue {
  const context = useContext(PaymentContext)

  if (!context) {
    throw new Error('usePayments must be used within PaymentProvider')
  }

  return context
}
