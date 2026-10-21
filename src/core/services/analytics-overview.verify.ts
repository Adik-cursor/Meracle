import type { Contact, Customer, Id, Product, User, UserRole, Warehouse } from '../types'
import { createInMemoryPersistence } from '../repositories/in-memory/create-in-memory-persistence'
import type { Persistence } from '../repositories/persistence'
import { completeSaleForUser } from './complete-sale'
import { createPaymentForUser } from './create-payment'
import { getCompanyDashboardForUser } from './company-dashboard'
import { createExpenseForUser } from './expenses'
import { getFinancialAnalyticsForUser, resolveAnalyticsRange } from './financial-analytics'
import { resolveAnalyticsOverviewBlocks } from './analytics-overview'
import { setStock } from './inventory'
import { seedEnabledBusinessModules } from './organization-modules'
import { newId, nowIso } from './primitives'
import { createProductForUser } from './products'
import { getRentalAnalyticsForUser } from './rental-analytics'
import {
  createAndReserveRentalBookingForUser,
  issueRentalBookingForUser,
} from './rental-bookings'
import { createRentalBookingPaymentForUser } from './rental-payments'
import { confirmSaleForUser, createSaleForUser } from './sales'
import type { RentalPartyLookup } from './rental-party'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function addOrg(persistence: Persistence, id: Id, name: string): void {
  const now = nowIso()
  persistence.organizations.create({
    id,
    organizationId: id,
    name,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  })
}

function addUser(
  persistence: Persistence,
  organizationId: Id,
  role: UserRole,
  extra?: Partial<User>,
): User {
  const now = nowIso()
  const user: User = {
    id: newId(),
    organizationId,
    email: `${role}-${newId()}@${organizationId}.local`,
    firstName: role,
    lastName: 'User',
    role,
    status: 'active',
    createdAt: now,
    updatedAt: now,
    ...extra,
  }
  persistence.users.create(user)
  return user
}

function addBranch(persistence: Persistence, organizationId: Id, name: string) {
  const now = nowIso()
  return persistence.branches.create({
    id: newId(),
    organizationId,
    name,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  })
}

function addWarehouse(
  persistence: Persistence,
  organizationId: Id,
  branchId: Id,
  name: string,
): Warehouse {
  const now = nowIso()
  return persistence.warehouses.create({
    id: newId(),
    organizationId,
    branchId,
    name,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  })
}

const contacts = new Map<Id, Pick<Contact, 'organizationId' | 'phone' | 'firstName' | 'lastName'>>()

function lookup(): RentalPartyLookup {
  return {
    getContact: (id) => contacts.get(id),
    getCompany: () => undefined,
  }
}

function addCustomer(persistence: Persistence, organizationId: Id, phone: string): Customer {
  const now = nowIso()
  const contactId = newId()
  contacts.set(contactId, {
    organizationId,
    phone,
    firstName: 'Client',
    lastName: 'One',
  })
  return persistence.customers.create({
    id: newId(),
    organizationId,
    type: 'contact',
    contactId,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  })
}

function addProduct(persistence: Persistence, organizationId: Id, name: string): Product {
  const now = nowIso()
  return persistence.products.create({
    id: newId(),
    organizationId,
    name,
    sku: `sku-${newId()}`,
    unit: 'pcs',
    itemType: 'product',
    basePrice: 100,
    costPrice: 50,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  })
}

function hoursFromNow(hours: number): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()
}

export function runAnalyticsOverviewChecks(): void {
  const salesOff = resolveAnalyticsOverviewBlocks(
    { sales: false, expenses: true, rental: true, children: false, attendance: false },
    {
      canSalesAnalytics: true,
      canExpenseAnalytics: true,
      canRentalAnalytics: true,
      canCareAnalytics: false,
    },
  )
  assert(!salesOff.sales && salesOff.rental && salesOff.expenses, 'sales OFF hides sales overview')

  const bothOn = resolveAnalyticsOverviewBlocks(
    { sales: true, expenses: true, rental: true, children: false, attendance: false },
    {
      canSalesAnalytics: true,
      canExpenseAnalytics: true,
      canRentalAnalytics: true,
      canCareAnalytics: false,
    },
  )
  assert(bothOn.sales && bothOn.rental, 'sales ON + rental ON keeps separate blocks')

  const rentalDenied = resolveAnalyticsOverviewBlocks(
    { sales: false, expenses: false, rental: true, children: false, attendance: false },
    {
      canSalesAnalytics: false,
      canExpenseAnalytics: false,
      canRentalAnalytics: false,
      canCareAnalytics: false,
    },
  )
  assert(!rentalDenied.rental, 'rental overview respects reader access')

  const careOn = resolveAnalyticsOverviewBlocks(
    { sales: false, expenses: true, rental: false, children: true, attendance: true },
    {
      canSalesAnalytics: true,
      canExpenseAnalytics: true,
      canRentalAnalytics: false,
      canCareAnalytics: true,
    },
  )
  assert(!careOn.sales && careOn.care && careOn.expenses, 'kindergarten analytics hides sales')

  const attendanceOnly = resolveAnalyticsOverviewBlocks(
    { sales: true, expenses: true, rental: false, children: false, attendance: true },
    {
      canSalesAnalytics: true,
      canExpenseAnalytics: true,
      canRentalAnalytics: false,
      canCareAnalytics: true,
    },
  )
  assert(
    !attendanceOnly.care && attendanceOnly.sales,
    'attendance without children does not show kindergarten analytics',
  )

  const persistence = createInMemoryPersistence()
  const org = 'org-analytics-rental'
  addOrg(persistence, org, 'Rental Company')
  const owner = addUser(persistence, org, 'owner')
  seedEnabledBusinessModules(persistence, org, owner.id, [
    'crm',
    'warehouse',
    'expenses',
    'analytics',
    'rental',
  ])
  const branch = addBranch(persistence, org, 'Branch')
  const warehouse = addWarehouse(persistence, org, branch.id, 'WH')
  const warehouseManager = addUser(persistence, org, 'warehouse_manager', {
    branchId: branch.id,
    warehouseId: warehouse.id,
  })
  const product = addProduct(persistence, org, 'Costume')
  const customer = addCustomer(persistence, org, '+77001110001')
  assert(setStock(persistence, org, warehouse.id, product.id, 10).ok, 'stock')

  const bookingA = createAndReserveRentalBookingForUser(
    persistence,
    owner,
    org,
    {
      customerId: customer.id,
      warehouseId: warehouse.id,
      startAt: hoursFromNow(-1),
      endAt: hoursFromNow(48),
      items: [{ productId: product.id, quantity: 2 }],
      subtotal: 30_000,
      total: 30_000,
      prepayment: 5_000,
    },
    lookup(),
  )
  const bookingB = createAndReserveRentalBookingForUser(
    persistence,
    owner,
    org,
    {
      customerId: customer.id,
      warehouseId: warehouse.id,
      startAt: hoursFromNow(-48),
      endAt: hoursFromNow(-1),
      items: [{ productId: product.id, quantity: 1 }],
      subtotal: 20_000,
      total: 20_000,
    },
    lookup(),
  )
  const bookingC = createAndReserveRentalBookingForUser(
    persistence,
    owner,
    org,
    {
      customerId: customer.id,
      warehouseId: warehouse.id,
      startAt: hoursFromNow(72),
      endAt: hoursFromNow(96),
      items: [{ productId: product.id, quantity: 1 }],
      subtotal: 15_000,
      total: 15_000,
    },
    lookup(),
  )
  assert(bookingA.ok && bookingB.ok && bookingC.ok, '3 bookings created')

  const oldBooking = createAndReserveRentalBookingForUser(
    persistence,
    owner,
    org,
    {
      customerId: customer.id,
      warehouseId: warehouse.id,
      startAt: hoursFromNow(120),
      endAt: hoursFromNow(144),
      items: [{ productId: product.id, quantity: 1 }],
      subtotal: 9_000,
      total: 9_000,
    },
    lookup(),
  )
  assert(oldBooking.ok, 'out-of-range booking')
  persistence.rentalBookings.update(oldBooking.value.id, {
    createdAt: '2020-01-15T12:00:00.000Z',
  })

  const now = nowIso()
  const range = resolveAnalyticsRange('month', now)
  const overview = getRentalAnalyticsForUser(persistence, owner, org, { at: now, range })
  assert(overview.ok, 'rental overview')
  assert(overview.value.totals.bookings === 3, 'bookings = 3 in period')
  assert(overview.value.totals.rentedQuantity === 4, 'quantity = 4')
  assert(overview.value.totals.issued === 0, 'none issued yet')
  assert(overview.value.totals.active === 0, 'none in use yet')
  assert(overview.value.totals.overdue === 0, 'none overdue yet')
  assert(overview.value.totals.rentalTotal === 65_000, 'rental total in period')
  assert(overview.value.totals.prepayment === 5_000, 'agreed prepayment is not revenue')

  const allTime = getRentalAnalyticsForUser(persistence, owner, org, now)
  assert(allTime.ok && allTime.value.totals.bookings === 4, 'rental tab stays all-time')

  assert(
    createRentalBookingPaymentForUser(persistence, owner, {
      organizationId: org,
      rentalBookingId: bookingA.value.id,
      amount: 25_000,
      method: 'cash',
      currency: 'KZT',
    }).ok,
    'pay 25000',
  )
  assert(
    createRentalBookingPaymentForUser(persistence, owner, {
      organizationId: org,
      rentalBookingId: bookingB.value.id,
      amount: 20_000,
      method: 'cash',
      currency: 'KZT',
    }).ok,
    'pay 20000',
  )

  const paidRange = resolveAnalyticsRange('month', nowIso())
  const paidOverview = getRentalAnalyticsForUser(persistence, owner, org, {
    at: nowIso(),
    range: paidRange,
  })
  assert(paidOverview.ok && paidOverview.value.totals.paidAmount === 45_000, 'paid = 45000')
  assert(paidOverview.value.totals.paymentsIncluded, 'payments loaded for owner')
  assert(
    paidOverview.value.totals.dueAmount === 20_000,
    'due = current balances of period bookings',
  )

  const managerPaid = getRentalAnalyticsForUser(persistence, warehouseManager, org, {
    at: nowIso(),
    range: paidRange,
  })
  assert(
    managerPaid.ok && managerPaid.value.totals.paymentsIncluded === false,
    'warehouse manager does not load rental payments without payments.read',
  )
  assert(managerPaid.value.totals.bookings === 3, 'manager still sees scoped bookings')

  const issued = issueRentalBookingForUser(persistence, owner, bookingA.value.id)
  assert(issued.ok && issued.value.viewStatus === 'active', 'issued booking is in use')
  const afterIssue = getRentalAnalyticsForUser(persistence, owner, org, {
    at: nowIso(),
    range: resolveAnalyticsRange('month', nowIso()),
  })
  assert(afterIssue.ok && afterIssue.value.totals.active === 1, 'in use increases')
  assert(afterIssue.value.totals.issued === 1, 'issued count')

  const overdue = issueRentalBookingForUser(persistence, owner, bookingB.value.id)
  assert(overdue.ok && overdue.value.viewStatus === 'overdue', 'issued past end is overdue')
  const afterOverdue = getRentalAnalyticsForUser(persistence, owner, org, {
    at: nowIso(),
    range: resolveAnalyticsRange('month', nowIso()),
  })
  assert(afterOverdue.ok && afterOverdue.value.totals.overdue === 1, 'overdue increases')

  const financial = getFinancialAnalyticsForUser(
    persistence,
    owner,
    resolveAnalyticsRange('month', nowIso()),
  )
  assert(financial.ok, 'financial analytics still available via analytics module')
  assert(financial.value.kpis.salesCount === 0, 'sales KPIs stay zero without sales')
  assert(financial.value.kpis.revenue === 0, 'sales revenue is not rental payments')

  const expense = createExpenseForUser(persistence, owner, org, {
    category: 'rent',
    description: 'Rent hall',
    amount: 150_000,
    date: nowIso().slice(0, 10),
  })
  assert(expense.ok, 'expense 150000')
  const financialWithExpense = getFinancialAnalyticsForUser(
    persistence,
    owner,
    resolveAnalyticsRange('month', nowIso()),
  )
  assert(
    financialWithExpense.ok && financialWithExpense.value.kpis.expenses === 150_000,
    'overview expenses KPI uses Expense records',
  )
  assert(financialWithExpense.value.kpis.revenue === 0, 'expenses do not mix into sales revenue')

  const dash = getCompanyDashboardForUser(persistence, owner)
  assert(dash.ok && dash.value.rental, 'dashboard rental KPIs')
  assert(dash.value.rental.bookings === 3, 'dashboard bookings this month')
  assert(dash.value.rental.active === 1, 'dashboard in use')
  assert(dash.value.rental.overdue === 1, 'dashboard overdue')
  assert(dash.value.rental.dueAmount === 29_000, 'dashboard due includes live balances')
  assert(dash.value.rental.paidAmount === 45_000, 'dashboard paid is rental payments')
  assert(dash.value.rental.expenses === 150_000, 'dashboard expenses from Expense')
  assert(dash.value.rental.netResult === -105_000, 'net = paid - expenses')
  assert(dash.value.warehouse, 'warehouse KPI follows warehouse module even on rental companies')
  assert(!dash.value.analytics, 'sales-centric dashboard analytics hidden when sales OFF')
  assert(!dash.value.sales, 'sales widget hidden when sales OFF')

  const mixedOrg = 'org-analytics-mixed'
  addOrg(persistence, mixedOrg, 'Mixed')
  const mixedOwner = addUser(persistence, mixedOrg, 'owner')
  seedEnabledBusinessModules(persistence, mixedOrg, mixedOwner.id, [
    'sales',
    'warehouse',
    'analytics',
    'rental',
  ])
  const mixedBranch = addBranch(persistence, mixedOrg, 'Mixed branch')
  const mixedWarehouse = addWarehouse(persistence, mixedOrg, mixedBranch.id, 'Mixed WH')
  const mixedProduct = createProductForUser(persistence, mixedOwner, mixedOrg, {
    name: 'Sale item',
    sku: 'MX-1',
    unit: 'шт',
    itemType: 'product',
    basePrice: 10_000,
    costPrice: 4_000,
    status: 'active',
  })
  assert(mixedProduct.ok, 'mixed product')
  assert(
    setStock(persistence, mixedOrg, mixedWarehouse.id, mixedProduct.value.id, 20).ok,
    'mixed stock',
  )
  const mixedCustomer = addCustomer(persistence, mixedOrg, '+77001110002')
  const mixedBooking = createAndReserveRentalBookingForUser(
    persistence,
    mixedOwner,
    mixedOrg,
    {
      customerId: mixedCustomer.id,
      warehouseId: mixedWarehouse.id,
      startAt: hoursFromNow(1),
      endAt: hoursFromNow(25),
      items: [{ productId: mixedProduct.value.id, quantity: 1 }],
      subtotal: 45_000,
      total: 45_000,
    },
    lookup(),
  )
  assert(mixedBooking.ok, 'mixed rental booking')
  assert(
    createRentalBookingPaymentForUser(persistence, mixedOwner, {
      organizationId: mixedOrg,
      rentalBookingId: mixedBooking.value.id,
      amount: 45_000,
      method: 'cash',
      currency: 'KZT',
    }).ok,
    'mixed rental payment',
  )
  const sale = createSaleForUser(persistence, mixedOwner, mixedOrg, 'KZT', {
    discount: 0,
    warehouseId: mixedWarehouse.id,
    items: [
      {
        productId: mixedProduct.value.id,
        quantity: 1,
        unitPrice: 10_000,
        discount: 0,
      },
    ],
  })
  assert(sale.ok, 'mixed sale')
  assert(confirmSaleForUser(persistence, mixedOwner, mixedOrg, sale.value.sale.id).ok, 'confirm')
  assert(completeSaleForUser(persistence, mixedOwner, mixedOrg, sale.value.sale.id).ok, 'complete')
  assert(
    createPaymentForUser(persistence, mixedOwner, {
      organizationId: mixedOrg,
      createdBy: mixedOwner.id,
      saleId: sale.value.sale.id,
      amount: 10_000,
      method: 'cash',
    }).ok,
    'sale payment',
  )

  const mixedRange = resolveAnalyticsRange('month', nowIso())
  const mixedSales = getFinancialAnalyticsForUser(persistence, mixedOwner, mixedRange)
  const mixedRental = getRentalAnalyticsForUser(persistence, mixedOwner, mixedOrg, {
    at: nowIso(),
    range: mixedRange,
  })
  assert(mixedSales.ok && mixedRental.ok, 'mixed reports')
  assert(mixedSales.value.kpis.revenue === 10_000, 'sales revenue is not mixed with rental')
  assert(mixedRental.value.totals.paidAmount === 45_000, 'rental paid stays on rental')
  assert(mixedSales.value.kpis.salesCount === 1, 'sales count stays sales-only')

  const mixedDash = getCompanyDashboardForUser(persistence, mixedOwner)
  assert(mixedDash.ok && mixedDash.value.sales && mixedDash.value.rental, 'mixed dashboard blocks')
  assert(mixedDash.value.sales.revenue === 10_000, 'dashboard sales revenue unmixed')
  assert(mixedDash.value.rental.bookings === 1, 'dashboard rental bookings unmixed')

  console.log('analytics-overview.verify: ok')
}

runAnalyticsOverviewChecks()
