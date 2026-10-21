import type { Persistence } from '../persistence'
import {
  createInMemoryPersistence,
  type PersistenceState,
} from '../in-memory/create-in-memory-persistence'
import type {
  InventoryItem,
  Product,
  RentalBookingItem,
  RentalUnit,
  SaleItem,
  Session,
} from '../../types'
import { normalizeProductRecord } from '../../types/product'
import { bootstrapPlatformPersistence } from '../../config/platform-bootstrap'
import { DEMO_MODE } from '../../config/demo-mode'
import { migrateRentalBookingItems } from '../migrate-rental-booking-items'
import { migrateAttendanceRecords } from '../migrate-attendance-records'
import { migrateChildrenRecords } from '../migrate-children-records'

export const PERSISTENCE_STORAGE_KEY = 'crm-platform.persistence'
export const DEMO_PERSISTENCE_STORAGE_KEY = 'crm-platform.demo.persistence'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

function asSession(value: unknown): Session | null {
  if (!isRecord(value)) {
    return null
  }

  if (
    typeof value.id !== 'string' ||
    typeof value.userId !== 'string' ||
    typeof value.organizationId !== 'string' ||
    typeof value.createdAt !== 'string'
  ) {
    return null
  }

  return {
    id: value.id,
    userId: value.userId,
    organizationId: value.organizationId,
    createdAt: value.createdAt,
  }
}

function parsePersistenceState(value: unknown): PersistenceState | undefined {
  if (!isRecord(value)) {
    return undefined
  }

  return {
    warehouses: asArray(value.warehouses),
    products: asArray(value.products)
      .map((item) => normalizeProductRecord(item))
      .filter((item): item is Product => item !== null),
    inventory: asArray<InventoryItem>(value.inventory).map((item) => ({
      ...item,
      unitCost:
        typeof item.unitCost === 'number' && Number.isFinite(item.unitCost)
          ? item.unitCost
          : 0,
    })),
    stockMovements: asArray(value.stockMovements),
    warehouseTransfers: asArray(value.warehouseTransfers),
    sales: asArray(value.sales),
    saleItems: asArray<SaleItem>(value.saleItems).map((item) => ({
      ...item,
      costPrice:
        typeof item.costPrice === 'number' && Number.isFinite(item.costPrice)
          ? item.costPrice
          : 0,
    })),
    payments: asArray(value.payments),
    internalReceipts: asArray(value.internalReceipts),
    paymentRefunds: asArray(value.paymentRefunds),
    saleReturns: asArray(value.saleReturns),
    saleReturnItems: asArray(value.saleReturnItems),
    stockReceipts: asArray(value.stockReceipts),
    stockReceiptItems: asArray(value.stockReceiptItems),
    stockWriteoffs: asArray(value.stockWriteoffs),
    stockWriteoffItems: asArray(value.stockWriteoffItems),
    stockAudits: asArray(value.stockAudits),
    stockAuditItems: asArray(value.stockAuditItems),
    customers: asArray(value.customers),
    contacts: asArray(value.contacts),
    deals: asArray(value.deals),
    expenses: asArray(value.expenses),
    users: asArray(value.users),
    tasks: asArray(value.tasks),
    branches: asArray(value.branches),
    departments: asArray(value.departments),
    organizations: asArray(value.organizations),
    organizationModuleConfigs: asArray(value.organizationModuleConfigs),
    businessTypes: asArray(value.businessTypes),
    businessTemplates: asArray(value.businessTemplates),
    accessChangeLogs: asArray(value.accessChangeLogs),
    productCategories: asArray(value.productCategories),
    employeeMotivationPeriods: asArray(value.employeeMotivationPeriods),
    employeeMotivationLines: asArray(value.employeeMotivationLines),
    customerDebtPayments: asArray(value.customerDebtPayments),
    rentalUnits: asArray<RentalUnit>(value.rentalUnits),
    rentalBookings: asArray(value.rentalBookings),
    rentalBookingItems: migrateRentalBookingItems(
      asArray<RentalBookingItem>(value.rentalBookingItems),
      asArray<RentalUnit>(value.rentalUnits),
    ),
    careGroups: asArray(value.careGroups),
    children: migrateChildrenRecords(asArray(value.children)),
    careCharges: asArray(value.careCharges),
    employeeCompensations: asArray(value.employeeCompensations),
    employeePayouts: asArray(value.employeePayouts),
    attendanceRecords: migrateAttendanceRecords(asArray(value.attendanceRecords)),
    implantPackages: asArray(value.implantPackages),
    implantPackageMovements: asArray(value.implantPackageMovements),
    packageContracts: asArray(value.packageContracts),
    saleInvoices: asArray(value.saleInvoices),
    deliveryNotes: asArray(value.deliveryNotes),
    supplyContracts: asArray(value.supplyContracts),
    reconciliationStatements: asArray(value.reconciliationStatements),
    sessions: asSession(value.sessions),
  }
}

function loadPersistenceState(storageKey: string): PersistenceState | undefined {
  if (typeof localStorage === 'undefined') {
    return undefined
  }

  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) {
      return undefined
    }

    return parsePersistenceState(JSON.parse(raw))
  } catch {
    return undefined
  }
}

function savePersistenceState(state: PersistenceState, storageKey: string): void {
  if (typeof localStorage === 'undefined') {
    return
  }

  try {
    localStorage.setItem(storageKey, JSON.stringify(state))
  } catch {
    /* ignore quota / private-mode failures */
  }
}

export function createBrowserPersistence(): Persistence {
  const storageKey = DEMO_MODE
    ? DEMO_PERSISTENCE_STORAGE_KEY
    : PERSISTENCE_STORAGE_KEY
  const persistence = createInMemoryPersistence({
    initialState: loadPersistenceState(storageKey),
    persistState: (state) => savePersistenceState(state, storageKey),
  })
  bootstrapPlatformPersistence(persistence, { createPlatformOwner: !DEMO_MODE })
  if (DEMO_MODE) {
    seedDemoUsers(persistence)
  }
  return persistence
}

function seedDemoUsers(persistence: Persistence): void {
  const organizationId = 'org-runtime'
  const now = new Date().toISOString()
  const users = [
    { id: 'demo-owner', email: 'demo.owner@example.com', firstName: 'Демо', lastName: 'Владелец', role: 'owner' as const },
    { id: 'demo-accountant', email: 'demo.accountant@example.com', firstName: 'Демо', lastName: 'Бухгалтер', role: 'accountant' as const },
    { id: 'demo-employee', email: 'demo.employee@example.com', firstName: 'Демо', lastName: 'Сотрудник', role: 'office_employee' as const },
  ]

  for (const user of users) {
    if (persistence.users.getById(user.id)) {
      continue
    }
    persistence.users.create({
      ...user,
      organizationId,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    })
  }
}
