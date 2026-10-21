import type { AccessChangeLog } from '../types/access-change-log'
import type { AttendanceRecord } from '../types/attendance'
import type { ImplantPackage } from '../types/implant-package'
import type { ImplantPackageMovement } from '../types/implant-package-movement'
import type { PackageContract } from '../types/package-contract'
import type { SaleInvoice } from '../types/sale-invoice'
import type { DeliveryNote } from '../types/delivery-note'
import type { SupplyContract } from '../types/supply-contract'
import type { ReconciliationStatement } from '../types/reconciliation-statement'
import type { CareGroup } from '../types/care-group'
import type { CareCharge } from '../types/care-charge'
import type { EmployeeCompensation, EmployeePayout } from '../types/employee-compensation'
import type { Child } from '../types/child'
import type { BusinessTemplate } from '../types/business-template'
import type { BusinessType } from '../types/business-type'
import type { Organization } from '../types/organization'
import type { OrganizationModuleConfig } from '../types/organization-module-config'
import type { ListedEntityRepository } from './entity-repository'
import type { AuthRepository } from './auth-repository'
import type { BranchRepository } from './branch-repository'
import type { Contact } from '../types/contact'
import type { CustomerRepository } from './customer-repository'
import type { DealRepository } from './deal-repository'
import type { ExpenseRepository } from './expense-repository'
import type { DepartmentRepository } from './department-repository'
import type { InternalReceiptRepository } from './internal-receipt-repository'
import type { InventoryRepository } from './inventory-repository'
import type { OperationLock } from './operation-lock'
import type { PaymentRefundRepository } from './payment-refund-repository'
import type { PaymentRepository } from './payment-repository'
import type { ProductRepository } from './product-repository'
import type { SaleItemRepository } from './sale-item-repository'
import type { SaleReturnItemRepository } from './sale-return-item-repository'
import type { SaleReturnRepository } from './sale-return-repository'
import type { SaleRepository } from './sale-repository'
import type { RentalBookingItemRepository } from './rental-booking-item-repository'
import type { StockAuditItemRepository } from './stock-audit-item-repository'
import type { StockAuditRepository } from './stock-audit-repository'
import type { StockMovementRepository } from './stock-movement-repository'
import type { StockReceiptItemRepository } from './stock-receipt-item-repository'
import type { StockReceiptRepository } from './stock-receipt-repository'
import type { StockWriteoffItemRepository } from './stock-writeoff-item-repository'
import type { StockWriteoffRepository } from './stock-writeoff-repository'
import type { TaskRepository } from './task-repository'
import type { UserRepository } from './user-repository'
import type { WarehouseRepository } from './warehouse-repository'
import type { WarehouseTransferRepository } from './warehouse-transfer-repository'
import type { ProductCategory } from '../types/product-category'
import type { EmployeeMotivationLine, EmployeeMotivationPeriod } from '../types/employee-motivation'
import type { CustomerDebtPayment } from '../types/customer-debt-payment'
import type { RentalBooking } from '../types/rental-booking'
import type { RentalUnit } from '../types/rental-unit'

export type PersistenceSnapshot = {
  restore: () => void
}

export type TransactionOptions<T> = {
  shouldCommit?: (result: T) => boolean
  onRollback?: () => void
}

export type Persistence = {
  warehouses: WarehouseRepository
  products: ProductRepository
  inventory: InventoryRepository
  stockMovements: StockMovementRepository
  warehouseTransfers: WarehouseTransferRepository
  sales: SaleRepository
  saleItems: SaleItemRepository
  payments: PaymentRepository
  internalReceipts: InternalReceiptRepository
  paymentRefunds: PaymentRefundRepository
  saleReturns: SaleReturnRepository
  saleReturnItems: SaleReturnItemRepository
  stockReceipts: StockReceiptRepository
  stockReceiptItems: StockReceiptItemRepository
  stockWriteoffs: StockWriteoffRepository
  stockWriteoffItems: StockWriteoffItemRepository
  stockAudits: StockAuditRepository
  stockAuditItems: StockAuditItemRepository
  customers: CustomerRepository
  contacts: ListedEntityRepository<Contact>
  deals: DealRepository
  expenses: ExpenseRepository
  users: UserRepository
  tasks: TaskRepository
  branches: BranchRepository
  departments: DepartmentRepository
  organizations: ListedEntityRepository<Organization>
  organizationModuleConfigs: ListedEntityRepository<OrganizationModuleConfig>
  businessTypes: ListedEntityRepository<BusinessType>
  businessTemplates: ListedEntityRepository<BusinessTemplate>
  accessChangeLogs: ListedEntityRepository<AccessChangeLog>
  productCategories: ListedEntityRepository<ProductCategory>
  employeeMotivationPeriods: ListedEntityRepository<EmployeeMotivationPeriod>
  employeeMotivationLines: ListedEntityRepository<EmployeeMotivationLine>
  customerDebtPayments: ListedEntityRepository<CustomerDebtPayment>
  rentalUnits: ListedEntityRepository<RentalUnit>
  rentalBookings: ListedEntityRepository<RentalBooking>
  rentalBookingItems: RentalBookingItemRepository
  careGroups: ListedEntityRepository<CareGroup>
  children: ListedEntityRepository<Child>
  careCharges: ListedEntityRepository<CareCharge>
  employeeCompensations: ListedEntityRepository<EmployeeCompensation>
  employeePayouts: ListedEntityRepository<EmployeePayout>
  attendanceRecords: ListedEntityRepository<AttendanceRecord>
  implantPackages: ListedEntityRepository<ImplantPackage>
  implantPackageMovements: ListedEntityRepository<ImplantPackageMovement>
  packageContracts: ListedEntityRepository<PackageContract>
  saleInvoices: ListedEntityRepository<SaleInvoice>
  deliveryNotes: ListedEntityRepository<DeliveryNote>
  supplyContracts: ListedEntityRepository<SupplyContract>
  reconciliationStatements: ListedEntityRepository<ReconciliationStatement>
  auth: AuthRepository
  locks: OperationLock
  capture: () => PersistenceSnapshot
  runInTransaction: <T>(
    work: () => T,
    options?: TransactionOptions<T>,
  ) => T
  subscribe: (listener: () => void) => () => void
  getVersion: () => number
}
