import type { User } from '../types'
import { ok, type ServiceResult } from '../types/domain-error'
import type { Persistence } from '../repositories/persistence'
import { getCompanyDashboardForUser } from './company-dashboard'
import {
  currentCareChargePeriod,
  listKindergartenFinanceForUser,
} from './care-finance'
import { organizationPayrollRemainingForUser } from './employee-compensation'
import { currentMotivationPeriodKey } from './employee-motivation'
import {
  getFinancialAnalyticsForUser,
  resolveAnalyticsRange,
} from './financial-analytics'
import { isModuleEnabledForUser } from './organization-modules'
import { nowIso } from './primitives'

export type FinanceOverviewKpiId =
  | 'charged'
  | 'paid'
  | 'due'
  | 'prepayment'
  | 'rentalTotal'
  | 'revenue'
  | 'cogs'
  | 'grossProfit'
  | 'expenses'
  | 'result'
  | 'debt'
  | 'payrollRemaining'

export type FinanceOverviewKpi = {
  id: FinanceOverviewKpiId
  amount: number
}

export type FinanceOverviewView = {
  period: string
  kpis: FinanceOverviewKpi[]
}

export function getFinanceOverviewForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
): ServiceResult<FinanceOverviewView> {
  const dashboard = getCompanyDashboardForUser(persistence, currentUser)
  if (!dashboard.ok) {
    return dashboard
  }

  const period = currentMotivationPeriodKey()
  const payrollRemaining = organizationPayrollRemainingForUser(
    persistence,
    currentUser,
    period,
  )
  const view = dashboard.value
  const kpis: FinanceOverviewKpi[] = []

  if (isModuleEnabledForUser(persistence, currentUser, 'children') && view.care) {
    const finance = listKindergartenFinanceForUser(persistence, currentUser, {
      period: currentCareChargePeriod(),
    })
    kpis.push({
      id: 'charged',
      amount: finance.ok ? finance.value.charged : 0,
    })
    kpis.push({
      id: 'paid',
      amount: finance.ok ? finance.value.paid : view.care.paidAmount,
    })
    kpis.push({
      id: 'due',
      amount: finance.ok ? finance.value.due : view.care.debtRemaining,
    })
    if (view.care.expensesIncluded) {
      kpis.push({ id: 'expenses', amount: view.care.expenses })
      kpis.push({ id: 'result', amount: view.care.netResult })
    }
  } else if (isModuleEnabledForUser(persistence, currentUser, 'rental') && view.rental) {
    kpis.push({ id: 'rentalTotal', amount: view.rental.rentalTotal })
    kpis.push({ id: 'paid', amount: view.rental.paidAmount })
    kpis.push({ id: 'prepayment', amount: view.rental.prepayment })
    kpis.push({ id: 'due', amount: view.rental.dueAmount })
    if (view.rental.expensesIncluded) {
      kpis.push({ id: 'expenses', amount: view.rental.expenses })
      kpis.push({ id: 'result', amount: view.rental.netResult })
    }
  } else if (isModuleEnabledForUser(persistence, currentUser, 'sales') && view.sales) {
    const analytics = getFinancialAnalyticsForUser(
      persistence,
      currentUser,
      resolveAnalyticsRange('month', nowIso()),
    )
    if (analytics.ok) {
      kpis.push({ id: 'revenue', amount: analytics.value.kpis.revenue })
      kpis.push({
        id: 'paid',
        amount: analytics.value.payments.reduce((sum, row) => sum + row.amount, 0),
      })
      kpis.push({ id: 'cogs', amount: analytics.value.kpis.cogs })
      kpis.push({ id: 'grossProfit', amount: analytics.value.kpis.grossProfit })
      kpis.push({ id: 'expenses', amount: analytics.value.kpis.expenses })
      kpis.push({ id: 'result', amount: analytics.value.kpis.netProfit })
    } else {
      kpis.push({ id: 'revenue', amount: view.sales.revenue })
      if (view.expenses) {
        kpis.push({ id: 'expenses', amount: view.expenses.total })
      }
    }
    if (view.debts) {
      kpis.push({ id: 'debt', amount: view.debts.remaining })
    }
  } else if (view.expenses) {
    kpis.push({ id: 'expenses', amount: view.expenses.total })
  }

  kpis.push({ id: 'payrollRemaining', amount: payrollRemaining })

  return ok({ period, kpis })
}
