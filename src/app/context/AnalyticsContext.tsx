import { useMemo, useState, type ReactNode } from 'react'
import {
  customRangeFromDateInputs,
  getFinancialAnalyticsForUser,
  getRentalAnalyticsForUser,
  hasEffectiveFinancialPermission,
  isModuleEnabledForUser,
  resolveAnalyticsRange,
  resolvePreviousAnalyticsRange,
  type AnalyticsItemTypeFilter,
  type AnalyticsPeriod,
  type AnalyticsQuery,
} from '../../core/services'
import type { ExpenseCategory, Id, PaymentMethod } from '../../core/types'
import { useAccess } from './access-context'
import { AnalyticsContext, type AnalyticsContextValue } from './analytics-context'
import { usePersistence, usePersistenceVersion } from './persistence-context'

type AnalyticsProviderProps = {
  children: ReactNode
}

export function AnalyticsProvider({ children }: AnalyticsProviderProps) {
  const { currentUser } = useAccess()
  const persistence = usePersistence()
  const version = usePersistenceVersion()
  const [period, setPeriod] = useState<AnalyticsPeriod>('month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [branchId, setBranchId] = useState<Id | ''>('')
  const [warehouseId, setWarehouseId] = useState<Id | ''>('')
  const [userId, setUserId] = useState<Id | ''>('')
  const [itemType, setItemType] = useState<AnalyticsItemTypeFilter>('all')
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod | 'all'>('all')
  const [expenseCategory, setExpenseCategory] = useState<
    ExpenseCategory | 'all'
  >('all')

  const value = useMemo<AnalyticsContextValue>(() => {
    void version
    const query: AnalyticsQuery = {
      branchId: branchId || undefined,
      warehouseId: warehouseId || undefined,
      userId: userId || undefined,
      itemType,
      paymentMethod,
      expenseCategory,
    }

    const customReady = Boolean(customFrom && customTo)
    const waitingCustom = period === 'custom' && !customReady
    const nowIso = new Date().toISOString()
    const range = resolveAnalyticsRange(
      period,
      nowIso,
      period === 'custom' && customReady
        ? customRangeFromDateInputs(customFrom, customTo)
        : undefined,
    )
    const previousRange = resolvePreviousAnalyticsRange(period, range, nowIso)

    const controls = {
      period,
      setPeriod,
      customFrom,
      customTo,
      setCustomFrom,
      setCustomTo,
      query,
      setBranchId,
      setWarehouseId,
      setUserId,
      setItemType,
      setPaymentMethod,
      setExpenseCategory,
    }

    if (!currentUser) {
      return {
        ...controls,
        analytics: null,
        rentalAnalytics: null,
        errorCode: 'CURRENT_USER_REQUIRED',
        loading: false,
      }
    }

    if (waitingCustom) {
      return {
        ...controls,
        analytics: null,
        rentalAnalytics: null,
        errorCode: null,
        loading: false,
      }
    }

    const salesOn = isModuleEnabledForUser(persistence, currentUser, 'sales')
    const expensesOn = isModuleEnabledForUser(persistence, currentUser, 'expenses')
    const rentalOn = isModuleEnabledForUser(persistence, currentUser, 'rental')
    const canFinancial =
      hasEffectiveFinancialPermission(currentUser, 'financial_analytics.read') ||
      hasEffectiveFinancialPermission(currentUser, 'expenses.read')

    const financial =
      (salesOn || expensesOn) && canFinancial
        ? getFinancialAnalyticsForUser(
            persistence,
            currentUser,
            range,
            query,
            previousRange,
          )
        : undefined
    const rental = rentalOn
      ? getRentalAnalyticsForUser(persistence, currentUser, currentUser.organizationId, {
          at: nowIso,
          range,
          branchId: query.branchId,
          warehouseId: query.warehouseId,
          userId: query.userId,
        })
      : undefined

    const analytics = financial?.ok ? financial.value : null
    const rentalAnalytics = rental?.ok ? rental.value : null
    const errorCode =
      analytics || rentalAnalytics
        ? null
        : financial && !financial.ok
          ? financial.error.code
          : rental && !rental.ok
            ? rental.error.code
            : null

    return {
      ...controls,
      analytics,
      rentalAnalytics,
      errorCode,
      loading: false,
    }
  }, [
    branchId,
    currentUser,
    customFrom,
    customTo,
    expenseCategory,
    itemType,
    paymentMethod,
    period,
    persistence,
    userId,
    version,
    warehouseId,
  ])

  return (
    <AnalyticsContext.Provider value={value}>
      {children}
    </AnalyticsContext.Provider>
  )
}
