import type { ReactNode } from 'react'
import { useOrganization } from '../context/organization-context'
import { useAccess } from '../context/access-context'
import { isPlatformOwner } from '../../core/services'
import { useLocalization } from '../context/localization-context'
import {
  getVisibleCrmRoutes,
  getVisibleSalesRoutes,
  getPlatformNavRoutes,
  isAnalyticsSectionPath,
  isAttendancePath,
  isChildrenSectionPath,
  isCompanySectionPath,
  isCrmSectionPath,
  isDashboardPath,
  isExpensesSectionPath,
  isPlatformSectionPath,
  isPackageSectionPath,
  isRentalSectionPath,
  isSalesWorkspacePath,
  isWarehouseSectionPath,
} from '../routes/app.routes'
import { filterCompanyWorkspaceRoutes, filterWarehouseWorkspaceRoutes } from '../navigation/workspace-nav'
import { Sidebar } from './Sidebar'
import { WorkspaceChrome } from './WorkspaceChrome'
import { DEMO_MODE } from '../../core/config/demo-mode'

type AppLayoutProps = {
  pathname: string
  onNavigate: (path: string) => void
  children: ReactNode
}

export function AppLayout({ pathname, onNavigate, children }: AppLayoutProps) {
  const { modules } = useOrganization()
  const { hasFinancialAccess, hasWarehouseAccess, currentUser } = useAccess()
  const { t } = useLocalization()
  const platformOpen = isPlatformSectionPath(pathname)
  const warehouseOpen =
    !platformOpen &&
    modules.warehouses === true &&
    isWarehouseSectionPath(pathname)
  const salesOpen =
    !platformOpen &&
    modules.sales === true &&
    !warehouseOpen &&
    (isSalesWorkspacePath(pathname) ||
      (modules.warehouses !== true && pathname === '/products'))
  const analyticsOpen = !platformOpen && isAnalyticsSectionPath(pathname)
  const expensesOpen = !platformOpen && isExpensesSectionPath(pathname)
  const dashboardOpen = !platformOpen && isDashboardPath(pathname)
  const childrenOpen = !platformOpen && isChildrenSectionPath(pathname)
  const attendanceOpen = !platformOpen && isAttendancePath(pathname)
  const sectionLanding =
    pathname === '/children' ||
    pathname === '/attendance' ||
    pathname === '/rental' ||
    pathname === '/company'
  const companyOpen = !platformOpen && isCompanySectionPath(pathname)
  const crmOpen =
    !platformOpen &&
    !dashboardOpen &&
    isCrmSectionPath(pathname) &&
    !warehouseOpen &&
    !salesOpen &&
    !companyOpen
  const moduleTitle = sectionLanding
    ? t('navWorkspaceGroup')
    : platformOpen
    ? pathname === '/platform/dashboard' || pathname === '/platform'
      ? t('navPlatformDashboard')
      : pathname === '/platform/organizations' || pathname === '/platform/log'
        ? t('navPlatform')
        : t('navPlatformCompanies')
    : dashboardOpen
    ? t('navDashboard')
    : childrenOpen
      ? t('navChildren')
      : attendanceOpen
        ? t('navAttendance')
        : warehouseOpen
    ? t('navWarehouseSection')
    : isPackageSectionPath(pathname)
      ? t('navPackages')
    : salesOpen
      ? t('navSalesSection')
    : expensesOpen || analyticsOpen
        ? t('navFinanceSection')
        : companyOpen
          ? t('navCompanySection')
          : crmOpen
            ? t('navCrmSection')
            : pathname === '/settings'
              ? t('navSettings')
              : pathname === '/login'
                ? t('signIn')
                : pathname === '/setup'
                  ? t('setupTitle')
                  : isRentalSectionPath(pathname)
                    ? t('platformModuleRental')
                    : t('navHome')
  const tabs = platformOpen
    ? isPlatformOwner(currentUser)
      ? getPlatformNavRoutes()
      : []
    : warehouseOpen
    ? filterWarehouseWorkspaceRoutes(modules, hasWarehouseAccess)
    : salesOpen
      ? getVisibleSalesRoutes(modules).filter(
          (route) =>
            route.module !== 'sales' || hasFinancialAccess('sales.read'),
        )
      : analyticsOpen
        ? []
        : companyOpen
          ? filterCompanyWorkspaceRoutes(modules, currentUser, hasFinancialAccess)
          : crmOpen
            ? getVisibleCrmRoutes(modules)
            : []

  const isAuthScreen = pathname === '/login' || pathname === '/setup'
  const layoutClass = ['app-layout', isAuthScreen ? 'app-layout--auth' : '']
    .filter(Boolean)
    .join(' ')

  return (
    <div className={layoutClass}>
      {isAuthScreen ? null : <Sidebar pathname={pathname} onNavigate={onNavigate} />}
      <div className="app-workspace">
        <WorkspaceChrome
          moduleTitle={moduleTitle}
          pathname={pathname}
          onNavigate={onNavigate}
          tabs={tabs}
        />
        {DEMO_MODE ? (
          <div className="demo-mode-notice" role="status">
            <strong>Демонстрационная версия.</strong> Данные хранятся локально в этом браузере; не вводите реальные персональные данные.
          </div>
        ) : null}
        <main className="app-layout__main">{children}</main>
      </div>
    </div>
  )
}
