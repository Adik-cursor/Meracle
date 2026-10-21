import type { TranslationKey } from '../../core/localization/translations'
import type { OrganizationModules } from '../../core/types'
import { isSalesModuleAvailable } from '../../core/types/modules'
import type { AppRoute, AppRoutePath } from './route.types'

export const APP_ROUTES: AppRoute[] = [
  { path: '/', labelKey: 'navHome', module: 'crm', enabled: true },
  { path: '/dashboard', labelKey: 'navDashboard', module: 'settings', enabled: true },
  { path: '/login', labelKey: 'signIn', module: 'crm', enabled: true },
  { path: '/setup', labelKey: 'setupTitle', module: 'crm', enabled: true },
  { path: '/contacts', labelKey: 'navContacts', module: 'contacts', enabled: true },
  { path: '/companies', labelKey: 'navCompanies', module: 'companies', enabled: true },
  { path: '/customers', labelKey: 'navCustomers', module: 'crm', enabled: true },
  { path: '/deals', labelKey: 'navDeals', module: 'deals', enabled: true },
  { path: '/users', labelKey: 'navEmployees', module: 'crm', enabled: true },
  { path: '/branches', labelKey: 'navBranches', module: 'crm', enabled: true },
  { path: '/department', labelKey: 'navDepartments', module: 'crm', enabled: true },
  { path: '/company', labelKey: 'navCompany', module: 'crm', enabled: true },
  { path: '/company/organization', labelKey: 'navOrganization', module: 'crm', enabled: true },
  { path: '/company/branches', labelKey: 'navBranches', module: 'crm', enabled: true },
  { path: '/company/departments', labelKey: 'navDepartments', module: 'crm', enabled: true },
  { path: '/company/employees', labelKey: 'navEmployees', module: 'crm', enabled: true },
  { path: '/company/plans', labelKey: 'dashboardPlans', module: 'crm', enabled: true },
  { path: '/company/debts', labelKey: 'navCounterpartyDebts', module: 'sales', enabled: true },
  { path: '/company/debt-journal', labelKey: 'navDebtJournal', module: 'sales', enabled: true },
  { path: '/company/access', labelKey: 'navAccessRights', module: 'crm', enabled: false },
  { path: '/company/access-log', labelKey: 'navAccessLog', module: 'crm', enabled: true },
  { path: '/tasks', labelKey: 'navTasks', module: 'tasks', enabled: true },
  { path: '/activities', labelKey: 'navActivities', module: 'activities', enabled: true },
  { path: '/reports', labelKey: 'navReports', module: 'reports', enabled: true },
  { path: '/products', labelKey: 'navNomenclature', module: 'products', enabled: true },
  { path: '/settings', labelKey: 'navSettings', module: 'settings', enabled: true },
  { path: '/warehouses', labelKey: 'navWarehouses', module: 'warehouses', enabled: true },
  { path: '/inventory', labelKey: 'navInventory', module: 'warehouses', enabled: true },
  { path: '/inventory/analytics', labelKey: 'navAnalytics', module: 'warehouses', enabled: true },
  { path: '/inventory/movements', labelKey: 'navMovements', module: 'warehouses', enabled: true },
  { path: '/inventory/transfers', labelKey: 'navTransfers', module: 'warehouses', enabled: true },
  { path: '/inventory/audits', labelKey: 'navInventoryAudits', module: 'warehouses', enabled: true },
  { path: '/sales', labelKey: 'navPosSale', module: 'sales', enabled: true },
  { path: '/sales/returns', labelKey: 'navSaleReturns', module: 'sales', enabled: true },
  { path: '/sales/payment-refunds', labelKey: 'navPaymentRefunds', module: 'sales', enabled: true },
  { path: '/analytics', labelKey: 'navAnalyticsSection', module: 'reports', enabled: true },
  { path: '/expenses', labelKey: 'navExpensesSection', module: 'expenses', enabled: true },
  { path: '/finance', labelKey: 'navFinanceSection', module: 'expenses', enabled: true },
  { path: '/warehouse', labelKey: 'navWarehouseSection', module: 'warehouses', enabled: true },
  { path: '/platform', labelKey: 'navPlatform', module: 'crm', enabled: true },
  { path: '/platform/dashboard', labelKey: 'navPlatformDashboard', module: 'crm', enabled: true },
  { path: '/platform/organizations', labelKey: 'navPlatformCompanies', module: 'crm', enabled: true },
  { path: '/platform/log', labelKey: 'navPlatformLog', module: 'crm', enabled: true },
  { path: '/rental', labelKey: 'platformModuleRental', module: 'rental', enabled: true },
  { path: '/children', labelKey: 'navChildren', module: 'children', enabled: true },
  { path: '/attendance', labelKey: 'navAttendance', module: 'attendance', enabled: true },
  { path: '/packages', labelKey: 'navPackages', module: 'packages', enabled: true },
  { path: '/packages/active', labelKey: 'packagesActive', module: 'packages', enabled: true },
  { path: '/packages/completed', labelKey: 'packagesCompleted', module: 'packages', enabled: true },
  { path: '/packages/contracts', labelKey: 'packagesContracts', module: 'packages', enabled: true },
]

export function isDealDetailPath(path: string): boolean {
  return /^\/deals\/[^/]+$/.test(path)
}

export function getDealIdFromPath(path: string): string | undefined {
  if (!isDealDetailPath(path)) {
    return undefined
  }

  return decodeURIComponent(path.slice('/deals/'.length))
}

export function isSaleDetailPath(path: string): boolean {
  if (!path.startsWith('/sales/')) {
    return false
  }

  const rest = path.slice('/sales/'.length)
  return rest.length > 0 && rest !== 'returns' && rest !== 'payment-refunds' && !rest.includes('/')
}

export function getSaleIdFromPath(path: string): string | undefined {
  if (!isSaleDetailPath(path)) {
    return undefined
  }

  return decodeURIComponent(path.slice('/sales/'.length))
}

export function isRentalBookingPath(path: string): boolean {
  return /^\/rental\/bookings\/[^/]+$/.test(path)
}

export function getRentalBookingIdFromPath(path: string): string | undefined {
  if (!isRentalBookingPath(path)) {
    return undefined
  }

  return decodeURIComponent(path.slice('/rental/bookings/'.length))
}

export function isRentalSectionPath(path: string): boolean {
  return path === '/rental' || path === '/rental/bookings' || isRentalBookingPath(path)
}

export function isChildDetailPath(path: string): boolean {
  return /^\/children\/[^/]+$/.test(path) && !path.startsWith('/children/groups')
}

export function isCareGroupDetailPath(path: string): boolean {
  return /^\/children\/groups\/[^/]+$/.test(path)
}

export function getChildIdFromPath(path: string): string | undefined {
  if (!isChildDetailPath(path)) {
    return undefined
  }

  return decodeURIComponent(path.slice('/children/'.length))
}

export function getCareGroupIdFromPath(path: string): string | undefined {
  if (!isCareGroupDetailPath(path)) {
    return undefined
  }

  return decodeURIComponent(path.slice('/children/groups/'.length))
}

export function isChildrenSectionPath(path: string): boolean {
  return (
    path === '/children' ||
    isChildDetailPath(path) ||
    isCareGroupDetailPath(path)
  )
}

export function isAttendancePath(path: string): boolean {
  return path === '/attendance'
}

export function isInventoryAuditDetailPath(path: string): boolean {
  return /^\/inventory\/audits\/[^/]+$/.test(path)
}

export function getAuditIdFromPath(path: string): string | undefined {
  if (!isInventoryAuditDetailPath(path)) {
    return undefined
  }
  return decodeURIComponent(path.slice('/inventory/audits/'.length))
}

export function isPackageDetailPath(path: string): boolean {
  if (!path.startsWith('/packages/')) {
    return false
  }
  const rest = path.slice('/packages/'.length)
  return rest.length > 0 && !['contracts', 'active', 'completed'].includes(rest) && !rest.includes('/')
}

export function getPackageIdFromPath(path: string): string | undefined {
  if (!isPackageDetailPath(path)) {
    return undefined
  }
  return decodeURIComponent(path.slice('/packages/'.length))
}

export function isPackageSectionPath(path: string): boolean {
  return path === '/packages' || path.startsWith('/packages/')
}

export function isBranchDetailPath(path: string): boolean {
  return /^\/company\/branches\/[^/]+$/.test(path)
}

export function getBranchIdFromPath(path: string): string | undefined {
  if (!isBranchDetailPath(path)) {
    return undefined
  }

  return decodeURIComponent(path.slice('/company/branches/'.length))
}

export function isEmployeeDetailPath(path: string): boolean {
  return /^\/company\/employees\/[^/]+$/.test(path)
}

export function getEmployeeIdFromPath(path: string): string | undefined {
  if (!isEmployeeDetailPath(path)) {
    return undefined
  }

  return decodeURIComponent(path.slice('/company/employees/'.length))
}

export function isSaleReceiptPath(path: string): boolean {
  return /^\/sales\/receipts\/[^/]+$/.test(path)
}

export function getReceiptIdFromPath(path: string): string | undefined {
  if (!isSaleReceiptPath(path)) {
    return undefined
  }

  return decodeURIComponent(path.slice('/sales/receipts/'.length))
}

export function isAppRoutePath(path: string): path is AppRoutePath {
  return APP_ROUTES.some((route) => route.path === path)
}

export function getRouteByPath(path: string): AppRoute | undefined {
  return APP_ROUTES.find((route) => route.path === path)
}

export function isRouteEnabled(
  route: AppRoute,
  modules?: OrganizationModules,
): boolean {
  if (!route.enabled) {
    return false
  }

  if (route.module === 'warehouses') {
    return modules?.warehouses === true
  }

  if (route.module === 'products') {
    return modules?.warehouses === true || modules?.sales === true
  }

  if (route.module === 'sales') {
    return modules ? isSalesModuleAvailable(modules) : false
  }

  if (route.path === '/company/plans') {
    return modules ? modules.plans === true : true
  }

  if (route.path === '/company/departments' && modules?.children === true) {
    return false
  }

  if (route.path === '/analytics') {
    return (
      modules?.analytics === true ||
      modules?.reports === true ||
      modules?.children === true ||
      modules?.expenses === true ||
      modules?.rental === true ||
      modules?.sales === true
    )
  }

  if (route.path === '/expenses' || route.path === '/finance') {
    return (
      modules?.expenses === true ||
      modules?.children === true ||
      modules?.analytics === true ||
      modules?.rental === true ||
      modules?.sales === true
    )
  }

  if (route.path === '/warehouse') {
    return modules?.warehouses === true
  }

  if (route.path === '/dashboard') {
    return true
  }

  if (route.module === 'rental') {
    return modules?.rental === true
  }

  if (route.module === 'children') {
    return modules?.children === true
  }

  if (route.module === 'packages') {
    return modules?.packages === true
  }

  if (route.module === 'attendance') {
    return modules?.attendance === true
  }

  if (
    route.path === '/contacts' ||
    route.path === '/companies' ||
    route.path === '/customers' ||
    route.path === '/deals' ||
    route.path === '/tasks' ||
    route.path === '/activities' ||
    route.path === '/reports'
  ) {
    return modules?.crm === true
  }

  if (
    route.path === '/platform' ||
    route.path === '/platform/dashboard' ||
    route.path === '/platform/organizations' ||
    route.path === '/platform/log'
  ) {
    return false
  }

  return true
}

export function getVisibleRoutes(modules?: OrganizationModules): AppRoute[] {
  return APP_ROUTES.filter((route) => isRouteEnabled(route, modules))
}

export type WarehouseNavGroup = {
  labelKey: TranslationKey
  paths: readonly AppRoutePath[]
}

export const WAREHOUSE_NAV_GROUPS: readonly WarehouseNavGroup[] = [
  {
    labelKey: 'warehouseGroupCatalog',
    paths: ['/products'],
  },
  {
    labelKey: 'warehouseGroupAccounting',
    paths: ['/warehouses', '/inventory', '/inventory/movements'],
  },
  {
    labelKey: 'warehouseGroupOperations',
    paths: ['/inventory/transfers', '/inventory/audits'],
  },
]

export const WAREHOUSE_NAV_PATHS: readonly AppRoutePath[] =
  WAREHOUSE_NAV_GROUPS.flatMap((group) => group.paths)

export const SALES_NAV_PATHS: readonly AppRoutePath[] = [
  '/sales',
  '/sales/returns',
  '/sales/payment-refunds',
]

export const CRM_NAV_PATHS: readonly AppRoutePath[] = [
  '/deals',
  '/contacts',
  '/companies',
  '/customers',
  '/tasks',
  '/activities',
  '/reports',
]

export const KINDERGARTEN_CRM_NAV_PATHS: readonly AppRoutePath[] = [
  '/deals',
  '/customers',
  '/tasks',
]

export const KINDERGARTEN_CRM_HIDDEN_PATHS: readonly AppRoutePath[] = [
  '/contacts',
  '/companies',
  '/activities',
  '/reports',
]

export function usesCareCrmComposition(modules?: OrganizationModules): boolean {
  return modules?.crm === true && modules?.children === true
}

export function isKindergartenCrmHiddenPath(
  path: string,
  modules?: OrganizationModules,
): boolean {
  return (
    usesCareCrmComposition(modules) &&
    (KINDERGARTEN_CRM_HIDDEN_PATHS as readonly string[]).includes(path)
  )
}

export const PLATFORM_NAV_PATHS: readonly AppRoutePath[] = [
  '/platform/dashboard',
  '/platform/organizations',
  '/platform/log',
]

export function isPlatformSectionPath(path: string): boolean {
  return path === '/platform' || path.startsWith('/platform/')
}

export function isPlatformOrganizationDetailPath(path: string): boolean {
  return /^\/platform\/organizations\/[^/]+$/.test(path)
}

export function getPlatformOrganizationIdFromPath(path: string): string | undefined {
  if (!isPlatformOrganizationDetailPath(path)) {
    return undefined
  }

  return decodeURIComponent(path.slice('/platform/organizations/'.length))
}

export const COMPANY_NAV_PATHS: readonly AppRoutePath[] = [
  '/company',
  '/company/branches',
  '/company/departments',
  '/company/employees',
  '/company/plans',
  '/company/debts',
  '/company/debt-journal',
  '/company/access-log',
]

export function pickVisibleRoutesByPath(
  routes: AppRoute[],
  paths: readonly AppRoutePath[],
): AppRoute[] {
  const visibleByPath = new Map(routes.map((route) => [route.path, route]))

  return paths.flatMap((path) => {
    const route = visibleByPath.get(path)
    return route ? [route] : []
  })
}

export const WAREHOUSE_ONLY_PATHS: readonly AppRoutePath[] = [
  '/warehouses',
  '/inventory',
  '/inventory/analytics',
  '/inventory/movements',
  '/inventory/transfers',
  '/inventory/audits',
]

export const SALES_WORKSPACE_PATHS: readonly AppRoutePath[] = [
  '/sales',
  '/sales/returns',
  '/sales/payment-refunds',
]

export function isWarehouseOnlyPath(path: string): boolean {
  return (
    path === '/warehouse' ||
    (WAREHOUSE_ONLY_PATHS as readonly string[]).includes(path) ||
    isInventoryAuditDetailPath(path)
  )
}

export function isSalesWorkspacePath(path: string): boolean {
  return (
    (SALES_WORKSPACE_PATHS as readonly string[]).includes(path) ||
    isSaleDetailPath(path) ||
    isSaleReceiptPath(path)
  )
}

export function isWarehouseSectionPath(path: string): boolean {
  return (
    path === '/warehouse' ||
    (WAREHOUSE_NAV_PATHS as readonly string[]).includes(path) ||
    isInventoryAuditDetailPath(path)
  )
}

export function isKnownAppPathname(path: string): boolean {
  return (
    isAppRoutePath(path) ||
    isDealDetailPath(path) ||
    isSaleDetailPath(path) ||
    isSaleReceiptPath(path) ||
    isBranchDetailPath(path) ||
    isEmployeeDetailPath(path) ||
    isPlatformSectionPath(path) ||
    isPlatformOrganizationDetailPath(path) ||
    isRentalSectionPath(path) ||
    isChildrenSectionPath(path) ||
    isAttendancePath(path) ||
    isInventoryAuditDetailPath(path) ||
    isPackageSectionPath(path)
  )
}

export function isCrmSectionPath(path: string): boolean {
  return (
    (CRM_NAV_PATHS as readonly string[]).includes(path) || isDealDetailPath(path)
  )
}

export function isCompanySectionPath(path: string): boolean {
  return (
    path === '/company' ||
    path.startsWith('/company/') ||
    path === '/users' ||
    path === '/branches' ||
    path === '/department'
  )
}

export function isAnalyticsSectionPath(path: string): boolean {
  return path === '/analytics'
}

export function isExpensesSectionPath(path: string): boolean {
  return path === '/expenses' || path === '/finance' || path === '/analytics'
}

export function isFinanceSectionPath(path: string): boolean {
  return isExpensesSectionPath(path)
}

export function isDashboardPath(path: string): boolean {
  return path === '/dashboard'
}

export function getVisibleWarehouseNavGroups(modules?: OrganizationModules) {
  const routes = getVisibleRoutes(modules)

  return WAREHOUSE_NAV_GROUPS.flatMap((group) => {
    const items = pickVisibleRoutesByPath(routes, group.paths)
    return items.length > 0 ? [{ labelKey: group.labelKey, routes: items }] : []
  })
}

export function getVisibleWarehouseRoutes(
  modules?: OrganizationModules,
): AppRoute[] {
  return pickVisibleRoutesByPath(getVisibleRoutes(modules), WAREHOUSE_NAV_PATHS)
}

export function getDefaultWarehousePath(
  modules?: OrganizationModules,
): AppRoutePath | undefined {
  if (modules?.warehouses !== true) {
    return undefined
  }

  return getVisibleWarehouseNavGroups(modules)[0]?.routes[0]?.path
}

export function getVisibleSalesRoutes(
  modules?: OrganizationModules,
): AppRoute[] {
  const routes = getVisibleRoutes(modules)
  const paths: AppRoutePath[] =
    modules?.warehouses === true
      ? [...SALES_NAV_PATHS]
      : ['/products', ...SALES_NAV_PATHS]

  return pickVisibleRoutesByPath(routes, paths)
}

export function getDefaultSalesPath(
  modules?: OrganizationModules,
): AppRoutePath | undefined {
  return getVisibleSalesRoutes(modules)[0]?.path
}

export function getVisibleCrmRoutes(modules?: OrganizationModules): AppRoute[] {
  const paths = usesCareCrmComposition(modules)
    ? KINDERGARTEN_CRM_NAV_PATHS
    : CRM_NAV_PATHS
  const routes = pickVisibleRoutesByPath(getVisibleRoutes(modules), paths)

  if (!usesCareCrmComposition(modules)) {
    return routes
  }

  return routes.map((route) => {
    if (route.path === '/deals') {
      return {
        ...route,
        labelKey: 'crmInquiries',
        groupLabelKey: 'crmNavGroupInquiries',
      }
    }
    if (route.path === '/customers') {
      return {
        ...route,
        labelKey: 'crmParents',
        groupLabelKey: 'crmNavGroupParents',
      }
    }
    if (route.path === '/tasks') {
      return {
        ...route,
        labelKey: 'navTasks',
        groupLabelKey: 'crmNavGroupTasks',
      }
    }
    return route
  })
}

export function getDefaultCrmPath(
  modules?: OrganizationModules,
): AppRoutePath | undefined {
  return getVisibleCrmRoutes(modules)[0]?.path
}

export function getVisibleCompanyRoutes(
  modules?: OrganizationModules,
): AppRoute[] {
  return pickVisibleRoutesByPath(getVisibleRoutes(modules), COMPANY_NAV_PATHS)
}

export function getDefaultCompanyPath(
  modules?: OrganizationModules,
): AppRoutePath | undefined {
  return getVisibleCompanyRoutes(modules)[0]?.path
}

export function getDefaultAnalyticsPath(
  modules?: OrganizationModules,
): AppRoutePath | undefined {
  return getVisibleRoutes(modules).some((route) => route.path === '/analytics')
    ? '/analytics'
    : undefined
}

export function getDefaultExpensesPath(
  modules?: OrganizationModules,
): AppRoutePath | undefined {
  return modules?.expenses === true ? '/finance' : undefined
}

export function getDefaultWarehouseHubPath(
  modules?: OrganizationModules,
): AppRoutePath | undefined {
  return modules?.warehouses === true ? '/warehouse' : undefined
}

export function getPlatformNavRoutes(): AppRoute[] {
  return pickVisibleRoutesByPath(APP_ROUTES, PLATFORM_NAV_PATHS)
}
