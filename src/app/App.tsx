import { useEffect, useRef } from 'react'
import { LocalizationProvider } from './context/LocalizationContext'
import { OrganizationProvider } from './context/OrganizationContext'
import { PersistenceProvider } from './context/PersistenceContext'
import { AuthProvider } from './context/AuthContext'
import { AccessProvider } from './context/AccessContext'
import { PlatformProvider } from './context/PlatformContext'
import { BranchProvider } from './context/BranchContext'
import { DepartmentProvider } from './context/DepartmentContext'
import { CompanyProvider } from './context/CompanyContext'
import { ContactProvider } from './context/ContactContext'
import { CustomerProvider } from './context/CustomerContext'
import { RentalProvider } from './context/RentalContext'
import { DealProvider } from './context/DealContext'
import { TaskProvider } from './context/TaskContext'
import { UserProvider } from './context/UserContext'
import { InventoryProvider } from './context/InventoryContext'
import { ExpenseProvider } from './context/ExpenseContext'
import { CareProvider } from './context/CareContext'
import { AnalyticsProvider } from './context/AnalyticsContext'
import { InternalReceiptProvider } from './context/InternalReceiptContext'
import { PaymentProvider } from './context/PaymentContext'
import { PaymentRefundProvider } from './context/PaymentRefundContext'
import { ToastProvider } from '../shared/ui'
import { ProductProvider } from './context/ProductContext'
import { SaleReturnProvider } from './context/SaleReturnContext'
import { SalesProvider } from './context/SalesContext'
import { StockMovementProvider } from './context/StockMovementContext'
import { WarehouseTransferProvider } from './context/WarehouseTransferContext'
import { WarehouseProvider } from './context/WarehouseContext'
import { useOrganization } from './context/organization-context'
import { useAuth } from './context/auth-context'
import { AuthInitializingState } from './components/AuthInitializingState'
import { ShiftOpeningGate } from './components/ShiftOpeningGate'
import { AppLayout } from './layouts/AppLayout'
import { AppRoutes } from './routes/AppRoutes'
import { AppPathProvider, useAppPath } from './routes/useAppPath'
import { isAttendancePath, isChildrenSectionPath, isWarehouseOnlyPath } from './routes/app.routes'
import { isSalesModuleAvailable } from '../core/types/modules'
import { isPlatformOwner } from '../core/services'
import { DEMO_MODE } from '../core/config/demo-mode'
import './app.css'
import '../styles/app-shell.css'
import '../styles/meracle-workspace.css'
import '../styles/rental-workspace.css'
import './rental-dashboard.css'
import './kindergarten-dashboard.css'
import '../styles/care-workspace.css'
import '../styles/meracle-finance.css'
import '../styles/meracle-ds.css'
import '../styles/meracle-dashboard.css'
import '../styles/meracle-unify.css'

function AppShell() {
  const { pathname, navigate } = useAppPath()
  const { modules } = useOrganization()
  const { isAuthenticated, isInitializing, currentUser, logout } = useAuth()
  const warehousesWasEnabled = useRef(modules.warehouses)
  const salesWasAvailable = useRef(isSalesModuleAvailable(modules))

  useEffect(() => {
    if (isInitializing) {
      return
    }

    if (DEMO_MODE && currentUser?.platformRole === 'platform_owner') {
      logout()
      navigate('/login', { replace: true })
      return
    }

    if (isAuthenticated) {
      if (pathname === '/login' || pathname === '/setup') {
        navigate(isPlatformOwner(currentUser) ? '/platform/dashboard' : '/dashboard', {
          replace: true,
        })
      } else if (pathname === '/company/organization') {
        navigate('/company', { replace: true })
      } else if (pathname === '/') {
        navigate(isPlatformOwner(currentUser) ? '/platform/dashboard' : '/dashboard', {
          replace: true,
        })
      } else if (isPlatformOwner(currentUser) && (pathname === '/platform' || pathname === '/dashboard')) {
        navigate('/platform/dashboard', { replace: true })
      }
      return
    }

    if (pathname !== '/login' && pathname !== '/setup') {
      navigate('/login', { replace: true })
    }
  }, [currentUser, isAuthenticated, isInitializing, logout, navigate, pathname])

  useEffect(() => {
    if (
      warehousesWasEnabled.current === true &&
      modules.warehouses === false &&
      isWarehouseOnlyPath(pathname)
    ) {
      navigate('/dashboard')
    }

    warehousesWasEnabled.current = modules.warehouses
  }, [modules.warehouses, navigate, pathname])

  useEffect(() => {
    const salesAvailable = isSalesModuleAvailable(modules)

    if (
      salesWasAvailable.current &&
      !salesAvailable &&
      (pathname === '/sales' ||
        pathname === '/sales/returns' ||
        pathname === '/sales/payment-refunds')
    ) {
      navigate('/dashboard')
    }

    salesWasAvailable.current = salesAvailable
  }, [modules, navigate, pathname])

  useEffect(() => {
    if (modules.children !== true && isChildrenSectionPath(pathname)) {
      navigate('/dashboard')
    }
  }, [modules.children, navigate, pathname])

  useEffect(() => {
    if (modules.attendance !== true && isAttendancePath(pathname)) {
      navigate('/dashboard')
    }
  }, [modules.attendance, navigate, pathname])

  return (
    <AppLayout pathname={pathname} onNavigate={navigate}>
      {isInitializing ? (
        <AuthInitializingState />
      ) : (
        <AppRoutes pathname={pathname} onNavigate={navigate} />
      )}
      <ShiftOpeningGate />
    </AppLayout>
  )
}

export default function App() {
  return (
    <PersistenceProvider>
      <AuthProvider>
      <OrganizationProvider>
      <LocalizationProvider>
          <AccessProvider>
          <PlatformProvider>
          <BranchProvider>
          <DepartmentProvider>
          <ContactProvider>
          <CompanyProvider>
            <CustomerProvider>
              <RentalProvider>
              <UserProvider>
              <DealProvider>
                <TaskProvider>
                <WarehouseProvider>
                <ProductProvider>
                  <InventoryProvider>
                    <StockMovementProvider>
                      <WarehouseTransferProvider>
                        <SalesProvider>
                          <PaymentProvider>
                            <InternalReceiptProvider>
                            <SaleReturnProvider>
                              <PaymentRefundProvider>
                                <ExpenseProvider>
                                <CareProvider>
                                <AnalyticsProvider>
                                <ToastProvider>
                                  <AppPathProvider>
                                    <AppShell />
                                  </AppPathProvider>
                                </ToastProvider>
                                </AnalyticsProvider>
                                </CareProvider>
                                </ExpenseProvider>
                              </PaymentRefundProvider>
                            </SaleReturnProvider>
                            </InternalReceiptProvider>
                          </PaymentProvider>
                        </SalesProvider>
                      </WarehouseTransferProvider>
                    </StockMovementProvider>
                  </InventoryProvider>
                </ProductProvider>
                </WarehouseProvider>
                </TaskProvider>
              </DealProvider>
              </UserProvider>
            </RentalProvider>
            </CustomerProvider>
          </CompanyProvider>
          </ContactProvider>
          </DepartmentProvider>
          </BranchProvider>
          </PlatformProvider>
          </AccessProvider>
      </LocalizationProvider>
      </OrganizationProvider>
      </AuthProvider>
    </PersistenceProvider>
  )
}
