import type {
  Id,
  Product,
  User,
  UserRole,
  Warehouse,
} from '../types'
import type { DomainErrorCode } from '../types/domain-error'
import { createInMemoryPersistence } from '../repositories/in-memory/create-in-memory-persistence'
import type { Persistence } from '../repositories/persistence'
import { completeReturnForUser } from './complete-return'
import { completeSaleForUser } from './complete-sale'
import { createPaymentForUser } from './create-payment'
import { createPaymentRefundForUser } from './create-payment-refund'
import {
  buildSaleFinancialView,
  toRefundFinancialView,
  toSaleFinancialView,
} from './financial-access'
import { setStock } from './inventory'
import { cancelPaymentForUser } from './payments'
import { newId, nowIso } from './primitives'
import { seedEnabledBusinessModules } from './organization-modules'
import {
  confirmSaleForUser,
  createSaleForUser,
  getSaleForUser,
  listSalesForAnalytics,
  listSalesForUser,
} from './sales'
import { createReturnForUser } from './sale-returns'
import {
  removeUserPermissionOverrideForUser,
  setUserPermissionOverrideForUser,
} from './users'

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

function addUser(
  persistence: Persistence,
  organizationId: Id,
  role: UserRole,
  branchId?: Id,
  warehouseId?: Id,
): User {
  const now = nowIso()
  const user: User = {
    id: newId(),
    organizationId,
    email: `${role}@${organizationId}.local`,
    firstName: role,
    lastName: organizationId,
    role,
    status: 'active',
    branchId,
    warehouseId,
    createdAt: now,
    updatedAt: now,
  }
  persistence.users.create(user)
  return user
}

function addWarehouse(
  persistence: Persistence,
  organizationId: Id,
  branchId: Id,
  name: string,
): Warehouse {
  const now = nowIso()
  const warehouse: Warehouse = {
    id: newId(),
    organizationId,
    branchId,
    name,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  }
  persistence.warehouses.create(warehouse)
  return warehouse
}

function saleDraft(warehouseId: Id, productId: Id, quantity = 1) {
  return {
    warehouseId,
    discount: 0,
    items: [
      {
        productId,
        quantity,
        unitPrice: 100,
        discount: 0,
      },
    ],
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

function seedWorld() {
  const persistence = createInMemoryPersistence()
  const now = nowIso()
  const orgA = 'org-a'
  const orgB = 'org-b'
  addOrg(persistence, orgA, 'Org A')
  addOrg(persistence, orgB, 'Org B')
  seedEnabledBusinessModules(persistence, orgA, 'seed')
  seedEnabledBusinessModules(persistence, orgB, 'seed')
  const branchA = newId()
  const branchB = newId()
  const branchXB = newId()

  persistence.branches.create({
    id: branchA,
    organizationId: orgA,
    name: 'Branch A',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  })
  persistence.branches.create({
    id: branchB,
    organizationId: orgA,
    name: 'Branch B',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  })
  persistence.branches.create({
    id: branchXB,
    organizationId: orgB,
    name: 'Branch XB',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  })

  const a1 = addWarehouse(persistence, orgA, branchA, 'A1')
  const b1 = addWarehouse(persistence, orgA, branchB, 'B1')
  const xb1 = addWarehouse(persistence, orgB, branchXB, 'XB1')

  const product: Product = {
    id: newId(),
    organizationId: orgA,
    name: 'SKU-A',
    sku: 'SKU-A',
    unit: 'pcs',
    itemType: 'product',
    basePrice: 0,
    costPrice: 0,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  }
  persistence.products.create(product)
  const productB: Product = {
    id: newId(),
    organizationId: orgB,
    name: 'SKU-B',
    sku: 'SKU-B',
    unit: 'pcs',
    itemType: 'product',
    basePrice: 0,
    costPrice: 0,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  }
  persistence.products.create(productB)

  assert(setStock(persistence, orgA, a1.id, product.id, 50).ok, 'stock A1')
  assert(setStock(persistence, orgA, b1.id, product.id, 50).ok, 'stock B1')
  assert(setStock(persistence, orgB, xb1.id, productB.id, 50).ok, 'stock XB1')

  return {
    persistence,
    orgA,
    orgB,
    a1,
    b1,
    xb1,
    product,
    productB,
    employee: addUser(persistence, orgA, 'sales_employee', branchA, a1.id),
    manager: addUser(persistence, orgA, 'sales_manager', branchA, a1.id),
    director: addUser(persistence, orgA, 'branch_director', branchA, a1.id),
    commercial: addUser(persistence, orgA, 'commercial_director', undefined, a1.id),
    owner: addUser(persistence, orgA, 'owner', undefined, a1.id),
    foreignOwner: addUser(persistence, orgB, 'owner'),
  }
}

export function runFinancialRbacChecks(): void {
  const world = seedWorld()
  const {
    persistence,
    orgA,
    a1,
    b1,
    xb1,
    product,
    productB,
    employee,
    manager,
    director,
    commercial,
    owner,
    foreignOwner,
  } = world

  const created = createSaleForUser(
    persistence,
    employee,
    orgA,
    'KZT',
    saleDraft(a1.id, product.id),
  )
  assert(created.ok, '1 employee create sale')

  denied(
    createSaleForUser(
      persistence,
      employee,
      orgA,
      'KZT',
      saleDraft(b1.id, product.id),
    ),
    'ACCESS_DENIED',
    '13 employee foreign warehouse create',
  )

  assert(
    confirmSaleForUser(persistence, employee, orgA, created.value.sale.id).ok,
    'confirm employee sale',
  )
  assert(
    completeSaleForUser(persistence, employee, orgA, created.value.sale.id).ok,
    '2 employee complete sale',
  )

  const payment = createPaymentForUser(persistence, employee, {
    organizationId: orgA,
    createdBy: employee.id,
    saleId: created.value.sale.id,
    amount: 40,
    method: 'cash',
  })
  assert(payment.ok, '3 employee payment create')

  const paymentCount = persistence.payments.list(orgA).length
  denied(
    createPaymentRefundForUser(persistence, employee, {
      organizationId: orgA,
      createdBy: employee.id,
      paymentId: payment.value.id,
      amount: 10,
    }),
    'ACCESS_DENIED',
    '4 employee refund denied',
  )
  assert(
    persistence.payments.list(orgA).length === paymentCount,
    '4 refund denial does not mutate payments',
  )

  const managerSale = createSaleForUser(
    persistence,
    manager,
    orgA,
    'KZT',
    saleDraft(a1.id, product.id),
  )
  assert(managerSale.ok, 'manager sale')
  assert(
    confirmSaleForUser(persistence, manager, orgA, managerSale.value.sale.id)
      .ok,
    'manager confirm',
  )
  assert(
    completeSaleForUser(persistence, manager, orgA, managerSale.value.sale.id)
      .ok,
    'manager complete',
  )
  const createdReturn = createReturnForUser(persistence, manager, orgA, {
    saleId: managerSale.value.sale.id,
    reason: 'Возврат товара',
    items: [
      {
        saleItemId: managerSale.value.items[0].id,
        quantity: 1,
      },
    ],
  })
  assert(createdReturn.ok, '5 manager return create')
  assert(
    completeReturnForUser(persistence, manager, orgA, createdReturn.value.id)
      .ok,
    '6 manager return complete',
  )

  const managerPayment = createPaymentForUser(persistence, manager, {
    organizationId: orgA,
    createdBy: manager.id,
    saleId: managerSale.value.sale.id,
    amount: 10,
    method: 'cash',
  })
  assert(managerPayment.ok, 'manager payment')
  denied(
    createPaymentRefundForUser(persistence, manager, {
      organizationId: orgA,
      createdBy: manager.id,
      paymentId: managerPayment.value.id,
      amount: 5,
    }),
    'ACCESS_DENIED',
    '8 manager refund create denied',
  )

  const directorSale = createSaleForUser(
    persistence,
    director,
    orgA,
    'KZT',
    saleDraft(a1.id, product.id),
  )
  assert(directorSale.ok, 'director sale')
  assert(
    confirmSaleForUser(persistence, director, orgA, directorSale.value.sale.id)
      .ok,
    'director confirm',
  )
  assert(
    completeSaleForUser(persistence, director, orgA, directorSale.value.sale.id)
      .ok,
    'director complete',
  )
  const directorPayment = createPaymentForUser(persistence, director, {
    organizationId: orgA,
    createdBy: director.id,
    saleId: directorSale.value.sale.id,
    amount: 20,
    method: 'cash',
  })
  assert(directorPayment.ok, 'director payment')
  assert(
    cancelPaymentForUser(
      persistence,
      director,
      orgA,
      directorPayment.value.id,
    ).ok,
    '9 director payment cancel',
  )

  const directorPay2 = createPaymentForUser(persistence, director, {
    organizationId: orgA,
    createdBy: director.id,
    saleId: directorSale.value.sale.id,
    amount: 15,
    method: 'card',
  })
  assert(directorPay2.ok, 'director payment 2')
  const directorRefund = createPaymentRefundForUser(persistence, director, {
    organizationId: orgA,
    createdBy: director.id,
    paymentId: directorPay2.value.id,
    amount: 5,
  })
  assert(directorRefund.ok, '10 director refund create')
  assert(
    toRefundFinancialView(persistence, manager, directorRefund.value).ok,
    '7 manager refund read',
  )

  const commercialSale = createSaleForUser(
    persistence,
    commercial,
    orgA,
    'KZT',
    saleDraft(b1.id, product.id),
  )
  assert(commercialSale.ok, '11 commercial sale B1')
  assert(
    confirmSaleForUser(
      persistence,
      commercial,
      orgA,
      commercialSale.value.sale.id,
    ).ok,
    '11 commercial confirm',
  )
  assert(
    completeSaleForUser(
      persistence,
      commercial,
      orgA,
      commercialSale.value.sale.id,
    ).ok,
    '11 commercial complete',
  )
  const commercialPayment = createPaymentForUser(persistence, commercial, {
    organizationId: orgA,
    createdBy: commercial.id,
    saleId: commercialSale.value.sale.id,
    amount: 30,
    method: 'cash',
  })
  assert(commercialPayment.ok, '11 commercial payment')
  assert(
    createPaymentRefundForUser(persistence, commercial, {
      organizationId: orgA,
      createdBy: commercial.id,
      paymentId: commercialPayment.value.id,
      amount: 5,
    }).ok,
    '11 commercial refund',
  )

  const ownerSale = createSaleForUser(
    persistence,
    owner,
    orgA,
    'KZT',
    saleDraft(b1.id, product.id),
  )
  assert(ownerSale.ok, '12 owner sale')
  const ownerListed = listSalesForUser(persistence, owner)
  assert(ownerListed.ok && ownerListed.value.length > 0, '12 owner list sales')

  denied(
    getSaleForUser(persistence, employee, commercialSale.value.sale.id),
    'ACCESS_DENIED',
    '13 employee get foreign warehouse sale',
  )
  denied(
    createPaymentForUser(persistence, employee, {
      organizationId: orgA,
      createdBy: employee.id,
      saleId: commercialSale.value.sale.id,
      amount: 1,
      method: 'cash',
    }),
    'ACCESS_DENIED',
    '19 payment → sale → warehouse',
  )
  denied(
    createPaymentRefundForUser(persistence, employee, {
      organizationId: orgA,
      createdBy: employee.id,
      paymentId: commercialPayment.value.id,
      amount: 1,
    }),
    'ACCESS_DENIED',
    '20 refund → payment → sale → warehouse',
  )
  denied(
    createReturnForUser(persistence, employee, orgA, {
      saleId: commercialSale.value.sale.id,
      reason: 'Возврат товара',
      items: [
        {
          saleItemId: commercialSale.value.items[0].id,
          quantity: 1,
        },
      ],
    }),
    'ACCESS_DENIED',
    '21 return → sale → warehouse',
  )

  denied(
    createSaleForUser(
      persistence,
      employee,
      orgA,
      'KZT',
      saleDraft(xb1.id, productB.id),
    ),
    'ACCESS_DENIED',
    '14 foreign organization',
  )
  denied(
    createSaleForUser(
      persistence,
      foreignOwner,
      orgA,
      'KZT',
      saleDraft(a1.id, product.id),
    ),
    'ACCESS_DENIED',
    '14 foreign owner into org A',
  )

  const masked = buildSaleFinancialView({
    sale: created.value.sale,
    canRead: true,
    canReadAmount: false,
    paidAmount: 40,
    outstandingAmount: 60,
  })
  assert(
    masked.total === undefined && masked.paidAmount === undefined,
    '15 amount masking projection',
  )
  const employeeView = toSaleFinancialView(
    persistence,
    employee,
    created.value.sale,
  )
  assert(
    employeeView.ok && employeeView.value.canReadAmount === true,
    '15 employee has read_amount',
  )

  const employeeAnalytics = listSalesForAnalytics(persistence, employee)
  assert(
    employeeAnalytics.ok && employeeAnalytics.value.length === 0,
    '16 employee analytics empty',
  )
  const managerAnalytics = listSalesForAnalytics(persistence, manager)
  assert(
    managerAnalytics.ok &&
      managerAnalytics.value.every((sale) => sale.warehouseId === a1.id),
    '16 manager analytics branch',
  )
  const commercialAnalytics = listSalesForAnalytics(persistence, commercial)
  assert(
    commercialAnalytics.ok &&
      commercialAnalytics.value.some((sale) => sale.warehouseId === b1.id),
    '16 commercial analytics org',
  )

  denied(
    createSaleForUser(
      persistence,
      null,
      orgA,
      'KZT',
      saleDraft(a1.id, product.id),
    ),
    'CURRENT_USER_REQUIRED',
    '17 no currentUser',
  )
  denied(
    getSaleForUser(persistence, undefined, created.value.sale.id),
    'CURRENT_USER_REQUIRED',
    '17 no currentUser get',
  )

  const listed = listSalesForUser(persistence, employee)
  assert(listed.ok, '18 direct listSalesForUser')
  assert(
    listed.value.every((sale) => sale.warehouseId === a1.id),
    '18 employee list only A1',
  )
  assert(
    getSaleForUser(persistence, employee, created.value.sale.id).ok,
    'v2 employee own sale',
  )
  assert(
    getSaleForUser(persistence, employee, managerSale.value.sale.id).ok,
    'v2 employee coworker branch sale',
  )
  assert(
    listed.value.some((sale) => sale.id === managerSale.value.sale.id),
    'v2 employee list includes coworker branch sale',
  )

  const serviceProduct: Product = {
    id: newId(),
    organizationId: orgA,
    name: 'SVC-A',
    sku: 'SVC-A',
    unit: 'pcs',
    itemType: 'service',
    basePrice: 100,
    costPrice: 0,
    status: 'active',
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }
  persistence.products.create(serviceProduct)
  const serviceSale = createSaleForUser(persistence, owner, orgA, 'KZT', {
    discount: 0,
    items: [
      {
        productId: serviceProduct.id,
        quantity: 1,
        unitPrice: 100,
        discount: 0,
      },
    ],
  })
  assert(
    serviceSale.ok && !serviceSale.value.sale.warehouseId,
    '18b owner warehouse-less service sale',
  )
  assert(
    createPaymentForUser(persistence, owner, {
      organizationId: orgA,
      createdBy: owner.id,
      saleId: serviceSale.value.sale.id,
      amount: 100,
      method: 'cash',
    }).ok,
    '18b pay warehouse-less service',
  )
  denied(
    getSaleForUser(persistence, employee, serviceSale.value.sale.id),
    'ACCESS_DENIED',
    '18b employee get warehouse-less foreign service',
  )
  denied(
    getSaleForUser(persistence, director, serviceSale.value.sale.id),
    'ACCESS_DENIED',
    '18b director get owner warehouse-less service',
  )
  assert(
    getSaleForUser(persistence, owner, serviceSale.value.sale.id).ok,
    '18b owner get warehouse-less service',
  )
  const listedAfterService = listSalesForUser(persistence, employee)
  assert(
    listedAfterService.ok &&
      listedAfterService.value.every((sale) => sale.id !== serviceSale.value.sale.id),
    '18b employee list excludes foreign warehouse-less service',
  )

  const rollbackSale = createSaleForUser(
    persistence,
    owner,
    orgA,
    'KZT',
    saleDraft(a1.id, product.id, 1),
  )
  assert(rollbackSale.ok, 'rollback sale')
  assert(
    confirmSaleForUser(persistence, owner, orgA, rollbackSale.value.sale.id)
      .ok,
    'rollback confirm',
  )
  assert(
    setStock(persistence, orgA, a1.id, product.id, 0).ok,
    'rollback drain stock',
  )
  const completeFail = completeSaleForUser(
    persistence,
    owner,
    orgA,
    rollbackSale.value.sale.id,
  )
  assert(!completeFail.ok, 'rollback complete fails')
  assert(
    persistence.sales.getById(rollbackSale.value.sale.id)?.status ===
      'confirmed',
    'rollback sale status unchanged',
  )

  const dueFail = createPaymentForUser(persistence, owner, {
    organizationId: orgA,
    createdBy: owner.id,
    saleId: created.value.sale.id,
    amount: 10_000,
    method: 'cash',
  })
  assert(!dueFail.ok, 'rollback payment validation')
  assert(
    persistence.payments.getById(payment.value.id)?.status === 'completed',
    'rollback original payment intact',
  )

  denied(
    createReturnForUser(persistence, employee, orgA, {
      saleId: created.value.sale.id,
      reason: 'Возврат товара',
      items: [{ saleItemId: created.value.items[0].id, quantity: 1 }],
    }),
    'ACCESS_DENIED',
    'v2 employee return denied by default',
  )
  denied(
    setUserPermissionOverrideForUser(
      persistence,
      manager,
      orgA,
      employee.id,
      'financial',
      'financial_documents.manage',
      'allow',
    ),
    'ACCESS_DENIED',
    'v2 manager cannot delegate permission they lack',
  )
  denied(
    setUserPermissionOverrideForUser(
      persistence,
      manager,
      orgA,
      employee.id,
      'financial',
      'returns.create',
      'allow',
    ),
    'ACCESS_DENIED',
    'v2 manager cannot grant permission',
  )
  denied(
    setUserPermissionOverrideForUser(
      persistence,
      employee,
      orgA,
      employee.id,
      'financial',
      'returns.create',
      'allow',
    ),
    'ACCESS_DENIED',
    'v2 self override denied',
  )
  assert(
    setUserPermissionOverrideForUser(
      persistence,
      director,
      orgA,
      employee.id,
      'financial',
      'returns.create',
      'allow',
      'Разрешён возврат товара.',
    ).ok,
    'v2 director grants returns.create',
  )
  const employeeWithReturn = persistence.users.getById(employee.id)
  assert(employeeWithReturn, 'v2 employee reloaded')
  assert(
    createReturnForUser(persistence, employeeWithReturn, orgA, {
      saleId: created.value.sale.id,
      reason: 'Возврат товара',
      items: [{ saleItemId: created.value.items[0].id, quantity: 1 }],
    }).ok,
    'v2 employee return after override',
  )
  assert(
    removeUserPermissionOverrideForUser(
      persistence,
      director,
      orgA,
      employee.id,
      'financial',
      'returns.create',
    ).ok,
    'v2 director removes returns.create',
  )
  assert(
    setStock(persistence, orgA, a1.id, product.id, 5).ok,
    'v2 restock for later sale',
  )
  const laterSale = createSaleForUser(
    persistence,
    employee,
    orgA,
    'KZT',
    saleDraft(a1.id, product.id),
  )
  assert(laterSale.ok, 'v2 later employee sale')
  assert(
    confirmSaleForUser(persistence, employee, orgA, laterSale.value.sale.id).ok,
    'v2 later confirm',
  )
  assert(
    completeSaleForUser(persistence, employee, orgA, laterSale.value.sale.id).ok,
    'v2 later complete',
  )
  const employeeWithoutReturn = persistence.users.getById(employee.id)
  assert(employeeWithoutReturn, 'v2 employee reloaded after revoke')
  denied(
    createReturnForUser(persistence, employeeWithoutReturn, orgA, {
      saleId: laterSale.value.sale.id,
      reason: 'Возврат товара',
      items: [{ saleItemId: laterSale.value.items[0].id, quantity: 1 }],
    }),
    'ACCESS_DENIED',
    'v2 employee return denied after override removed',
  )
}

runFinancialRbacChecks()
