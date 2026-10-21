import { useEffect, type ComponentType } from 'react'
import { useOrganization } from '../context/organization-context'
import { useAccess } from '../context/access-context'
import { useLocalization } from '../context/localization-context'
import { canAccessMotivationPlans, canManageEmployees, canReadRental, canViewEmployeeDirectory, getAccessScopeForUser, isPlatformOwner } from '../../core/services'
import { PagePlaceholder } from '../../shared/components/PagePlaceholder'
import { isSalesModuleAvailable } from '../../core/types/modules'
import {
  isAppRoutePath,
  isBranchDetailPath,
  isAttendancePath,
  isChildDetailPath,
  isCareGroupDetailPath,
  isChildrenSectionPath,
  isDealDetailPath,
  isEmployeeDetailPath,
  isKindergartenCrmHiddenPath,
  isInventoryAuditDetailPath,
  isPackageDetailPath,
  isPackageSectionPath,
  isPlatformOrganizationDetailPath,
  isPlatformSectionPath,
  isRentalBookingPath,
  isSaleDetailPath,
  isSaleReceiptPath,
  isWarehouseOnlyPath,
  getRouteByPath,
  isRouteEnabled,
} from './app.routes'
import { DealDetailPage } from './pages/DealDetailPage'
import { SaleDetailPage } from './pages/SaleDetailPage'
import { BranchDetailPage } from './pages/BranchDetailPage'
import { EmployeeDetailPage } from './pages/EmployeeDetailPage'
import { InternalReceiptDetailPage } from './pages/InternalReceiptDetailPage'
import { FinanceWorkspacePage } from './pages/FinanceWorkspacePage'
import { ActivitiesPage } from './pages/ActivitiesPage'
import { CompaniesPage } from './pages/CompaniesPage'
import { ContactsPage } from './pages/ContactsPage'
import { CustomersPage } from './pages/CustomersPage'
import { DashboardPage } from './pages/DashboardPage'
import { DealsPage } from './pages/DealsPage'
import { UsersPage } from './pages/UsersPage'
import { BranchesPage } from './pages/BranchesPage'
import { DepartmentsPage } from './pages/DepartmentsPage'
import { CompanyOrganizationPage } from './pages/CompanyOrganizationPage'
import { CompanyAccessLogPage } from './pages/CompanyAccessLogPage'
import { CustomerDebtsPage } from './pages/CustomerDebtsPage'
import { CustomerDebtJournalPage } from './pages/CustomerDebtJournalPage'
import { CompanyPlansPage } from './pages/CompanyPlansPage'
import { PlatformOrganizationsPage } from './pages/PlatformOrganizationsPage'
import { PlatformOrganizationModulesPage } from './pages/PlatformOrganizationModulesPage'
import { PlatformModuleLogPage } from './pages/PlatformModuleLogPage'
import { PlatformDashboardPage } from './pages/PlatformDashboardPage'
import { CompanyDashboardPage } from './pages/CompanyDashboardPage'
import { RentalBookingPage } from './pages/RentalBookingPage'
import { RentalPage } from './pages/RentalPage'
import { ChildrenPage } from '../../modules/care/ChildrenPage'
import { ChildDetailPage } from '../../modules/care/ChildDetailPage'
import { CareGroupDetailPage } from '../../modules/care/CareGroupDetailPage'
import { AttendancePage } from '../../modules/care/AttendancePage'
import { InventoryAnalyticsPage } from './pages/InventoryAnalyticsPage'
import { LoginPage } from './pages/LoginPage'
import { SetupPage } from './pages/SetupPage'
import { InventoryPage } from './pages/InventoryPage'
import { InventoryAuditsPage } from './pages/InventoryAuditsPage'
import { InventoryAuditDetailPage } from './pages/InventoryAuditDetailPage'
import { ImplantPackagesPage } from './pages/ImplantPackagesPage'
import { ImplantPackageDetailPage } from './pages/ImplantPackageDetailPage'
import { PackageContractsPage } from './pages/PackageContractsPage'
import { PaymentRefundsPage } from './pages/PaymentRefundsPage'
import { ProductsPage } from './pages/ProductsPage'
import { ReportsPage } from './pages/ReportsPage'
import { SaleReturnsPage } from './pages/SaleReturnsPage'
import { SalesPage } from './pages/SalesPage'
import { SettingsPage } from './pages/SettingsPage'
import { StockMovementsPage } from './pages/StockMovementsPage'
import { TasksPage } from './pages/TasksPage'
import { WarehouseTransfersPage } from './pages/WarehouseTransfersPage'
import { WarehousesPage } from './pages/WarehousesPage'
import type { AppRoutePath } from './route.types'
import { DEMO_MODE } from '../../core/config/demo-mode'
import { useAppPath } from './useAppPath'

function PlansModuleFallback() {
  const { navigate } = useAppPath()
  useEffect(() => {
    navigate('/company/employees', { replace: true })
  }, [navigate])
  return null
}

function AnalyticsRedirect() {
  const { navigate } = useAppPath()
  useEffect(() => {
    navigate('/finance?tab=analytics', { replace: true })
  }, [navigate])
  return null
}

function ExpensesRedirect() {
  const { navigate } = useAppPath()
  useEffect(() => {
    navigate('/finance?tab=expenses', { replace: true })
  }, [navigate])
  return null
}

function CompanyDebtsRedirect() {
  const { navigate } = useAppPath()
  useEffect(() => {
    navigate('/finance?tab=debts', { replace: true })
  }, [navigate])
  return null
}

function CompanyDebtJournalRedirect() {
  const { navigate } = useAppPath()
  useEffect(() => {
    navigate('/finance?tab=payments', { replace: true })
  }, [navigate])
  return null
}

function KindergartenCrmRedirect() {
  const { navigate } = useAppPath()
  useEffect(() => {
    navigate('/deals', { replace: true })
  }, [navigate])
  return null
}

const PAGES: Record<
  Exclude<
    AppRoutePath,
    | '/settings'
    | '/customers'
    | '/sales'
    | '/login'
    | '/setup'
    | '/analytics'
    | '/expenses'
    | '/finance'
    | '/warehouse'
    | '/dashboard'
    | '/company/access'
    | '/platform'
    | '/platform/dashboard'
    | '/platform/organizations'
    | '/platform/log'
    | '/rental'
    | '/children'
    | '/attendance'
    | '/packages'
    | '/packages/active'
    | '/packages/completed'
    | '/packages/contracts'
  >,
  ComponentType
> = {
  '/': DashboardPage,
  '/contacts': ContactsPage,
  '/companies': CompaniesPage,
  '/deals': DealsPage,
  '/users': UsersPage,
  '/branches': BranchesPage,
  '/department': DepartmentsPage,
  '/company': CompanyOrganizationPage,
  '/company/organization': CompanyOrganizationPage,
  '/company/branches': BranchesPage,
  '/company/departments': DepartmentsPage,
  '/company/employees': UsersPage,
  '/company/plans': CompanyPlansPage,
  '/company/debts': CustomerDebtsPage,
  '/company/debt-journal': CustomerDebtJournalPage,
  '/company/access-log': CompanyAccessLogPage,
  '/tasks': TasksPage,
  '/activities': ActivitiesPage,
  '/reports': ReportsPage,
  '/products': ProductsPage,
  '/warehouses': WarehousesPage,
  '/inventory': InventoryPage,
  '/inventory/analytics': InventoryAnalyticsPage,
  '/inventory/movements': StockMovementsPage,
  '/inventory/transfers': WarehouseTransfersPage,
  '/inventory/audits': InventoryAuditsPage,
  '/sales/returns': SaleReturnsPage,
  '/sales/payment-refunds': PaymentRefundsPage,
}

type AppRoutesProps = {
  pathname: string
  onNavigate: (path: string) => void
}

export function AppRoutes({ pathname, onNavigate }: AppRoutesProps) {
  const { modules } = useOrganization()
  const { t } = useLocalization()
  const { hasFinancialAccess, hasWarehouseAccess, hasCareAccess, currentUser } = useAccess()
  const moduleUnavailable = (
    <PagePlaceholder
      title={t('MODULE_NOT_ENABLED')}
      description={t('MODULE_NOT_ENABLED')}
    />
  )

  if (isPlatformSectionPath(pathname)) {
    if (DEMO_MODE || !isPlatformOwner(currentUser)) {
      return (
        <PagePlaceholder
          title={DEMO_MODE ? 'Доступ недоступен' : t('ACCESS_DENIED')}
          description={t('ACCESS_DENIED')}
        />
      )
    }

    if (isPlatformOrganizationDetailPath(pathname)) {
      return <PlatformOrganizationModulesPage />
    }

    if (pathname === '/platform/log') {
      return <PlatformModuleLogPage />
    }

    if (pathname === '/platform/organizations') {
      return <PlatformOrganizationsPage />
    }

    return <PlatformDashboardPage />
  }

  if (pathname === '/dashboard') {
    if (isPlatformOwner(currentUser)) {
      return (
        <PagePlaceholder
          title={t('ACCESS_DENIED')}
          description={t('ACCESS_DENIED')}
        />
      )
    }
    return <CompanyDashboardPage />
  }

  if (pathname === '/rental' || pathname === '/rental/bookings') {
    if (modules.rental !== true) {
      return moduleUnavailable
    }
    return <RentalPage />
  }

  if (isChildrenSectionPath(pathname)) {
    if (modules.children !== true) {
      return moduleUnavailable
    }
    if (!hasCareAccess('children.read')) {
      return (
        <PagePlaceholder
          title={t('ACCESS_DENIED')}
          description={t('ACCESS_DENIED')}
        />
      )
    }
    if (isCareGroupDetailPath(pathname)) {
      return (
        <CareGroupDetailPage
          groupId={decodeURIComponent(pathname.slice('/children/groups/'.length))}
        />
      )
    }
    if (isChildDetailPath(pathname)) {
      return (
        <ChildDetailPage
          childId={decodeURIComponent(pathname.slice('/children/'.length))}
        />
      )
    }
    return <ChildrenPage />
  }

  if (isAttendancePath(pathname)) {
    if (modules.attendance !== true) {
      return moduleUnavailable
    }
    if (!hasCareAccess('attendance.read')) {
      return (
        <PagePlaceholder
          title={t('ACCESS_DENIED')}
          description={t('ACCESS_DENIED')}
        />
      )
    }
    return <AttendancePage />
  }

  if (isPackageSectionPath(pathname)) {
    if (modules.packages !== true) {
      return moduleUnavailable
    }
    if (isPackageDetailPath(pathname)) {
      return <ImplantPackageDetailPage />
    }
    if (pathname === '/packages/contracts') {
      return <PackageContractsPage />
    }
    return <ImplantPackagesPage />
  }

  if (isInventoryAuditDetailPath(pathname)) {
    if (modules.warehouses !== true) {
      return moduleUnavailable
    }
    return <InventoryAuditDetailPage />
  }

  if (isRentalBookingPath(pathname)) {
    if (modules.rental !== true) {
      return moduleUnavailable
    }
    const bookingId = decodeURIComponent(pathname.slice('/rental/bookings/'.length))
    return <RentalBookingPage bookingId={bookingId} />
  }

  if (
    (isDealDetailPath(pathname) ||
      pathname === '/' ||
      pathname === '/deals' ||
      pathname === '/contacts' ||
      pathname === '/companies' ||
      pathname === '/customers' ||
      pathname === '/tasks' ||
      pathname === '/activities' ||
      pathname === '/reports') &&
    modules.crm !== true
  ) {
    return moduleUnavailable
  }

  if (isKindergartenCrmHiddenPath(pathname, modules)) {
    return <KindergartenCrmRedirect />
  }

  if (
    (isSaleDetailPath(pathname) ||
      isSaleReceiptPath(pathname) ||
      pathname === '/sales' ||
      pathname === '/sales/returns' ||
      pathname === '/sales/payment-refunds') &&
    !isSalesModuleAvailable(modules)
  ) {
    return moduleUnavailable
  }

  if (isWarehouseOnlyPath(pathname) && modules.warehouses !== true) {
    return moduleUnavailable
  }

  if (pathname === '/products') {
    const productsRoute = getRouteByPath('/products')
    if (!productsRoute || !isRouteEnabled(productsRoute, modules)) {
      return moduleUnavailable
    }
  }

  if (
    pathname === '/analytics' &&
    modules.analytics !== true &&
    modules.reports !== true &&
    modules.children !== true &&
    modules.expenses !== true &&
    modules.rental !== true &&
    modules.sales !== true
  ) {
    return moduleUnavailable
  }

  if (
    (pathname === '/expenses' || pathname === '/finance') &&
    modules.expenses !== true &&
    modules.children !== true &&
    modules.analytics !== true &&
    modules.rental !== true &&
    modules.sales !== true
  ) {
    return moduleUnavailable
  }

  if (pathname === '/warehouse' && modules.warehouses !== true) {
    return moduleUnavailable
  }

  if (isDealDetailPath(pathname)) {
    return <DealDetailPage />
  }

  if (isSaleReceiptPath(pathname)) {
    return <InternalReceiptDetailPage />
  }

  if (isSaleDetailPath(pathname)) {
    return <SaleDetailPage />
  }

  if (isEmployeeDetailPath(pathname)) {
    return <EmployeeDetailPage />
  }

  if (isBranchDetailPath(pathname)) {
    return <BranchDetailPage />
  }

  if (!isAppRoutePath(pathname)) {
    return (
      <PagePlaceholder
        title={t('pageNotFound')}
        description={t('pageNotFoundDescription')}
      />
    )
  }

  if (isWarehouseOnlyPath(pathname) && modules.warehouses !== true) {
    return (
      <PagePlaceholder
        title={t('moduleDisabled')}
        description={t('moduleDisabledDescription')}
      />
    )
  }

  if (
    (pathname === '/sales' ||
      pathname === '/sales/returns' ||
      pathname === '/sales/payment-refunds') &&
    (!isSalesModuleAvailable(modules) || !hasFinancialAccess('sales.read'))
  ) {
    return (
      <PagePlaceholder
        title={t('moduleDisabled')}
        description={t('salesModuleDisabledDescription')}
      />
    )
  }

  if (pathname === '/company/access') {
    if (!currentUser || !canManageEmployees(currentUser)) {
      return (
        <PagePlaceholder
          title={t('ACCESS_DENIED')}
          description={t('ACCESS_DENIED')}
        />
      )
    }

    return (
      <PagePlaceholder
        title={t('pageNotFound')}
        description={t('accessRetiredPage')}
      />
    )
  }

  const companyOverviewDenied =
    !currentUser ||
    getAccessScopeForUser(currentUser) === 'own' ||
    getAccessScopeForUser(currentUser) === 'warehouse'
  const companyDirectoryDenied = !canViewEmployeeDirectory(currentUser)
  const companyManagementDenied = !canManageEmployees(currentUser)

  if (
    (pathname === '/company/employees' || pathname === '/users') &&
    companyDirectoryDenied
  ) {
    return (
      <PagePlaceholder
        title={t('ACCESS_DENIED')}
        description={t('ACCESS_DENIED')}
      />
    )
  }

  if (pathname === '/company/access-log' && companyManagementDenied) {
    return (
      <PagePlaceholder
        title={t('ACCESS_DENIED')}
        description={t('ACCESS_DENIED')}
      />
    )
  }

  if (pathname === '/company/plans' && modules.plans !== true) {
    return <PlansModuleFallback />
  }

  if (pathname === '/company/plans' && !canAccessMotivationPlans(currentUser)) {
    return (
      <PagePlaceholder
        title={t('ACCESS_DENIED')}
        description={t('ACCESS_DENIED')}
      />
    )
  }

  if (pathname === '/company/debts') {
    return <CompanyDebtsRedirect />
  }

  if (pathname === '/company/debt-journal') {
    return <CompanyDebtJournalRedirect />
  }

  if (
    (pathname === '/company' ||
      pathname === '/company/organization' ||
      pathname === '/company/branches' ||
      pathname === '/company/departments' ||
      pathname === '/branches' ||
      pathname === '/department') &&
    companyOverviewDenied
  ) {
    return (
      <PagePlaceholder
        title={t('ACCESS_DENIED')}
        description={t('ACCESS_DENIED')}
      />
    )
  }

  if (pathname === '/inventory/transfers' && !hasWarehouseAccess('transfer.create')) {
    return (
      <PagePlaceholder
        title={t('ACCESS_DENIED')}
        description={t('ACCESS_DENIED')}
      />
    )
  }

  if (pathname === '/inventory/analytics' && !hasWarehouseAccess('analytics.read')) {
    return (
      <PagePlaceholder
        title={t('ACCESS_DENIED')}
        description={t('ACCESS_DENIED')}
      />
    )
  }

  if (pathname === '/warehouse') {
    if (!hasWarehouseAccess('products.read')) {
      return (
        <PagePlaceholder
          title={t('ACCESS_DENIED')}
          description={t('ACCESS_DENIED')}
        />
      )
    }

    return <WarehousesPage />
  }

  if (pathname === '/analytics') {
    if (
      !hasFinancialAccess('financial_analytics.read') &&
      !hasFinancialAccess('expenses.read') &&
      !(modules.rental === true && currentUser && canReadRental(currentUser)) &&
      !(modules.children === true && hasCareAccess('children.read'))
    ) {
      return (
        <PagePlaceholder
          title={t('ACCESS_DENIED')}
          description={t('ACCESS_DENIED')}
        />
      )
    }

    return <AnalyticsRedirect />
  }

  if (pathname === '/expenses') {
    if (
      !hasFinancialAccess('financial_analytics.read') &&
      !hasFinancialAccess('expenses.read') &&
      !hasFinancialAccess('payments.read') &&
      !(modules.rental === true && currentUser && canReadRental(currentUser)) &&
      !(modules.children === true && hasCareAccess('children.read'))
    ) {
      return (
        <PagePlaceholder
          title={t('ACCESS_DENIED')}
          description={t('ACCESS_DENIED')}
        />
      )
    }

    return <ExpensesRedirect />
  }

  if (pathname === '/finance') {
    if (
      !hasFinancialAccess('financial_analytics.read') &&
      !hasFinancialAccess('expenses.read') &&
      !hasFinancialAccess('payments.read') &&
      !(modules.rental === true && currentUser && canReadRental(currentUser)) &&
      !(modules.children === true && hasCareAccess('children.read'))
    ) {
      return (
        <PagePlaceholder
          title={t('ACCESS_DENIED')}
          description={t('ACCESS_DENIED')}
        />
      )
    }

    return <FinanceWorkspacePage />
  }

  if (pathname === '/sales') {
    return <SalesPage onNavigate={onNavigate} />
  }

  if (pathname === '/customers') {
    return <CustomersPage onNavigate={onNavigate} />
  }

  if (pathname === '/settings') {
    return <SettingsPage pathname={pathname} onNavigate={onNavigate} />
  }

  if (pathname === '/login') {
    return <LoginPage />
  }

  if (pathname === '/setup') {
    return <SetupPage />
  }

  if (pathname in PAGES) {
    const Page = PAGES[pathname as keyof typeof PAGES]
    return <Page />
  }

  return (
    <PagePlaceholder
      title={t('pageNotFound')}
      description={t('pageNotFoundDescription')}
    />
  )
}
