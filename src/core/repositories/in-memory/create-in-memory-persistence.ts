import type {
  AccessChangeLog,
  Branch,
  Contact,
  Customer,
  Deal,
  Department,
  Expense,
  InternalReceipt,
  InventoryItem,
  Organization,
  OrganizationModuleConfig,
  Payment,
  PaymentRefund,
  Product,
  ProductCategory,
  BusinessTemplate,
  BusinessType,
  EmployeeMotivationLine,
  EmployeeMotivationPeriod,
  CustomerDebtPayment,
  Sale,
  SaleItem,
  SaleReturn,
  SaleReturnItem,
  Session,
  StockAudit,
  StockAuditItem,
  StockMovement,
  StockReceipt,
  StockReceiptItem,
  StockWriteoff,
  StockWriteoffItem,
  Task,
  User,
  Warehouse,
  WarehouseTransfer,
  RentalBooking,
  RentalBookingItem,
  RentalUnit,
  CareGroup,
  Child,
  CareCharge,
  EmployeeCompensation,
  EmployeePayout,
  AttendanceRecord,
  ImplantPackage,
  ImplantPackageMovement,
  PackageContract,
  SaleInvoice,
  DeliveryNote,
  SupplyContract,
  ReconciliationStatement,
} from '../../types'
import { createIdLock } from '../../utils/id-lock'
import type { Persistence } from '../persistence'
import { createInMemoryEntityRepository } from './in-memory-entity-repository'
import { createInMemoryInternalReceiptRepository } from './in-memory-internal-receipt-repository'
import { createInMemoryInventoryRepository } from './in-memory-inventory-repository'
import { createInMemoryPaymentRefundRepository } from './in-memory-payment-refund-repository'
import { createInMemoryPaymentRepository } from './in-memory-payment-repository'
import { createInMemorySaleItemRepository } from './in-memory-sale-item-repository'
import { createInMemorySaleReturnItemRepository } from './in-memory-sale-return-item-repository'
import { createInMemorySaleReturnRepository } from './in-memory-sale-return-repository'
import { createInMemoryStockAuditItemRepository } from './in-memory-stock-audit-item-repository'
import { createInMemoryStockAuditRepository } from './in-memory-stock-audit-repository'
import { createInMemoryStockMovementRepository } from './in-memory-stock-movement-repository'
import { createInMemoryStockReceiptItemRepository } from './in-memory-stock-receipt-item-repository'
import { createInMemoryStockReceiptRepository } from './in-memory-stock-receipt-repository'
import { createInMemoryStockWriteoffItemRepository } from './in-memory-stock-writeoff-item-repository'
import { createInMemoryStockWriteoffRepository } from './in-memory-stock-writeoff-repository'
import { createInMemoryWarehouseRepository } from './create-in-memory-warehouse-repository'
import { createInMemoryAuthRepository } from './create-in-memory-auth-repository'
import { createInMemoryTaskRepository } from './create-in-memory-task-repository'
import { createInMemoryDepartmentRepository } from './create-in-memory-department-repository'
import { createInMemoryRentalBookingItemRepository } from './in-memory-rental-booking-item-repository'
import { migrateRentalBookingItems } from '../migrate-rental-booking-items'
import { migrateAttendanceRecords } from '../migrate-attendance-records'
import { migrateChildrenRecords } from '../migrate-children-records'

export type PersistenceState = {
  warehouses: Warehouse[]
  products: Product[]
  inventory: InventoryItem[]
  stockMovements: StockMovement[]
  warehouseTransfers: WarehouseTransfer[]
  sales: Sale[]
  saleItems: SaleItem[]
  payments: Payment[]
  internalReceipts: InternalReceipt[]
  paymentRefunds: PaymentRefund[]
  saleReturns: SaleReturn[]
  saleReturnItems: SaleReturnItem[]
  stockReceipts: StockReceipt[]
  stockReceiptItems: StockReceiptItem[]
  stockWriteoffs: StockWriteoff[]
  stockWriteoffItems: StockWriteoffItem[]
  stockAudits: StockAudit[]
  stockAuditItems: StockAuditItem[]
  customers: Customer[]
  contacts: Contact[]
  deals: Deal[]
  expenses: Expense[]
  users: User[]
  tasks: Task[]
  branches: Branch[]
  departments: Department[]
  organizations: Organization[]
  organizationModuleConfigs: OrganizationModuleConfig[]
  businessTypes: BusinessType[]
  businessTemplates: BusinessTemplate[]
  accessChangeLogs: AccessChangeLog[]
  productCategories: ProductCategory[]
  employeeMotivationPeriods: EmployeeMotivationPeriod[]
  employeeMotivationLines: EmployeeMotivationLine[]
  customerDebtPayments: CustomerDebtPayment[]
  rentalUnits: RentalUnit[]
  rentalBookings: RentalBooking[]
  rentalBookingItems: RentalBookingItem[]
  careGroups: CareGroup[]
  children: Child[]
  careCharges: CareCharge[]
  employeeCompensations: EmployeeCompensation[]
  employeePayouts: EmployeePayout[]
  attendanceRecords: AttendanceRecord[]
  implantPackages: ImplantPackage[]
  implantPackageMovements: ImplantPackageMovement[]
  packageContracts: PackageContract[]
  saleInvoices: SaleInvoice[]
  deliveryNotes: DeliveryNote[]
  supplyContracts: SupplyContract[]
  reconciliationStatements: ReconciliationStatement[]
  sessions: Session | null
}

export type CreateInMemoryPersistenceOptions = {
  initialState?: PersistenceState
  persistState?: (state: PersistenceState) => void
}

export function createInMemoryPersistence(
  options: CreateInMemoryPersistenceOptions = {},
): Persistence {
  let version = 0
  let ready = false
  const listeners = new Set<() => void>()

  const notify = () => {
    version += 1
    for (const listener of listeners) {
      listener()
    }

    if (ready) {
      options.persistState?.(takeState())
    }
  }

  const warehouses = createInMemoryWarehouseRepository(notify)
  const products = createInMemoryEntityRepository<Product>(notify, 'end')
  const inventory = createInMemoryInventoryRepository(
    notify,
    () => crypto.randomUUID(),
    () => new Date().toISOString(),
  )
  const stockMovements = createInMemoryStockMovementRepository(notify)
  const warehouseTransfers =
    createInMemoryEntityRepository<WarehouseTransfer>(notify)
  const sales = createInMemoryEntityRepository<Sale>(notify)
  const saleItems = createInMemorySaleItemRepository(notify)
  const payments = createInMemoryPaymentRepository(notify)
  const internalReceipts = createInMemoryInternalReceiptRepository(notify)
  const paymentRefunds = createInMemoryPaymentRefundRepository(notify)
  const saleReturns = createInMemorySaleReturnRepository(notify)
  const saleReturnItems = createInMemorySaleReturnItemRepository(notify)
  const stockReceipts = createInMemoryStockReceiptRepository(notify)
  const stockReceiptItems = createInMemoryStockReceiptItemRepository(notify)
  const stockWriteoffs = createInMemoryStockWriteoffRepository(notify)
  const stockWriteoffItems = createInMemoryStockWriteoffItemRepository(notify)
  const stockAudits = createInMemoryStockAuditRepository(notify)
  const stockAuditItems = createInMemoryStockAuditItemRepository(notify)
  const customers = createInMemoryEntityRepository<Customer>(notify)
  const contacts = createInMemoryEntityRepository<Contact>(notify, 'end')
  const dealsInner = createInMemoryEntityRepository<Deal>(notify, 'end')
  const deals = {
    getById: dealsInner.getById,
    list: dealsInner.list,
    create: dealsInner.create,
    update: dealsInner.update,
    delete: (id: Deal['id']) => dealsInner.store.remove(id),
    snapshot: dealsInner.snapshot,
    restore: dealsInner.restore,
  }
  const expenses = createInMemoryEntityRepository<Expense>(notify, 'end')
  const users = createInMemoryEntityRepository<User>(notify, 'end')
  const tasks = createInMemoryTaskRepository(notify)
  const branches = createInMemoryEntityRepository<Branch>(notify, 'end')
  const departments = createInMemoryDepartmentRepository(notify)
  const organizations = createInMemoryEntityRepository<Organization>(notify, 'end')
  const organizationModuleConfigs =
    createInMemoryEntityRepository<OrganizationModuleConfig>(notify, 'end')
  const businessTypes = createInMemoryEntityRepository<BusinessType>(notify, 'end')
  const businessTemplates =
    createInMemoryEntityRepository<BusinessTemplate>(notify, 'end')
  const accessChangeLogs =
    createInMemoryEntityRepository<AccessChangeLog>(notify, 'end')
  const productCategories =
    createInMemoryEntityRepository<ProductCategory>(notify, 'end')
  const employeeMotivationPeriods =
    createInMemoryEntityRepository<EmployeeMotivationPeriod>(notify, 'end')
  const employeeMotivationLines =
    createInMemoryEntityRepository<EmployeeMotivationLine>(notify, 'end')
  const customerDebtPayments =
    createInMemoryEntityRepository<CustomerDebtPayment>(notify, 'end')
  const rentalUnits = createInMemoryEntityRepository<RentalUnit>(notify, 'end')
  const rentalBookings =
    createInMemoryEntityRepository<RentalBooking>(notify, 'end')
  const rentalBookingItems =
    createInMemoryRentalBookingItemRepository(notify)
  const careGroups = createInMemoryEntityRepository<CareGroup>(notify, 'end')
  const children = createInMemoryEntityRepository<Child>(notify, 'end')
  const careCharges = createInMemoryEntityRepository<CareCharge>(notify, 'end')
  const employeeCompensations =
    createInMemoryEntityRepository<EmployeeCompensation>(notify, 'end')
  const employeePayouts = createInMemoryEntityRepository<EmployeePayout>(notify, 'end')
  const attendanceRecords =
    createInMemoryEntityRepository<AttendanceRecord>(notify, 'end')
  const implantPackages =
    createInMemoryEntityRepository<ImplantPackage>(notify, 'end')
  const implantPackageMovements =
    createInMemoryEntityRepository<ImplantPackageMovement>(notify, 'end')
  const packageContracts =
    createInMemoryEntityRepository<PackageContract>(notify, 'end')
  const saleInvoices = createInMemoryEntityRepository<SaleInvoice>(notify, 'end')
  const deliveryNotes = createInMemoryEntityRepository<DeliveryNote>(notify, 'end')
  const supplyContracts = createInMemoryEntityRepository<SupplyContract>(notify, 'end')
  const reconciliationStatements =
    createInMemoryEntityRepository<ReconciliationStatement>(notify, 'end')
  const auth = createInMemoryAuthRepository(notify)

  const takeState = (): PersistenceState => ({
    warehouses: warehouses.snapshot(),
    products: products.snapshot(),
    inventory: inventory.snapshot(),
    stockMovements: stockMovements.snapshot(),
    warehouseTransfers: warehouseTransfers.snapshot(),
    sales: sales.snapshot(),
    saleItems: saleItems.snapshot(),
    payments: payments.snapshot(),
    internalReceipts: internalReceipts.snapshot(),
    paymentRefunds: paymentRefunds.snapshot(),
    saleReturns: saleReturns.snapshot(),
    saleReturnItems: saleReturnItems.snapshot(),
    stockReceipts: stockReceipts.snapshot(),
    stockReceiptItems: stockReceiptItems.snapshot(),
    stockWriteoffs: stockWriteoffs.snapshot(),
    stockWriteoffItems: stockWriteoffItems.snapshot(),
    stockAudits: stockAudits.snapshot(),
    stockAuditItems: stockAuditItems.snapshot(),
    customers: customers.snapshot(),
    contacts: contacts.snapshot(),
    deals: deals.snapshot(),
    expenses: expenses.snapshot(),
    users: users.snapshot(),
    tasks: tasks.snapshot(),
    branches: branches.snapshot(),
    departments: departments.snapshot(),
    organizations: organizations.snapshot(),
    organizationModuleConfigs: organizationModuleConfigs.snapshot(),
    businessTypes: businessTypes.snapshot(),
    businessTemplates: businessTemplates.snapshot(),
    accessChangeLogs: accessChangeLogs.snapshot(),
    productCategories: productCategories.snapshot(),
    employeeMotivationPeriods: employeeMotivationPeriods.snapshot(),
    employeeMotivationLines: employeeMotivationLines.snapshot(),
    customerDebtPayments: customerDebtPayments.snapshot(),
    rentalUnits: rentalUnits.snapshot(),
    rentalBookings: rentalBookings.snapshot(),
    rentalBookingItems: rentalBookingItems.snapshot(),
    careGroups: careGroups.snapshot(),
    children: children.snapshot(),
    careCharges: careCharges.snapshot(),
    employeeCompensations: employeeCompensations.snapshot(),
    employeePayouts: employeePayouts.snapshot(),
    attendanceRecords: attendanceRecords.snapshot(),
    implantPackages: implantPackages.snapshot(),
    implantPackageMovements: implantPackageMovements.snapshot(),
    packageContracts: packageContracts.snapshot(),
    saleInvoices: saleInvoices.snapshot(),
    deliveryNotes: deliveryNotes.snapshot(),
    supplyContracts: supplyContracts.snapshot(),
    reconciliationStatements: reconciliationStatements.snapshot(),
    sessions: auth.snapshot(),
  })

  const applyState = (state: PersistenceState) => {
    warehouses.restore(state.warehouses)
    products.restore(state.products)
    inventory.restore(state.inventory)
    stockMovements.restore(state.stockMovements)
    warehouseTransfers.restore(state.warehouseTransfers)
    sales.restore(state.sales)
    saleItems.restore(state.saleItems)
    payments.restore(state.payments)
    internalReceipts.restore(state.internalReceipts ?? [])
    paymentRefunds.restore(state.paymentRefunds)
    saleReturns.restore(state.saleReturns)
    saleReturnItems.restore(state.saleReturnItems)
    stockReceipts.restore(state.stockReceipts)
    stockReceiptItems.restore(state.stockReceiptItems)
    stockWriteoffs.restore(state.stockWriteoffs)
    stockWriteoffItems.restore(state.stockWriteoffItems)
    stockAudits.restore(state.stockAudits)
    stockAuditItems.restore(state.stockAuditItems)
    customers.restore(state.customers)
    contacts.restore(state.contacts ?? [])
    deals.restore(state.deals)
    expenses.restore(state.expenses ?? [])
    users.restore(state.users)
    tasks.restore(state.tasks)
    branches.restore(state.branches)
    departments.restore(state.departments)
    organizations.restore(state.organizations ?? [])
    organizationModuleConfigs.restore(state.organizationModuleConfigs ?? [])
    businessTypes.restore(state.businessTypes ?? [])
    businessTemplates.restore(state.businessTemplates ?? [])
    accessChangeLogs.restore(state.accessChangeLogs ?? [])
    productCategories.restore(state.productCategories ?? [])
    employeeMotivationPeriods.restore(state.employeeMotivationPeriods ?? [])
    employeeMotivationLines.restore(state.employeeMotivationLines ?? [])
    customerDebtPayments.restore(state.customerDebtPayments ?? [])
    rentalUnits.restore(state.rentalUnits ?? [])
    rentalBookings.restore(state.rentalBookings ?? [])
    rentalBookingItems.restore(
      migrateRentalBookingItems(
        state.rentalBookingItems ?? [],
        state.rentalUnits ?? [],
      ),
    )
    careGroups.restore(state.careGroups ?? [])
    children.restore(migrateChildrenRecords(state.children ?? []))
    careCharges.restore(state.careCharges ?? [])
    employeeCompensations.restore(state.employeeCompensations ?? [])
    employeePayouts.restore(state.employeePayouts ?? [])
    attendanceRecords.restore(migrateAttendanceRecords(state.attendanceRecords ?? []))
    implantPackages.restore(state.implantPackages ?? [])
    implantPackageMovements.restore(state.implantPackageMovements ?? [])
    packageContracts.restore(state.packageContracts ?? [])
    saleInvoices.restore(state.saleInvoices ?? [])
    deliveryNotes.restore(state.deliveryNotes ?? [])
    supplyContracts.restore(state.supplyContracts ?? [])
    reconciliationStatements.restore(state.reconciliationStatements ?? [])
    auth.restore(state.sessions)
  }

  if (options.initialState) {
    applyState(options.initialState)
  }

  ready = true

  return {
    warehouses,
    products,
    inventory,
    stockMovements,
    warehouseTransfers,
    sales,
    saleItems,
    payments,
    internalReceipts,
    paymentRefunds,
    saleReturns,
    saleReturnItems,
    stockReceipts,
    stockReceiptItems,
    stockWriteoffs,
    stockWriteoffItems,
    stockAudits,
    stockAuditItems,
    customers,
    contacts,
    deals,
    expenses,
    users,
    tasks,
    branches,
    departments,
    organizations,
    organizationModuleConfigs,
    businessTypes,
    businessTemplates,
    accessChangeLogs,
    productCategories,
    employeeMotivationPeriods,
    employeeMotivationLines,
    customerDebtPayments,
    rentalUnits,
    rentalBookings,
    rentalBookingItems,
    careGroups,
    children,
    careCharges,
    employeeCompensations,
    employeePayouts,
    attendanceRecords,
    implantPackages,
    implantPackageMovements,
    packageContracts,
    saleInvoices,
    deliveryNotes,
    supplyContracts,
    reconciliationStatements,
    auth,
    locks: createIdLock(),
    capture() {
      const snapshot = takeState()

      return {
        restore() {
          applyState(snapshot)
        },
      }
    },
    runInTransaction(work, options) {
      const snapshot = this.capture()

      try {
        const result = work()
        const shouldCommit =
          options?.shouldCommit ??
          ((value: typeof result) => {
            if (typeof value === 'boolean') {
              return value
            }

            if (value && typeof value === 'object' && 'ok' in value) {
              return (value as { ok: unknown }).ok === true
            }

            return value != null
          })

        if (!shouldCommit(result)) {
          snapshot.restore()
          options?.onRollback?.()
        }

        return result
      } catch (error) {
        snapshot.restore()
        options?.onRollback?.()
        throw error
      }
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    getVersion() {
      return version
    },
  }
}
