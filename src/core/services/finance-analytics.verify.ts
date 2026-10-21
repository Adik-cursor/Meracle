import { defaultModules } from '../config/default-organization'
import {
  FINANCE_ANALYTICS_HREF,
  resolveFinanceNavGroups,
  resolveFinanceTabAlias,
  resolveFinanceWorkspaceTabs,
} from './module-access'
import { resolveAnalyticsOverviewBlocks } from './analytics-overview'
import { isRouteEnabled } from '../../app/routes/app.routes'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

export function runFinanceAnalyticsChecks(): void {
  const kinder = resolveFinanceWorkspaceTabs({
    children: true,
    attendance: true,
    expenses: true,
    analytics: true,
    crm: true,
    sales: false,
    rental: false,
  })
  assert(
    !kinder.overview && !kinder.charges && !kinder.operations,
    'kindergarten has no picture/charges/operations tabs',
  )
  assert(kinder.analytics && kinder.salary, 'kindergarten analytics and salary')
  assert(kinder.payments && kinder.debts && kinder.expenses, 'kindergarten money tabs')

  const rental = resolveFinanceWorkspaceTabs({
    rental: true,
    expenses: true,
    analytics: true,
    crm: true,
    warehouses: true,
    sales: false,
    children: false,
  })
  assert(
    !rental.overview && !rental.charges && !rental.operations,
    'rental has no picture/charges tabs',
  )
  assert(rental.analytics && rental.payments, 'rental finance tabs')
  assert(rental.salary, 'rental salary tab')
  assert(rental.debts && rental.expenses, 'rental debts and expenses')

  const dental = resolveFinanceWorkspaceTabs({
    sales: true,
    expenses: true,
    analytics: true,
    crm: true,
    warehouses: true,
    children: false,
    rental: false,
  })
  assert(
    !dental.overview && !dental.charges && !dental.operations,
    'dental has no picture/charges tabs',
  )
  assert(dental.analytics && dental.payments && dental.debts, 'dental finance tabs')
  assert(dental.salary, 'dental salary tab')

  const universal = resolveFinanceWorkspaceTabs({
    crm: true,
    expenses: true,
    sales: false,
    rental: false,
    children: false,
    warehouses: false,
  })
  assert(
    !universal.overview && universal.expenses && universal.salary,
    'universal finance follows enabled modules',
  )
  assert(
    !universal.charges && !universal.payments && !universal.debts,
    'universal without sales/rental/children hides those tabs',
  )

  assert(FINANCE_ANALYTICS_HREF === '/finance?tab=analytics', 'analytics lives under finance')

  const analyticsRoute = {
    path: '/analytics' as const,
    labelKey: 'navAnalyticsSection' as const,
    module: 'reports' as const,
    enabled: true,
  }
  assert(isRouteEnabled(analyticsRoute, { ...defaultModules }), 'legacy /analytics stays enabled')
  assert(
    isRouteEnabled(analyticsRoute, {
      ...defaultModules,
      analytics: false,
      reports: false,
      sales: false,
      expenses: true,
    }),
    'finance expenses still keep /analytics compatibility',
  )
  assert(
    !isRouteEnabled(analyticsRoute, {
      ...defaultModules,
      analytics: false,
      reports: false,
      expenses: false,
      children: false,
      rental: false,
      sales: false,
      attendance: true,
    }),
    'attendance alone does not keep analytics route',
  )

  const careBlocks = resolveAnalyticsOverviewBlocks(
    { sales: false, expenses: true, rental: false, children: true, attendance: true },
    {
      canSalesAnalytics: true,
      canExpenseAnalytics: true,
      canRentalAnalytics: false,
      canCareAnalytics: true,
    },
  )
  assert(careBlocks.care && !careBlocks.sales && !careBlocks.rental, 'kindergarten analytics sources')

  const rentalBlocks = resolveAnalyticsOverviewBlocks(
    { sales: false, expenses: true, rental: true, children: false, attendance: true },
    {
      canSalesAnalytics: true,
      canExpenseAnalytics: true,
      canRentalAnalytics: true,
      canCareAnalytics: true,
    },
  )
  assert(rentalBlocks.rental && !rentalBlocks.care && !rentalBlocks.sales, 'rental analytics not kindergarten')

  const dentalBlocks = resolveAnalyticsOverviewBlocks(
    { sales: true, expenses: true, rental: false, children: false, attendance: true },
    {
      canSalesAnalytics: true,
      canExpenseAnalytics: true,
      canRentalAnalytics: false,
      canCareAnalytics: true,
    },
  )
  assert(dentalBlocks.sales && !dentalBlocks.care && !dentalBlocks.rental, 'dental analytics not mixed')

  const kinderModules = {
    children: true,
    attendance: true,
    expenses: true,
    analytics: true,
    crm: true,
    sales: false,
    rental: false,
  }
  assert(resolveFinanceTabAlias('overview', kinderModules) === 'analytics', 'overview aliases to analytics')
  assert(resolveFinanceTabAlias('charges', kinderModules) === 'payments', 'charges aliases to payments')
  assert(resolveFinanceTabAlias('operations', kinderModules) === 'expenses', 'operations aliases to expenses')
  assert(resolveFinanceTabAlias('debts', kinderModules) === 'debts', 'kindergarten keeps debts workspace')
  const kinderGroups = resolveFinanceNavGroups(kinderModules)
  assert(
    kinderGroups.some((group) => group.id === 'domain' && group.labelKey === 'financeNavKindergarten'),
    'kindergarten domain group',
  )
  assert(
    !kinderGroups.some((group) => group.tabs.includes('charges')),
    'no charges in nav',
  )

  const rentalModules = {
    rental: true,
    expenses: true,
    analytics: true,
    crm: true,
    warehouses: true,
    sales: false,
    children: false,
  }
  assert(
    resolveFinanceNavGroups(rentalModules).some(
      (group) => group.labelKey === 'financeNavRental' && group.tabs.includes('payments'),
    ),
    'rental domain group',
  )

  const dentalModules = {
    sales: true,
    expenses: true,
    analytics: true,
    crm: true,
    warehouses: true,
    children: false,
    rental: false,
  }
  assert(
    resolveFinanceNavGroups(dentalModules).some(
      (group) => group.labelKey === 'navSalesSection' && group.tabs.includes('debts'),
    ),
    'dental sales group',
  )

  console.log('finance-analytics.verify: ok')
}

runFinanceAnalyticsChecks()
