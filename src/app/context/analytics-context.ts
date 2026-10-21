import { createContext, useContext } from 'react'
import type {
  AnalyticsItemTypeFilter,
  AnalyticsPeriod,
  AnalyticsQuery,
  FinancialAnalytics,
  RentalAnalytics,
} from '../../core/services'
import type { DomainErrorCode, ExpenseCategory, Id, PaymentMethod } from '../../core/types'

export type AnalyticsContextValue = {
  period: AnalyticsPeriod
  setPeriod: (period: AnalyticsPeriod) => void
  customFrom: string
  customTo: string
  setCustomFrom: (value: string) => void
  setCustomTo: (value: string) => void
  query: AnalyticsQuery
  setBranchId: (value: Id | '') => void
  setWarehouseId: (value: Id | '') => void
  setUserId: (value: Id | '') => void
  setItemType: (value: AnalyticsItemTypeFilter) => void
  setPaymentMethod: (value: PaymentMethod | 'all') => void
  setExpenseCategory: (value: ExpenseCategory | 'all') => void
  analytics: FinancialAnalytics | null
  rentalAnalytics: RentalAnalytics | null
  errorCode: DomainErrorCode | null
  loading: boolean
}

export const AnalyticsContext = createContext<AnalyticsContextValue | null>(null)

export function useAnalytics(): AnalyticsContextValue {
  const context = useContext(AnalyticsContext)

  if (!context) {
    throw new Error('useAnalytics must be used within AnalyticsProvider')
  }

  return context
}
