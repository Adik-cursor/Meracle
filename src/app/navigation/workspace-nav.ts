import type { CarePermission, FinancialPermission, OrganizationModules, User, WarehousePermission } from '../../core/types'
import { isSalesModuleAvailable } from '../../core/types/modules'
import {
  canAccessMotivationPlans,
  canManageEmployees,
  canReadRental,
  canViewEmployeeDirectory,
  getAccessScopeForUser,
  isFinanceWorkspaceAvailable,
  isPlatformOwner,
} from '../../core/services'
import {
  getDefaultCrmPath,
  getVisibleCompanyRoutes,
  getVisibleWarehouseRoutes,
  isBranchDetailPath,
  isDealDetailPath,
  isEmployeeDetailPath,
  isRentalSectionPath,
  isSaleDetailPath,
  isSaleReceiptPath,
} from '../routes/app.routes'
import type { AppRoute } from '../routes/route.types'

export const SIDEBAR_COLLAPSE_STORAGE_KEY = 'meracle.sidebarCollapsed'

export type SidebarAccess = {
  currentUser: User | null
  modules: OrganizationModules
  hasFinancialAccess: (permission: FinancialPermission) => boolean
  hasWarehouseAccess: (permission: WarehousePermission) => boolean
  hasCareAccess: (permission: CarePermission) => boolean
}

export type SidebarItemId =
  | 'dashboard'
  | 'children'
  | 'attendance'
  | 'crm'
  | 'sales'
  | 'warehouse'
  | 'finance'
  | 'analytics'
  | 'company'
  | 'settings'
  | 'rental'
  | 'packages'
  | 'platform-dashboard'
  | 'platform-companies'
  | 'platform-log'

export type SidebarItem = {
  id: SidebarItemId
  href: string
  labelKey:
    | 'navDashboard'
    | 'navChildren'
    | 'navAttendance'
    | 'navCrmSection'
    | 'navSalesSection'
    | 'navWarehouseSection'
    | 'navFinanceSection'
    | 'navAnalyticsSection'
    | 'navCompanySection'
    | 'navSettings'
    | 'navPackages'
    | 'platformModuleRental'
    | 'navPlatformDashboard'
    | 'navPlatformCompanies'
    | 'navPlatformLog'
}

export function filterCompanyWorkspaceRoutes(
  modules: OrganizationModules,
  currentUser: User | null,
  hasFinancialAccess: (permission: FinancialPermission) => boolean,
): AppRoute[] {
  void hasFinancialAccess
  return getVisibleCompanyRoutes(modules).filter((route) => {
    if (route.path === '/company/access-log') {
      return canManageEmployees(currentUser)
    }
    if (route.path === '/company/employees') {
      return canViewEmployeeDirectory(currentUser)
    }
    if (route.path === '/company/plans') {
      return modules.plans === true && canAccessMotivationPlans(currentUser)
    }
    if (route.path === '/company/departments' && modules.children === true) {
      return false
    }
    if (route.path === '/company/debts' || route.path === '/company/debt-journal') {
      return false
    }
    if (!currentUser) {
      return false
    }
    const scope = getAccessScopeForUser(currentUser)
    return scope !== 'own' && scope !== 'warehouse'
  })
}

export function filterWarehouseWorkspaceRoutes(
  modules: OrganizationModules,
  hasWarehouseAccess: (permission: WarehousePermission) => boolean,
): AppRoute[] {
  return getVisibleWarehouseRoutes(modules).filter((route) => {
    if (route.path === '/inventory/audits') {
      return hasWarehouseAccess('audit.create') || hasWarehouseAccess('inventory.read')
    }
    if (route.path === '/inventory/transfers') {
      return hasWarehouseAccess('transfer.create')
    }
    if (route.path === '/inventory/analytics') {
      return hasWarehouseAccess('analytics.read')
    }
    return true
  })
}

export function getSidebarItems(access: SidebarAccess): SidebarItem[] {
  const { currentUser, modules, hasFinancialAccess, hasWarehouseAccess, hasCareAccess } = access
  if (isPlatformOwner(currentUser)) {
    return [
      {
        id: 'platform-dashboard',
        href: '/platform/dashboard',
        labelKey: 'navPlatformDashboard',
      },
      {
        id: 'platform-companies',
        href: '/platform/organizations',
        labelKey: 'navPlatformCompanies',
      },
      {
        id: 'platform-log',
        href: '/platform/log',
        labelKey: 'navPlatformLog',
      },
      { id: 'settings', href: '/settings', labelKey: 'navSettings' },
    ]
  }

  const items: SidebarItem[] = [
    { id: 'dashboard', href: '/dashboard', labelKey: 'navDashboard' },
  ]

  if (modules.crm === true) {
    const crmPath = getDefaultCrmPath(modules)
    if (crmPath) {
      items.push({ id: 'crm', href: crmPath, labelKey: 'navCrmSection' })
    }
  }

  if (modules.children === true && hasCareAccess('children.read')) {
    items.push({ id: 'children', href: '/children', labelKey: 'navChildren' })
  }

  if (isSalesModuleAvailable(modules) && hasFinancialAccess('sales.read')) {
    items.push({ id: 'sales', href: '/sales', labelKey: 'navSalesSection' })
  }

  if (modules.rental === true) {
    items.push({
      id: 'rental',
      href: '/rental',
      labelKey: 'platformModuleRental',
    })
  }

  if (modules.warehouses === true && hasWarehouseAccess('products.read')) {
    items.push({
      id: 'warehouse',
      href: '/warehouse',
      labelKey: 'navWarehouseSection',
    })
  }

  if (modules.packages === true) {
    items.push({ id: 'packages', href: '/packages', labelKey: 'navPackages' })
  }

  if (modules.attendance === true && hasCareAccess('attendance.read')) {
    items.push({ id: 'attendance', href: '/attendance', labelKey: 'navAttendance' })
  }

  const canOpenFinance =
    isFinanceWorkspaceAvailable(modules) &&
    ((modules.children === true && hasCareAccess('children.read')) ||
      (modules.expenses === true && hasFinancialAccess('expenses.read')) ||
      hasFinancialAccess('financial_analytics.read') ||
      (modules.rental === true && currentUser !== null && canReadRental(currentUser)))
  if (canOpenFinance) {
    items.push({ id: 'finance', href: '/finance', labelKey: 'navFinanceSection' })
  }

  if (filterCompanyWorkspaceRoutes(modules, currentUser, hasFinancialAccess).length > 0) {
    items.push({ id: 'company', href: '/company', labelKey: 'navCompanySection' })
  }

  items.push({ id: 'settings', href: '/settings', labelKey: 'navSettings' })
  return items
}

export function isWorkspaceTabActive(tabPath: string, pathname: string): boolean {
  if (tabPath === pathname) {
    return true
  }
  if (pathname === '/warehouse' && tabPath === '/warehouses') {
    return true
  }
  if (pathname === '/finance' && (tabPath === '/expenses' || tabPath === '/finance' || tabPath === '/analytics')) {
    return true
  }
  if (tabPath === '/company/employees' && isEmployeeDetailPath(pathname)) {
    return true
  }
  if (tabPath === '/company/branches' && isBranchDetailPath(pathname)) {
    return true
  }
  if (tabPath === '/deals' && isDealDetailPath(pathname)) {
    return true
  }
  if (
    tabPath === '/sales' &&
    (isSaleDetailPath(pathname) || isSaleReceiptPath(pathname))
  ) {
    return true
  }
  return false
}

export function isSidebarItemActive(
  item: SidebarItem,
  pathname: string,
  modules?: OrganizationModules,
): boolean {
  switch (item.id) {
    case 'dashboard':
      return pathname === '/dashboard'
    case 'children':
      return pathname === '/children' || pathname.startsWith('/children/')
    case 'attendance':
      return pathname === '/attendance'
    case 'platform-dashboard':
      return pathname === '/platform/dashboard' || pathname === '/platform'
    case 'platform-companies':
      return (
        pathname === '/platform/organizations' ||
        pathname.startsWith('/platform/organizations/')
      )
    case 'platform-log':
      return pathname === '/platform/log'
    case 'crm':
      return (
        pathname === '/contacts' ||
        pathname === '/companies' ||
        pathname === '/customers' ||
        pathname === '/deals' ||
        pathname === '/tasks' ||
        pathname === '/activities' ||
        pathname === '/reports' ||
        pathname.startsWith('/deals/')
      )
    case 'sales':
      return (
        pathname === '/sales' ||
        pathname.startsWith('/sales/') ||
        (modules?.warehouses !== true && pathname === '/products')
      )
    case 'packages':
      return pathname === '/packages' || pathname.startsWith('/packages/')
    case 'warehouse':
      return (
        pathname === '/warehouse' ||
        pathname === '/warehouses' ||
        pathname === '/inventory' ||
        pathname.startsWith('/inventory/') ||
        (modules?.warehouses === true && pathname === '/products')
      )
    case 'finance':
      return (
        pathname === '/finance' ||
        pathname === '/expenses' ||
        pathname === '/analytics'
      )
    case 'company':
      return (
        pathname === '/company' ||
        pathname.startsWith('/company/') ||
        pathname === '/users' ||
        pathname === '/branches' ||
        pathname === '/department'
      )
    case 'settings':
      return pathname === '/settings'
    case 'rental':
      return isRentalSectionPath(pathname)
    default:
      return false
  }
}
