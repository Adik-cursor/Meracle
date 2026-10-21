import type { Contact, Customer, Id, User, UserRole } from '../types'
import { createInMemoryPersistence } from '../repositories/in-memory/create-in-memory-persistence'
import type { Persistence } from '../repositories/persistence'
import { completeSaleForUser } from './complete-sale'
import { getCompanyDashboardForUser } from './company-dashboard'
import { createContactForUser } from './contacts'
import { createDealForUser } from './deals'
import { createPaymentForUser } from './create-payment'
import {
  currentMotivationPeriodKey,
  saveEmployeeMotivationForUser,
} from './employee-motivation'
import { createExpenseForUser, todayExpenseDateInput } from './expenses'
import { createCareGroupForUser } from './care-groups'
import { assignChildToGroupForUser, createChildForUser } from './children'
import { markAttendanceForUser } from './attendance'
import { setStock } from './inventory'
import { seedEnabledBusinessModules } from './organization-modules'
import { newId, nowIso } from './primitives'
import { createProductCategoryForUser } from './product-categories'
import { createProductForUser } from './products'
import {
  createAndReserveRentalBookingForUser,
} from './rental-bookings'
import { createRentalBookingPaymentForUser } from './rental-payments'
import type { RentalPartyLookup } from './rental-party'
import { confirmSaleForUser, createSaleForUser } from './sales'

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
  extras: {
    branchId?: Id
    departmentId?: Id
    warehouseId?: Id
  } = {},
): User {
  const now = nowIso()
  const user: User = {
    id: newId(),
    organizationId,
    email: `${role}-${newId()}@${organizationId}.local`,
    firstName: role,
    lastName: newId().slice(0, 6),
    role,
    status: 'active',
    ...extras,
    createdAt: now,
    updatedAt: now,
  }
  persistence.users.create(user)
  return user
}

export function runCompanyDashboardChecks(): void {
  const persistence = createInMemoryPersistence()
  const orgA = 'org-dash'
  addOrg(persistence, orgA, 'Dash Org')
  seedEnabledBusinessModules(persistence, orgA, 'seed')

  const now = nowIso()
  const branch = persistence.branches.create({
    id: newId(),
    organizationId: orgA,
    name: 'Branch',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  })
  const department = persistence.departments.create({
    id: newId(),
    organizationId: orgA,
    branchId: branch.id,
    name: 'Sales',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  })
  const warehouse = persistence.warehouses.create({
    id: newId(),
    organizationId: orgA,
    branchId: branch.id,
    name: 'WH',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  })

  const owner = addUser(persistence, orgA, 'owner')
  const employee = addUser(persistence, orgA, 'sales_employee', {
    branchId: branch.id,
    departmentId: department.id,
    warehouseId: warehouse.id,
  })

  const product = createProductForUser(persistence, owner, orgA, {
    name: 'Item',
    sku: 'IT-1',
    unit: 'шт',
    itemType: 'product',
    basePrice: 1000,
    costPrice: 0,
    status: 'active',
  })
  assert(product.ok, 'product')
  assert(setStock(persistence, orgA, warehouse.id, product.value.id, 50, 0).ok, 'stock')

  const ownerSale = createSaleForUser(persistence, owner, orgA, 'KZT', {
    discount: 0,
    warehouseId: warehouse.id,
    items: [
      { productId: product.value.id, quantity: 1, unitPrice: 10_000, discount: 0 },
    ],
  })
  assert(ownerSale.ok, 'owner sale')
  assert(confirmSaleForUser(persistence, owner, orgA, ownerSale.value.sale.id).ok, 'owner confirm')
  assert(completeSaleForUser(persistence, owner, orgA, ownerSale.value.sale.id).ok, 'owner complete')
  assert(
    createPaymentForUser(persistence, owner, {
      organizationId: orgA,
      createdBy: owner.id,
      saleId: ownerSale.value.sale.id,
      amount: 10_000,
      method: 'cash',
    }).ok,
    'owner pay',
  )

  const employeeSale = createSaleForUser(persistence, employee, orgA, 'KZT', {
    discount: 0,
    warehouseId: warehouse.id,
    items: [
      { productId: product.value.id, quantity: 1, unitPrice: 3_000, discount: 0 },
    ],
  })
  assert(employeeSale.ok, 'employee sale')
  assert(
    confirmSaleForUser(persistence, employee, orgA, employeeSale.value.sale.id).ok,
    'employee confirm',
  )
  assert(
    completeSaleForUser(persistence, employee, orgA, employeeSale.value.sale.id).ok,
    'employee complete',
  )
  assert(
    createPaymentForUser(persistence, employee, {
      organizationId: orgA,
      createdBy: employee.id,
      saleId: employeeSale.value.sale.id,
      amount: 3_000,
      method: 'cash',
    }).ok,
    'employee pay',
  )

  const ownerDash = getCompanyDashboardForUser(persistence, owner)
  assert(ownerDash.ok, 'owner dashboard')
  assert(ownerDash.value.sales, 'owner sees sales widget')
  assert(
    ownerDash.value.sales.count >= 2 && ownerDash.value.sales.revenue >= 13_000,
    'owner sees company-scoped sales KPI',
  )
  assert(ownerDash.value.debts, 'owner sees debts widget')
  assert(ownerDash.value.warehouse, 'owner sees warehouse widget')
  assert(ownerDash.value.crm, 'owner sees CRM widget')
  assert(ownerDash.value.companyPlans, 'owner sees company plans')
  assert(ownerDash.value.analytics, 'owner sees analytics')
  assert(ownerDash.value.quickActions.newSale, 'owner new sale')
  assert(ownerDash.value.quickActions.receiveStock, 'owner receive stock')
  assert(ownerDash.value.quickActions.newExpense, 'owner new expense')
  assert(!ownerDash.value.ownMotivation, 'owner uses company plans not only own')

  const employeeDash = getCompanyDashboardForUser(persistence, employee)
  assert(employeeDash.ok, 'employee dashboard')
  assert(employeeDash.value.sales, 'employee sees own sales widget')
  assert(
    employeeDash.value.sales.revenue === 3_000 &&
      employeeDash.value.sales.count === 1,
    'employee does not see company-wide revenue',
  )
  assert(employeeDash.value.sales.revenue !== ownerDash.value.sales?.revenue, 'revenue isolated')
  assert(employeeDash.value.debts === undefined, 'employee does not see company debts')
  assert(employeeDash.value.warehouse === undefined, 'employee does not see warehouse KPI')
  assert(employeeDash.value.crm === undefined, 'employee does not see company CRM stats')
  assert(employeeDash.value.analytics === undefined, 'employee does not see company profit')
  assert(employeeDash.value.expenses === undefined, 'employee does not see company expenses')
  assert(employeeDash.value.companyPlans === undefined, 'employee does not see company plans')
  assert(employeeDash.value.rental === undefined, 'employee does not see rental KPI')
  assert(employeeDash.value.quickActions.newSale, 'employee may create sale')
  assert(employeeDash.value.quickActions.newDeal, 'employee may create deal if CRM on')
  assert(!employeeDash.value.quickActions.receiveStock, 'employee cannot receive stock')
  assert(!employeeDash.value.quickActions.newExpense, 'employee cannot create expense')

  const reload = getCompanyDashboardForUser(persistence, employee)
  assert(reload.ok && reload.value.debts === undefined, 'refresh still hides debts')
  assert(reload.ok && reload.value.warehouse === undefined, 'refresh still hides warehouse')

  const branchB = persistence.branches.create({
    id: newId(),
    organizationId: orgA,
    name: 'Branch B',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  })
  const departmentB = persistence.departments.create({
    id: newId(),
    organizationId: orgA,
    branchId: branchB.id,
    name: 'Sales B',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  })
  const warehouseB = persistence.warehouses.create({
    id: newId(),
    organizationId: orgA,
    branchId: branchB.id,
    name: 'WH B',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  })
  assert(setStock(persistence, orgA, warehouseB.id, product.value.id, 50, 0).ok, 'stock B')

  const manager = addUser(persistence, orgA, 'sales_manager', {
    branchId: branch.id,
    departmentId: department.id,
  })
  const director = addUser(persistence, orgA, 'branch_director', {
    branchId: branch.id,
  })
  const employeeB = addUser(persistence, orgA, 'sales_employee', {
    branchId: branchB.id,
    departmentId: departmentB.id,
    warehouseId: warehouseB.id,
  })

  const otherSale = createSaleForUser(persistence, employeeB, orgA, 'KZT', {
    discount: 0,
    warehouseId: warehouseB.id,
    items: [{ productId: product.value.id, quantity: 1, unitPrice: 8_000, discount: 0 }],
  })
  assert(otherSale.ok, 'branch B sale')
  assert(confirmSaleForUser(persistence, employeeB, orgA, otherSale.value.sale.id).ok, 'b confirm')
  assert(completeSaleForUser(persistence, employeeB, orgA, otherSale.value.sale.id).ok, 'b complete')
  assert(
    createPaymentForUser(persistence, employeeB, {
      organizationId: orgA,
      createdBy: employeeB.id,
      saleId: otherSale.value.sale.id,
      amount: 8_000,
      method: 'cash',
    }).ok,
    'b pay',
  )

  const managerDash = getCompanyDashboardForUser(persistence, manager)
  assert(managerDash.ok && managerDash.value.sales, 'manager sales widget')
  assert(
    managerDash.value.sales.revenue === 13_000,
    'manager sees own-branch sales, not other branch',
  )
  assert(managerDash.value.companyPlans, 'manager sees scoped plans')

  const directorDash = getCompanyDashboardForUser(persistence, director)
  assert(directorDash.ok && directorDash.value.sales, 'director sales widget')
  assert(
    directorDash.value.sales.revenue === 13_000,
    'director sees own-branch sales, not other branch',
  )

  const orgB = 'org-dash-b'
  addOrg(persistence, orgB, 'Other Org')
  seedEnabledBusinessModules(persistence, orgB, 'seed')
  const ownerB = addUser(persistence, orgB, 'owner')
  const productB = createProductForUser(persistence, ownerB, orgB, {
    name: 'Other',
    sku: 'OT-1',
    unit: 'шт',
    itemType: 'product',
    basePrice: 1000,
    costPrice: 0,
    status: 'active',
  })
  assert(productB.ok, 'org B product')
  const ownerBDash = getCompanyDashboardForUser(persistence, ownerB)
  assert(ownerBDash.ok, 'org B dashboard')
  assert(
    (ownerBDash.value.sales?.revenue ?? 0) !== (ownerDash.value.sales?.revenue ?? 0) ||
      ownerBDash.value.sales?.count !== ownerDash.value.sales?.count,
    'multi-company dashboards stay isolated',
  )
  const employeeAfterB = getCompanyDashboardForUser(persistence, employee)
  assert(
    employeeAfterB.ok && employeeAfterB.value.sales?.revenue === 3_000,
    'company B data does not leak into employee A dashboard',
  )

  const rentalOrg = 'org-dash-rental'
  addOrg(persistence, rentalOrg, 'Rental Dash')
  seedEnabledBusinessModules(persistence, rentalOrg, 'seed', [
    'crm',
    'warehouse',
    'expenses',
    'analytics',
    'rental',
    'plans',
  ])
  const rentalNow = nowIso()
  const rentalBranch = persistence.branches.create({
    id: newId(),
    organizationId: rentalOrg,
    name: 'Rental branch',
    status: 'active',
    createdAt: rentalNow,
    updatedAt: rentalNow,
  })
  const rentalWarehouse = persistence.warehouses.create({
    id: newId(),
    organizationId: rentalOrg,
    branchId: rentalBranch.id,
    name: 'Rental WH',
    status: 'active',
    createdAt: rentalNow,
    updatedAt: rentalNow,
  })
  const rentalOwner = addUser(persistence, rentalOrg, 'owner')
  const rentalProduct = createProductForUser(persistence, rentalOwner, rentalOrg, {
    name: 'Costume 0723',
    sku: 'C-0723',
    unit: 'шт',
    itemType: 'product',
    basePrice: 50_000,
    costPrice: 0,
    status: 'active',
  })
  assert(rentalProduct.ok, 'rental product')
  assert(
    setStock(persistence, rentalOrg, rentalWarehouse.id, rentalProduct.value.id, 20, 0).ok,
    'rental stock',
  )
  const rentalContacts = new Map<
    Id,
    Pick<Contact, 'organizationId' | 'phone' | 'firstName' | 'lastName'>
  >()
  const rentalLookup = (): RentalPartyLookup => ({
    getContact: (id) => rentalContacts.get(id),
    getCompany: () => undefined,
  })
  const contactId = newId()
  rentalContacts.set(contactId, {
    organizationId: rentalOrg,
    phone: '+77001112233',
    firstName: 'Ваня',
    lastName: 'Ломов',
  })
  const rentalCustomer: Customer = persistence.customers.create({
    id: newId(),
    organizationId: rentalOrg,
    type: 'contact',
    contactId,
    status: 'active',
    createdAt: rentalNow,
    updatedAt: rentalNow,
  })
  const bookingOne = createAndReserveRentalBookingForUser(
    persistence,
    rentalOwner,
    rentalOrg,
    {
      customerId: rentalCustomer.id,
      warehouseId: rentalWarehouse.id,
      startAt: new Date(Date.now() + 3600_000).toISOString(),
      endAt: new Date(Date.now() + 36 * 3600_000).toISOString(),
      items: [{ productId: rentalProduct.value.id, quantity: 1 }],
      subtotal: 300_000,
      total: 300_000,
    },
    rentalLookup(),
  )
  const bookingTwo = createAndReserveRentalBookingForUser(
    persistence,
    rentalOwner,
    rentalOrg,
    {
      customerId: rentalCustomer.id,
      warehouseId: rentalWarehouse.id,
      startAt: new Date(Date.now() + 48 * 3600_000).toISOString(),
      endAt: new Date(Date.now() + 72 * 3600_000).toISOString(),
      items: [{ productId: rentalProduct.value.id, quantity: 1 }],
      subtotal: 200_000,
      total: 200_000,
    },
    rentalLookup(),
  )
  assert(bookingOne.ok && bookingTwo.ok, 'rental bookings')
  assert(
    createRentalBookingPaymentForUser(persistence, rentalOwner, {
      organizationId: rentalOrg,
      rentalBookingId: bookingOne.value.id,
      amount: 300_000,
      method: 'cash',
      currency: 'KZT',
    }).ok,
    'rental payment 300000',
  )
  assert(
    createRentalBookingPaymentForUser(persistence, rentalOwner, {
      organizationId: rentalOrg,
      rentalBookingId: bookingTwo.value.id,
      amount: 200_000,
      method: 'cash',
      currency: 'KZT',
    }).ok,
    'rental payment 200000',
  )
  assert(
    createExpenseForUser(persistence, rentalOwner, rentalOrg, {
      category: 'rent',
      description: 'Hall',
      amount: 150_000,
      date: rentalNow.slice(0, 10),
    }).ok,
    'rental expense 150000',
  )
  const category = createProductCategoryForUser(persistence, rentalOwner, {
    name: 'Rental plan',
    status: 'active',
  })
  assert(category.ok, 'rental plan category')
  assert(
    saveEmployeeMotivationForUser(
      persistence,
      rentalOwner,
      rentalOwner.id,
      currentMotivationPeriodKey(),
      [{ categoryId: category.value.id, planAmount: 1_000_000, bonusPercent: 1 }],
    ).ok,
    'rental plan 1000000',
  )

  const rentalDash = getCompanyDashboardForUser(persistence, rentalOwner)
  assert(rentalDash.ok && rentalDash.value.rental, 'rental dashboard')
  assert(!rentalDash.value.sales, 'rental company has no sales KPI')
  assert(rentalDash.value.rental.paidAmount === 500_000, 'paid = rental payments 500000')
  assert(rentalDash.value.rental.expenses === 150_000, 'expenses = 150000')
  assert(rentalDash.value.rental.netResult === 350_000, 'net = 500000 - 150000')
  assert(rentalDash.value.rental.planTarget === 1_000_000, 'plan target reused')
  assert(rentalDash.value.rental.planPaid === 500_000, 'plan actual is rental paid')
  assert(rentalDash.value.rental.planCompletion === 50, 'plan completion 50%')
  assert(rentalDash.value.warehouse, 'warehouse KPI follows warehouse module on rental companies')
  const reloaded = getCompanyDashboardForUser(persistence, rentalOwner)
  assert(
    reloaded.ok &&
      reloaded.value.rental?.paidAmount === 500_000 &&
      reloaded.value.rental.expenses === 150_000 &&
      reloaded.value.rental.netResult === 350_000,
    'rental dashboard values persist after reload',
  )
  assert(rentalDash.value.care === undefined, 'rental dashboard is not care dashboard')
  assert(ownerDash.value.care === undefined, 'sales dashboard is not care dashboard')

  const kinderOrg = 'org-dash-kinder'
  const kinderNow = nowIso()
  persistence.organizations.create({
    id: kinderOrg,
    organizationId: kinderOrg,
    name: 'Детский сад',
    status: 'active',
    businessTypeId: 'kindergarten',
    createdAt: kinderNow,
    updatedAt: kinderNow,
  })
  seedEnabledBusinessModules(persistence, kinderOrg, 'seed', [
    'crm',
    'expenses',
    'analytics',
    'children',
    'attendance',
  ])
  const kinderOwner = addUser(persistence, kinderOrg, 'owner')
  const kinderContact = createContactForUser(persistence, kinderOwner, {
    firstName: 'Анна',
    lastName: 'Иванова',
    phone: '+77015550001',
  })
  assert(kinderContact.ok, 'kindergarten contact')
  const kinderDeal = createDealForUser(
    persistence,
    kinderOwner,
    kinderOrg,
    {
      title: 'Заявка семьи Ивановых',
      amount: null,
      currency: 'KZT',
      companyId: null,
      contactId: kinderContact.value.id,
      status: 'new',
    },
    {
      getContact: (id) => persistence.contacts.getById(id),
      getCompany: () => undefined,
    },
  )
  assert(kinderDeal.ok, 'kindergarten application')
  assert(
    createExpenseForUser(persistence, kinderOwner, kinderOrg, {
      category: 'rent',
      description: 'Аренда',
      amount: 40_000,
      date: kinderNow.slice(0, 10),
    }).ok,
    'kindergarten expense',
  )
  const kinderGroup = createCareGroupForUser(persistence, kinderOwner, {
    name: 'Младшая группа',
    capacity: 20,
    status: 'active',
  })
  assert(kinderGroup.ok, 'kindergarten group')
  const kinderChild = createChildForUser(persistence, kinderOwner, {
    firstName: 'Мария',
    lastName: 'Иванова',
    birthDate: '2021-03-12',
    groupId: kinderGroup.value.id,
    status: 'active',
    parentContactId: kinderContact.value.id,
  })
  assert(kinderChild.ok, 'kindergarten child')
  assert(
    assignChildToGroupForUser(
      persistence,
      kinderOwner,
      kinderChild.value.id,
      kinderGroup.value.id,
    ).ok,
    'assign child',
  )
  assert(
    markAttendanceForUser(persistence, kinderOwner, {
      childId: kinderChild.value.id,
      date: todayExpenseDateInput(),
      status: 'present',
    }).ok,
    'mark present',
  )

  const kinderDash = getCompanyDashboardForUser(persistence, kinderOwner)
  assert(kinderDash.ok && kinderDash.value.care, 'kindergarten care dashboard')
  assert(!kinderDash.value.sales, 'kindergarten does not use sales KPI')
  assert(!kinderDash.value.rental, 'kindergarten does not use rental dashboard')
  assert(!kinderDash.value.warehouse, 'kindergarten does not load warehouse KPI')
  assert(!kinderDash.value.analytics, 'kindergarten does not load sales analytics')
  assert(!kinderDash.value.companyPlans, 'kindergarten dashboard hides plans')
  assert(kinderDash.value.care.applicationsIncluded, 'CRM applications loaded')
  assert(kinderDash.value.care.newApplications === 1, 'one new application')
  assert(
    kinderDash.value.care.groups.some((group) => group.name === 'Младшая группа'),
    'real care group occupancy',
  )
  assert(kinderDash.value.care.enrolled === 1, 'one enrolled child')
  assert(kinderDash.value.care.present === 1, 'present from attendance')
  assert(kinderDash.value.quickActions.addChild, 'add child action')
  assert(kinderDash.value.quickActions.markAttendance, 'attendance action')
  assert(kinderDash.value.care.expensesIncluded, 'expenses loaded')
  assert(kinderDash.value.care.expenses === 40_000, 'expense amount is real')
  assert(kinderDash.value.care.paymentsIncluded, 'care payments readable without sales')
  assert(!kinderDash.value.care.debtsIncluded, 'debts stay on existing sales-gated helper')
  assert(kinderDash.value.quickActions.newDeal, 'new application action')
  assert(!kinderDash.value.quickActions.newSale, 'sale action hidden without sales module')
  assert(kinderDash.value.quickActions.newExpense, 'expense action')
  const kinderReload = getCompanyDashboardForUser(persistence, kinderOwner)
  assert(
    kinderReload.ok &&
      kinderReload.value.care?.expenses === 40_000 &&
      kinderReload.value.care.newApplications === 1,
    'kindergarten dashboard persists after reload',
  )

  const crmOffOrg = 'org-dash-kinder-crm-off'
  persistence.organizations.create({
    id: crmOffOrg,
    organizationId: crmOffOrg,
    name: 'Сад без CRM',
    status: 'active',
    businessTypeId: 'kindergarten',
    createdAt: kinderNow,
    updatedAt: kinderNow,
  })
  seedEnabledBusinessModules(persistence, crmOffOrg, 'seed', [
    'expenses',
    'analytics',
    'children',
    'attendance',
  ])
  const crmOffOwner = addUser(persistence, crmOffOrg, 'owner')
  const crmOffDash = getCompanyDashboardForUser(persistence, crmOffOwner)
  assert(crmOffDash.ok && crmOffDash.value.care, 'care dashboard without CRM')
  assert(!crmOffDash.value.care.applicationsIncluded, 'CRM block not loaded when CRM off')
  assert(crmOffDash.value.care.applications.length === 0, 'no deals fetched for UI hide')
  assert(!crmOffDash.value.quickActions.newDeal, 'no application action without CRM')

  console.log('company-dashboard.verify: ok')
}

runCompanyDashboardChecks()
