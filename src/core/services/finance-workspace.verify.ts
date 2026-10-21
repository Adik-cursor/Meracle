import { defaultModules } from '../config/default-organization'
import {
  FINANCE_ANALYTICS_HREF,
  resolveFinanceNavGroups,
  resolveFinanceTabAlias,
  resolveFinanceWorkspaceTabs,
} from './module-access'
import { getSidebarItems } from '../../app/navigation/workspace-nav'
import type { CarePermission, FinancialPermission, User, UserRole, WarehousePermission } from '../types'
import { getFinancialPermissions } from '../types/financial-permission'
import { getWarehousePermissions } from '../types/warehouse-permission'
import { getCarePermissions } from '../types/care-permission'
import { isRouteEnabled } from '../../app/routes/app.routes'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function user(role: UserRole): User {
  const now = '2026-09-17T00:00:00.000Z'
  return {
    id: role,
    organizationId: 'org-finance-ws',
    email: `${role}@local`,
    firstName: role,
    lastName: 'User',
    role,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  }
}

function accessFor(role: UserRole, modules = defaultModules) {
  const currentUser = user(role)
  const financial = getFinancialPermissions(role)
  const warehouse = getWarehousePermissions(role)
  return {
    currentUser,
    modules,
    hasFinancialAccess: (permission: FinancialPermission) => financial.includes(permission),
    hasWarehouseAccess: (permission: WarehousePermission) => warehouse.includes(permission),
    hasCareAccess: (permission: CarePermission) => getCarePermissions(role).includes(permission),
  }
}

export function runFinanceWorkspaceChecks(): void {
  const kinder = resolveFinanceWorkspaceTabs({
    children: true,
    attendance: true,
    expenses: true,
    analytics: true,
    crm: true,
    sales: false,
    rental: false,
  })
  assert(!kinder.overview && !kinder.charges && kinder.analytics && kinder.salary, 'kinder tabs')
  assert(kinder.payments && kinder.debts && kinder.expenses, 'kinder money')
  assert(!kinder.operations, 'kinder no operations tab')

  const rental = resolveFinanceWorkspaceTabs({
    rental: true,
    expenses: true,
    analytics: true,
    crm: true,
    warehouses: true,
    sales: false,
    children: false,
  })
  assert(!rental.overview && rental.salary && rental.analytics && rental.payments, 'rental tabs')
  assert(!rental.charges && rental.debts, 'rental no charges, has debts')

  const dental = resolveFinanceWorkspaceTabs({
    sales: true,
    expenses: true,
    analytics: true,
    crm: true,
    warehouses: true,
    children: false,
    rental: false,
  })
  assert(!dental.overview && dental.salary && dental.analytics && dental.payments && dental.debts, 'dental tabs')
  assert(!dental.charges, 'dental no kindergarten charges')

  const kinderModules = {
    children: true,
    expenses: true,
    analytics: true,
    sales: false,
    rental: false,
  }
  assert(resolveFinanceTabAlias('overview', kinderModules) === 'analytics', 'overview maps to analytics')
  assert(resolveFinanceTabAlias('charges', kinderModules) === 'payments', 'charges maps to payments')
  assert(
    resolveFinanceNavGroups(kinderModules).map((group) => group.id).join(',') ===
      'analytics,domain,employees,operations',
    'kinder nav groups',
  )

  assert(FINANCE_ANALYTICS_HREF === '/finance?tab=analytics', 'analytics href')
  assert(
    isRouteEnabled(
      {
        path: '/analytics',
        labelKey: 'navAnalyticsSection',
        module: 'reports',
        enabled: true,
      },
      { ...defaultModules },
    ),
    'legacy analytics route',
  )

  const sidebar = getSidebarItems(accessFor('owner', {
    ...defaultModules,
    sales: false,
    warehouses: false,
    rental: false,
    children: true,
    attendance: true,
    expenses: true,
    analytics: true,
  })).map((item) => item.id)
  assert(sidebar.includes('finance'), 'finance in sidebar')
  assert(!sidebar.includes('analytics'), 'no separate analytics nav')

  console.log('finance-workspace.verify: ok')
}

runFinanceWorkspaceChecks()
