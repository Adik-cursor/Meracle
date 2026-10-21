import type { OrganizationModules } from '../types/modules'

export type AnalyticsOverviewAccess = {
  canSalesAnalytics: boolean
  canExpenseAnalytics: boolean
  canRentalAnalytics: boolean
  canCareAnalytics: boolean
}

export type AnalyticsOverviewBlocks = {
  sales: boolean
  expenses: boolean
  rental: boolean
  care: boolean
}

export function resolveAnalyticsOverviewBlocks(
  modules: Pick<
    OrganizationModules,
    'sales' | 'expenses' | 'rental' | 'children' | 'attendance'
  >,
  access: AnalyticsOverviewAccess,
): AnalyticsOverviewBlocks {
  return {
    sales: modules.sales === true && access.canSalesAnalytics,
    expenses: modules.expenses === true && access.canExpenseAnalytics,
    rental: modules.rental === true && access.canRentalAnalytics,
    care: modules.children === true && access.canCareAnalytics,
  }
}
