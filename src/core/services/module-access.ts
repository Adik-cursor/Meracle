export type ModuleAccessFlags = {
  sales?: boolean
  warehouses?: boolean
  children?: boolean
  attendance?: boolean
  rental?: boolean
  expenses?: boolean
  analytics?: boolean
  plans?: boolean
  crm?: boolean
}

export function isEmployeeRoleAvailableForModules(
  role:
    | 'owner'
    | 'commercial_director'
    | 'branch_director'
    | 'sales_manager'
    | 'sales_employee'
    | 'warehouse_manager'
    | 'office_employee'
    | 'accountant'
    | 'kindergarten_admin',
  modules: ModuleAccessFlags,
): boolean {
  if (role === 'owner') {
    return false
  }
  if (
    role === 'commercial_director' ||
    role === 'sales_manager' ||
    role === 'sales_employee'
  ) {
    return modules.sales === true
  }
  if (role === 'warehouse_manager') {
    return modules.warehouses === true
  }
  if (role === 'branch_director') {
    return modules.sales === true || modules.warehouses === true
  }
  if (role === 'kindergarten_admin') {
    return modules.children === true
  }
  return true
}

export type FinanceWorkspaceTabId =
  | 'overview'
  | 'analytics'
  | 'operations'
  | 'payments'
  | 'charges'
  | 'salary'
  | 'debts'
  | 'expenses'

export type FinanceNavGroup = {
  id: 'analytics' | 'domain' | 'employees' | 'operations'
  labelKey:
    | 'navAnalyticsSection'
    | 'financeNavKindergarten'
    | 'financeNavRental'
    | 'navSalesSection'
    | 'financeNavMoney'
    | 'financeNavEmployees'
    | 'financeNavOperations'
  tabs: FinanceWorkspaceTabId[]
}

export function resolveFinanceWorkspaceTabs(modules: ModuleAccessFlags): Record<
  FinanceWorkspaceTabId,
  boolean
> {
  const children = modules.children === true
  const rental = modules.rental === true
  const sales = modules.sales === true
  const expenses = modules.expenses === true
  const analytics = modules.analytics === true
  return {
    overview: false,
    analytics: analytics || children || rental || expenses || sales,
    operations: false,
    payments: children || rental || sales,
    charges: false,
    salary: children || rental || sales || expenses,
    debts: children || rental || sales,
    expenses: expenses || children,
  }
}

function firstEnabledTab(
  tabs: Record<FinanceWorkspaceTabId, boolean>,
): FinanceWorkspaceTabId {
  const order: FinanceWorkspaceTabId[] = [
    'analytics',
    'payments',
    'debts',
    'salary',
    'expenses',
  ]
  return order.find((id) => tabs[id]) ?? 'analytics'
}

export function resolveFinanceTabAlias(
  requested: string | null,
  modules: ModuleAccessFlags,
): FinanceWorkspaceTabId {
  const tabs = resolveFinanceWorkspaceTabs(modules)
  if (requested === 'overview') {
    return firstEnabledTab(tabs)
  }
  if (requested === 'operations') {
    return tabs.expenses ? 'expenses' : firstEnabledTab(tabs)
  }
  if (requested === 'charges') {
    return tabs.payments ? 'payments' : firstEnabledTab(tabs)
  }
  if (requested === 'debts' && !tabs.debts && tabs.payments) {
    return 'payments'
  }
  if (requested && tabs[requested as FinanceWorkspaceTabId]) {
    return requested as FinanceWorkspaceTabId
  }
  return firstEnabledTab(tabs)
}

export function resolveFinanceNavGroups(modules: ModuleAccessFlags): FinanceNavGroup[] {
  const tabs = resolveFinanceWorkspaceTabs(modules)
  const groups: FinanceNavGroup[] = []
  if (tabs.analytics) {
    groups.push({
      id: 'analytics',
      labelKey: 'navAnalyticsSection',
      tabs: ['analytics'],
    })
  }

  const domainTabs: FinanceWorkspaceTabId[] = []
  if (tabs.payments) {
    domainTabs.push('payments')
  }
  if (tabs.debts) {
    domainTabs.push('debts')
  }
  if (domainTabs.length > 0) {
    const children = modules.children === true
    const rental = modules.rental === true
    const sales = modules.sales === true
    const labelKey: FinanceNavGroup['labelKey'] = children
      ? 'financeNavKindergarten'
      : rental && !sales
        ? 'financeNavRental'
        : sales
          ? 'navSalesSection'
          : 'financeNavMoney'
    groups.push({
      id: 'domain',
      labelKey,
      tabs: domainTabs,
    })
  }

  if (tabs.salary) {
    groups.push({
      id: 'employees',
      labelKey: 'financeNavEmployees',
      tabs: ['salary'],
    })
  }
  if (tabs.expenses) {
    groups.push({
      id: 'operations',
      labelKey: 'financeNavOperations',
      tabs: ['expenses'],
    })
  }
  return groups
}

export function isFinanceWorkspaceAvailable(modules: ModuleAccessFlags): boolean {
  const tabs = resolveFinanceWorkspaceTabs(modules)
  return tabs.analytics || tabs.payments || tabs.salary || tabs.debts || tabs.expenses
}

export const FINANCE_ANALYTICS_HREF = '/finance?tab=analytics'

export function permissionGroupEnabled(
  group:
    | 'sales'
    | 'payments'
    | 'returns'
    | 'refunds'
    | 'warehouse'
    | 'analytics'
    | 'employees'
    | 'company'
    | 'children'
    | 'attendance',
  modules: ModuleAccessFlags,
): boolean {
  if (group === 'sales' || group === 'returns' || group === 'refunds') {
    return modules.sales === true
  }
  if (group === 'warehouse') {
    return modules.warehouses === true
  }
  if (group === 'payments') {
    return modules.sales === true || modules.rental === true || modules.children === true
  }
  if (group === 'analytics') {
    return (
      modules.analytics === true ||
      modules.expenses === true ||
      modules.children === true ||
      modules.rental === true
    )
  }
  if (group === 'children') {
    return modules.children === true
  }
  if (group === 'attendance') {
    return modules.attendance === true
  }
  return true
}
