import type { DomainErrorCode } from '../types/domain-error'
import type { Id, User, UserRole } from '../types'
import { createInMemoryPersistence } from '../repositories/in-memory/create-in-memory-persistence'
import type { Persistence } from '../repositories/persistence'
import { completeReturnForUser } from './complete-return'
import { completeSaleForUser } from './complete-sale'
import { createPaymentForUser } from './create-payment'
import { setStock } from './inventory'
import {
  createCustomerDebtPaymentForUser,
  listCustomerDebtPaymentsForUser,
  listCustomerDebtsForUser,
} from './customer-debts'
import {
  computeMotivationBonus,
  currentMotivationPeriodKey,
  getEmployeeMotivationForUser,
  listCompanyMotivationPlansForUser,
  saveEmployeeMotivationForUser,
} from './employee-motivation'
import { newId, nowIso } from './primitives'
import { seedEnabledBusinessModules } from './organization-modules'
import {
  createProductCategoryForUser,
  listProductCategoriesForUser,
} from './product-categories'
import { createProductForUser, updateProductForUser } from './products'
import { createReturnForUser } from './sale-returns'
import { confirmSaleForUser, createSaleForUser } from './sales'
import { setUserSalaryForUser } from './users'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function denied(
  result: { ok: boolean; error?: { code: DomainErrorCode } },
  code: DomainErrorCode,
  message: string,
): void {
  assert(!result.ok && result.error?.code === code, message)
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
    salaryAmount?: number
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

function addCustomer(persistence: Persistence, organizationId: Id): Id {
  const now = nowIso()
  const id = newId()
  persistence.customers.create({
    id,
    organizationId,
    type: 'company',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  })
  return id
}

export function runMotivationDebtChecks(): void {
  const persistence = createInMemoryPersistence()
  const orgA = 'org-a'
  const orgB = 'org-b'
  addOrg(persistence, orgA, 'A')
  addOrg(persistence, orgB, 'B')
  seedEnabledBusinessModules(persistence, orgA, 'seed')
  seedEnabledBusinessModules(persistence, orgB, 'seed')

  const now = nowIso()
  const branchA = persistence.branches.create({
    id: newId(),
    organizationId: orgA,
    name: 'Branch A',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  })
  const branchB = persistence.branches.create({
    id: newId(),
    organizationId: orgA,
    name: 'Branch B',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  })
  const deptA = persistence.departments.create({
    id: newId(),
    organizationId: orgA,
    branchId: branchA.id,
    name: 'Dept A',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  })
  const deptB = persistence.departments.create({
    id: newId(),
    organizationId: orgA,
    branchId: branchA.id,
    name: 'Dept B',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  })
  const warehouse = persistence.warehouses.create({
    id: newId(),
    organizationId: orgA,
    branchId: branchA.id,
    name: 'WH A',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  })

  const owner = addUser(persistence, orgA, 'owner')
  const warehouseManager = addUser(persistence, orgA, 'warehouse_manager', {
    branchId: branchA.id,
    warehouseId: warehouse.id,
  })
  const manager = addUser(persistence, orgA, 'sales_manager', {
    branchId: branchA.id,
    departmentId: deptA.id,
  })
  const director = addUser(persistence, orgA, 'branch_director', {
    branchId: branchA.id,
  })
  const employeeA = addUser(persistence, orgA, 'sales_employee', {
    branchId: branchA.id,
    departmentId: deptA.id,
    warehouseId: warehouse.id,
    salaryAmount: 300000,
  })
  const employeeB = addUser(persistence, orgA, 'sales_employee', {
    branchId: branchA.id,
    departmentId: deptA.id,
    warehouseId: warehouse.id,
    salaryAmount: 200000,
  })
  const employeeOtherDept = addUser(persistence, orgA, 'sales_employee', {
    branchId: branchA.id,
    departmentId: deptB.id,
    warehouseId: warehouse.id,
  })
  const employeeOtherBranch = addUser(persistence, orgA, 'sales_employee', {
    branchId: branchB.id,
    departmentId: persistence.departments.create({
      id: newId(),
      organizationId: orgA,
      branchId: branchB.id,
      name: 'Dept C',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    }).id,
    warehouseId: persistence.warehouses.create({
      id: newId(),
      organizationId: orgA,
      branchId: branchB.id,
      name: 'WH B',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    }).id,
  })
  const accountant = addUser(persistence, orgA, 'accountant')
  const foreignOwner = addUser(persistence, orgB, 'owner')
  const foreignWarehouse = addUser(persistence, orgB, 'warehouse_manager')

  const anesthesia = createProductCategoryForUser(persistence, warehouseManager, {
    name: 'Анестезия',
    status: 'active',
  })
  assert(anesthesia.ok, '1 warehouse manager creates category')

  denied(
    createProductCategoryForUser(persistence, manager, {
      name: 'Композиты',
      status: 'active',
    }),
    'ACCESS_DENIED',
    '2 manager cannot create category',
  )
  denied(
    createProductCategoryForUser(persistence, director, {
      name: 'Композиты',
      status: 'active',
    }),
    'ACCESS_DENIED',
    '2 director cannot create category',
  )

  const composites = createProductCategoryForUser(persistence, warehouseManager, {
    name: 'Композиты',
    status: 'active',
  })
  assert(composites.ok, 'composites category')

  const listed = listProductCategoriesForUser(persistence, manager)
  assert(listed.ok && listed.value.length === 2, '3 manager sees org categories')

  const foreignCategory = createProductCategoryForUser(persistence, foreignWarehouse, {
    name: 'Foreign',
    status: 'active',
  })
  assert(foreignCategory.ok, 'foreign category')
  denied(
    createProductForUser(persistence, owner, orgA, {
      name: 'X',
      sku: 'X-1',
      unit: 'шт',
      itemType: 'service',
      basePrice: 1,
      costPrice: 0,
      status: 'active',
      categoryId: foreignCategory.value.id,
    }),
    'ORGANIZATION_MISMATCH',
    '4 foreign category on product',
  )

  denied(
    saveEmployeeMotivationForUser(persistence, manager, employeeA.id, currentMotivationPeriodKey(), [
      {
        categoryId: foreignCategory.value.id,
        planAmount: 1000,
        bonusPercent: 2,
      },
    ]),
    'ORGANIZATION_MISMATCH',
    '4 motivation foreign category',
  )

  denied(
    saveEmployeeMotivationForUser(persistence, manager, employeeA.id, currentMotivationPeriodKey(), [
      { categoryId: newId(), planAmount: 1000, bonusPercent: 2 },
    ]),
    'CATEGORY_NOT_FOUND',
    '6 unknown category',
  )

  const inactive = createProductCategoryForUser(persistence, warehouseManager, {
    name: 'Inactive',
    status: 'inactive',
  })
  assert(inactive.ok, 'inactive category')
  denied(
    saveEmployeeMotivationForUser(persistence, manager, employeeA.id, currentMotivationPeriodKey(), [
      { categoryId: inactive.value.id, planAmount: 1000, bonusPercent: 2 },
    ]),
    'CATEGORY_INACTIVE',
    '7 inactive category',
  )

  const period = currentMotivationPeriodKey()
  const savedA = saveEmployeeMotivationForUser(persistence, manager, employeeA.id, period, [
    { categoryId: anesthesia.value.id, planAmount: 2_000_000, bonusPercent: 2, thresholdPercent: 100 },
    { categoryId: composites.value.id, planAmount: 3_000_000, bonusPercent: 3, thresholdPercent: 100 },
  ])
  assert(savedA.ok && savedA.value.lines.length === 2, '5/8 two categories')

  const many = Array.from({ length: 10 }, (_, index) => {
    const created = createProductCategoryForUser(persistence, warehouseManager, {
      name: `Cat ${index + 1}`,
      status: 'active',
    })
    assert(created.ok, `category ${index}`)
    return created.value
  })
  const manySaved = saveEmployeeMotivationForUser(
    persistence,
    owner,
    employeeB.id,
    period,
    many.map((category) => ({
      categoryId: category.id,
      planAmount: 10_000,
      bonusPercent: 1,
    })),
  )
  assert(manySaved.ok && manySaved.value.lines.length === 10, '9 ten categories')

  const productA = createProductForUser(persistence, owner, orgA, {
    name: 'Anesthesia item',
    sku: 'AN-1',
    unit: 'шт',
    itemType: 'product',
    basePrice: 2_100_000,
    costPrice: 0,
    status: 'active',
    categoryId: anesthesia.value.id,
  })
  assert(productA.ok, 'product A')
  assert(
    setStock(persistence, orgA, warehouse.id, productA.value.id, 100, 0).ok,
    'stock A',
  )
  const productC = createProductForUser(persistence, owner, orgA, {
    name: 'Composite item',
    sku: 'CO-1',
    unit: 'шт',
    itemType: 'product',
    basePrice: 2_700_000,
    costPrice: 0,
    status: 'active',
    categoryId: composites.value.id,
  })
  assert(productC.ok, 'product C')
  assert(
    setStock(persistence, orgA, warehouse.id, productC.value.id, 100, 0).ok,
    'stock C',
  )

  const sale = createSaleForUser(persistence, employeeA, orgA, 'KZT', {
    discount: 0,
    warehouseId: warehouse.id,
    items: [
      {
        productId: productA.value.id,
        quantity: 1,
        unitPrice: 2_100_000,
        discount: 0,
      },
    ],
  })
  assert(sale.ok, 'sale')
  assert(confirmSaleForUser(persistence, employeeA, orgA, sale.value.sale.id).ok, 'confirm')
  assert(completeSaleForUser(persistence, employeeA, orgA, sale.value.sale.id).ok, 'complete')
  assert(
    createPaymentForUser(persistence, employeeA, {
      organizationId: orgA,
      createdBy: employeeA.id,
      saleId: sale.value.sale.id,
      amount: 2_100_000,
      method: 'cash',
    }).ok,
    'pay sale',
  )

  const viewA = getEmployeeMotivationForUser(persistence, owner, employeeA.id, period)
  assert(viewA.ok && viewA.value, 'motivation after sale')
  const anesthesiaLine = viewA.value.lines.find(
    (line) => line.categoryId === anesthesia.value.id,
  )
  assert(anesthesiaLine?.actualAmount === 2_100_000, '10 sale maps to category')
  assert(anesthesiaLine.closed && anesthesiaLine.bonusAmount === 42_000, 'bonus 2% of actual')

  const unpaid = createSaleForUser(persistence, employeeA, orgA, 'KZT', {
    discount: 0,
    warehouseId: warehouse.id,
    items: [
      {
        productId: productC.value.id,
        quantity: 1,
        unitPrice: 500_000,
        discount: 0,
      },
    ],
  })
  assert(unpaid.ok, 'unpaid sale')
  assert(confirmSaleForUser(persistence, employeeA, orgA, unpaid.value.sale.id).ok, 'confirm unpaid')
  assert(completeSaleForUser(persistence, employeeA, orgA, unpaid.value.sale.id).ok, 'complete unpaid')
  const afterUnpaid = getEmployeeMotivationForUser(persistence, owner, employeeA.id, period)
  const compositesLine = afterUnpaid.ok
    ? afterUnpaid.value?.lines.find((line) => line.categoryId === composites.value.id)
    : undefined
  assert((compositesLine?.actualAmount ?? 0) === 0, 'unpaid invoice excluded')

  const returnedSale = createSaleForUser(persistence, employeeA, orgA, 'KZT', {
    discount: 0,
    warehouseId: warehouse.id,
    items: [
      {
        productId: productA.value.id,
        quantity: 1,
        unitPrice: 100_000,
        discount: 0,
      },
    ],
  })
  assert(returnedSale.ok, 'return sale')
  assert(confirmSaleForUser(persistence, employeeA, orgA, returnedSale.value.sale.id).ok, 'confirm return sale')
  assert(completeSaleForUser(persistence, employeeA, orgA, returnedSale.value.sale.id).ok, 'complete return sale')
  assert(
    createPaymentForUser(persistence, employeeA, {
      organizationId: orgA,
      createdBy: employeeA.id,
      saleId: returnedSale.value.sale.id,
      amount: 100_000,
      method: 'cash',
    }).ok,
    'pay return sale',
  )
  const beforeReturn = getEmployeeMotivationForUser(persistence, owner, employeeA.id, period)
  const actualBefore = beforeReturn.ok
    ? beforeReturn.value?.lines.find((line) => line.categoryId === anesthesia.value.id)?.actualAmount
    : 0
  const ret = createReturnForUser(persistence, manager, orgA, {
    saleId: returnedSale.value.sale.id,
    reason: 'Возврат товара',
    items: [{ saleItemId: returnedSale.value.items[0].id, quantity: 1 }],
  })
  assert(ret.ok, 'create return')
  assert(completeReturnForUser(persistence, manager, orgA, ret.value.id).ok, 'complete return')
  const afterReturn = getEmployeeMotivationForUser(persistence, owner, employeeA.id, period)
  const actualAfter = afterReturn.ok
    ? afterReturn.value?.lines.find((line) => line.categoryId === anesthesia.value.id)?.actualAmount
    : 0
  assert((actualAfter ?? 0) < (actualBefore ?? 0), '11 return reduces actual')

  assert(
    saveEmployeeMotivationForUser(persistence, manager, employeeB.id, period, [
      { categoryId: anesthesia.value.id, planAmount: 1_000_000, bonusPercent: 5 },
    ]).ok,
    '12 separate plan B',
  )
  const planA = getEmployeeMotivationForUser(persistence, owner, employeeA.id, period)
  const planB = getEmployeeMotivationForUser(persistence, owner, employeeB.id, period)
  assert(
    planA.ok &&
      planB.ok &&
      planA.value?.lines[0].planAmount !== planB.value?.lines[0].planAmount,
    '12 distinct plans',
  )

  denied(
    getEmployeeMotivationForUser(persistence, employeeA, employeeB.id, period),
    'ACCESS_DENIED',
    '13 A cannot read B plan',
  )
  const selfA = getEmployeeMotivationForUser(persistence, employeeA, employeeA.id, period)
  assert(selfA.ok && selfA.value?.salaryAmount === 300000, '15 self salary')
  assert(selfA.value?.bonusAmount !== undefined, '14 self bonus')

  denied(
    getEmployeeMotivationForUser(persistence, manager, employeeOtherDept.id, period),
    'ACCESS_DENIED',
    '16 manager other dept',
  )
  denied(
    getEmployeeMotivationForUser(persistence, director, employeeOtherBranch.id, period),
    'ACCESS_DENIED',
    '17 director other branch',
  )
  assert(
    getEmployeeMotivationForUser(persistence, owner, employeeOtherBranch.id, period).ok,
    '18 owner org scope',
  )

  denied(
    listCompanyMotivationPlansForUser(persistence, employeeA, period),
    'ACCESS_DENIED',
    'employee cannot open company plans',
  )
  denied(
    listCompanyMotivationPlansForUser(persistence, warehouseManager, period),
    'ACCESS_DENIED',
    'warehouse manager cannot open company plans',
  )
  const foreignPlans = listCompanyMotivationPlansForUser(
    persistence,
    foreignOwner,
    period,
  )
  assert(
    foreignPlans.ok &&
      !foreignPlans.value.rows.some((row) => row.userId === employeeA.id),
    'cross-org company plans isolated',
  )

  const ownerPlans = listCompanyMotivationPlansForUser(persistence, owner, period)
  assert(ownerPlans.ok, 'owner company plans')
  assert(
    ownerPlans.value.rows.some((row) => row.userId === employeeA.id) &&
      ownerPlans.value.rows.some((row) => row.userId === employeeOtherBranch.id),
    'owner sees organization employees',
  )

  const directorPlans = listCompanyMotivationPlansForUser(persistence, director, period)
  assert(directorPlans.ok, 'director company plans')
  assert(
    directorPlans.value.rows.some((row) => row.userId === employeeOtherDept.id),
    'director sees branch dept',
  )
  assert(
    !directorPlans.value.rows.some((row) => row.userId === employeeOtherBranch.id),
    'director does not see other branch',
  )

  const managerPlans = listCompanyMotivationPlansForUser(persistence, manager, period)
  assert(managerPlans.ok && managerPlans.value.canWrite, 'manager company plans write')
  assert(
    managerPlans.value.rows.some((row) => row.userId === employeeA.id),
    'manager sees department employee',
  )
  assert(
    !managerPlans.value.rows.some((row) => row.userId === employeeOtherDept.id),
    'manager does not see other department',
  )

  const accountantPlans = listCompanyMotivationPlansForUser(
    persistence,
    accountant,
    period,
  )
  assert(accountantPlans.ok && accountantPlans.value.canWrite === false, 'accountant plans readonly')
  assert(
    accountantPlans.value.rows.some((row) => row.userId === employeeA.id),
    'accountant sees organization plans',
  )

  const accountantRead = getEmployeeMotivationForUser(persistence, accountant, employeeA.id, period)
  assert(accountantRead.ok && accountantRead.value?.salaryAmount === 300000, '19 accountant read')
  denied(
    saveEmployeeMotivationForUser(persistence, accountant, employeeA.id, period, [
      { categoryId: anesthesia.value.id, planAmount: 1, bonusPercent: 99 },
    ]),
    'ACCESS_DENIED',
    '20 accountant cannot write motivation',
  )
  denied(
    setUserSalaryForUser(persistence, accountant, employeeA.id, 1),
    'ACCESS_DENIED',
    '20 accountant cannot write salary',
  )
  denied(
    createProductCategoryForUser(persistence, accountant, {
      name: 'Acc',
      status: 'active',
    }),
    'ACCESS_DENIED',
    'accountant cannot create category',
  )
  denied(
    updateProductForUser(persistence, accountant, orgA, productA.value.id, {
      name: productA.value.name,
      sku: productA.value.sku,
      unit: productA.value.unit,
      itemType: 'service',
      basePrice: productA.value.basePrice,
      costPrice: 0,
      status: 'active',
      categoryId: composites.value.id,
    }),
    'ACCESS_DENIED',
    'accountant cannot change product category',
  )

  const customerId = addCustomer(persistence, orgA)
  const debtSale = createSaleForUser(persistence, owner, orgA, 'KZT', {
    discount: 0,
    customerId,
    warehouseId: warehouse.id,
    invoiceDueDate: '2000-01-01',
    items: [
      {
        productId: productC.value.id,
        quantity: 1,
        unitPrice: 2_500_000,
        discount: 0,
      },
    ],
  })
  assert(debtSale.ok, 'debt sale')
  assert(confirmSaleForUser(persistence, owner, orgA, debtSale.value.sale.id).ok, 'confirm debt')
  assert(completeSaleForUser(persistence, owner, orgA, debtSale.value.sale.id).ok, 'complete debt')
  const debtsBefore = listCustomerDebtsForUser(persistence, owner)
  const row = debtsBefore.ok
    ? debtsBefore.value.find((item) => item.customerId === customerId)
    : undefined
  assert(row?.remainingDebt === 2_500_000, 'debt remaining')

  const paid = createCustomerDebtPaymentForUser(persistence, owner, {
    customerId,
    amount: 500_000,
    method: 'bank_transfer',
    bankName: 'Halyk',
    accountReference: 'KZ00',
    paymentReference: 'PAY-1',
    comment: 'partial',
  })
  assert(paid.ok && paid.value.actorUserId === owner.id, '21 actor from session')
  assert(paid.value.remainingAfter === 2_000_000, '22 remaining after pay')

  const snapshot = persistence.capture()
  const journal = listCustomerDebtPaymentsForUser(persistence, owner)
  assert(journal.ok && journal.value.some((item) => item.id === paid.value.id), 'journal exists')
  snapshot.restore()
  const journalAfter = listCustomerDebtPaymentsForUser(persistence, owner)
  assert(
    journalAfter.ok && journalAfter.value.some((item) => item.id === paid.value.id),
    '23 journal survives restore',
  )

  const pastKey = '2020-01'
  persistence.employeeMotivationPeriods.create({
    id: newId(),
    organizationId: orgA,
    userId: employeeA.id,
    periodKey: pastKey,
    createdBy: owner.id,
    createdAt: now,
    updatedAt: now,
  })
  const pastPeriod = persistence.employeeMotivationPeriods
    .list(orgA)
    .find((item) => item.periodKey === pastKey && item.userId === employeeA.id)
  assert(pastPeriod, 'past period')
  persistence.employeeMotivationLines.create({
    id: newId(),
    organizationId: orgA,
    periodId: pastPeriod.id,
    categoryId: anesthesia.value.id,
    planAmount: 1,
    bonusPercent: 2,
    reducedBonusCoefficient: 0,
    fullBonusCompletionPercent: 100,
    thresholdPercent: 100,
    createdAt: now,
    updatedAt: now,
  })
  denied(
    saveEmployeeMotivationForUser(persistence, owner, employeeA.id, pastKey, [
      { categoryId: anesthesia.value.id, planAmount: 9, bonusPercent: 9 },
    ]),
    'MOTIVATION_PERIOD_LOCKED',
    '24 cannot rewrite history',
  )
  const pastLine = persistence.employeeMotivationLines
    .list(orgA)
    .find((line) => line.periodId === pastPeriod.id)
  assert(pastLine?.bonusPercent === 2, '24 historical percent kept')

  denied(
    getEmployeeMotivationForUser(persistence, foreignOwner, employeeA.id, period),
    'ACCESS_DENIED',
    '25 cross-org motivation',
  )
  const foreignList = listProductCategoriesForUser(persistence, foreignOwner)
  assert(
    !foreignList.ok ||
      !foreignList.value.some((item) => item.organizationId === orgA),
    '25 no org A categories for org B',
  )
  denied(
    createCustomerDebtPaymentForUser(persistence, foreignOwner, {
      customerId,
      amount: 1,
      method: 'cash',
    }),
    'CUSTOMER_NOT_FOUND',
    '25 cross-org debt',
  )

  const reduced = computeMotivationBonus({
    planAmount: 1_000_000,
    actualAmount: 600_000,
    bonusPercent: 1,
    reducedBonusCoefficient: 0.7,
    fullBonusCompletionPercent: 100,
  })
  assert(reduced.completionPercent === 60, 'bonus formula 60% completion')
  assert(reduced.effectiveBonusPercent === 0.7, 'bonus formula reduced 0.7%')
  assert(reduced.bonusAmount === 4_200, 'bonus formula 4200')

  const full = computeMotivationBonus({
    planAmount: 1_000_000,
    actualAmount: 1_000_000,
    bonusPercent: 1,
    reducedBonusCoefficient: 0.7,
    fullBonusCompletionPercent: 100,
  })
  assert(full.completionPercent === 100 && full.effectiveBonusPercent === 1, 'full bonus 1%')
  assert(full.bonusAmount === 10_000, 'full bonus 10000')

  const fromNinety = computeMotivationBonus({
    planAmount: 1_000_000,
    actualAmount: 900_000,
    bonusPercent: 1,
    reducedBonusCoefficient: 0.7,
    fullBonusCompletionPercent: 90,
  })
  assert(fromNinety.effectiveBonusPercent === 1, 'full bonus from 90%')
  assert(fromNinety.bonusAmount === 9_000, '900k at 1%')

  const halfCoeff = computeMotivationBonus({
    planAmount: 1_000_000,
    actualAmount: 500_000,
    bonusPercent: 2,
    reducedBonusCoefficient: 0.5,
    fullBonusCompletionPercent: 100,
  })
  assert(halfCoeff.effectiveBonusPercent === 1, '2% * 0.5 = 1%')
  assert(halfCoeff.bonusAmount === 5_000, '500k at 1%')

  const zeroPlan = computeMotivationBonus({
    planAmount: 0,
    actualAmount: 100,
    bonusPercent: 1,
    reducedBonusCoefficient: 0.7,
    fullBonusCompletionPercent: 100,
  })
  assert(zeroPlan.completionPercent === 0 && Number.isFinite(zeroPlan.bonusAmount), 'plan 0 handled')

  denied(
    saveEmployeeMotivationForUser(persistence, manager, employeeA.id, period, [
      {
        categoryId: anesthesia.value.id,
        planAmount: 1000,
        bonusPercent: 1,
        reducedBonusCoefficient: 1.2,
        fullBonusCompletionPercent: 100,
      },
    ]),
    'INVALID_INPUT',
    'coefficient above 1 rejected',
  )

  const savedCoeffA = saveEmployeeMotivationForUser(persistence, manager, employeeA.id, period, [
    {
      categoryId: anesthesia.value.id,
      planAmount: 1_000_000,
      bonusPercent: 1,
      reducedBonusCoefficient: 0.7,
      fullBonusCompletionPercent: 100,
    },
  ])
  const savedCoeffB = saveEmployeeMotivationForUser(persistence, owner, employeeB.id, period, [
    {
      categoryId: anesthesia.value.id,
      planAmount: 1_000_000,
      bonusPercent: 2,
      reducedBonusCoefficient: 0.5,
      fullBonusCompletionPercent: 90,
    },
  ])
  assert(savedCoeffA.ok && savedCoeffB.ok, 'individual bonus params saved')
  assert(
    savedCoeffA.value.lines[0].reducedBonusCoefficient === 0.7 &&
      savedCoeffB.value.lines[0].reducedBonusCoefficient === 0.5 &&
      savedCoeffA.value.lines[0].bonusPercent !== savedCoeffB.value.lines[0].bonusPercent,
    'A and B keep distinct coefficients',
  )

  denied(
    saveEmployeeMotivationForUser(persistence, employeeA, employeeA.id, period, [
      {
        categoryId: anesthesia.value.id,
        planAmount: 1,
        bonusPercent: 99,
        reducedBonusCoefficient: 1,
        fullBonusCompletionPercent: 100,
      },
    ]),
    'ACCESS_DENIED',
    'employee cannot change own bonus params',
  )

  console.log('motivation-debts.verify: ok')
}

runMotivationDebtChecks()
