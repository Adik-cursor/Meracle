import type { Id, Product, User, UserRole, Warehouse } from '../types'
import type { DomainErrorCode, ServiceResult } from '../types/domain-error'
import { hasFinancialPermission } from '../types/financial-permission'
import { createInMemoryPersistence } from '../repositories/in-memory/create-in-memory-persistence'
import type { Persistence } from '../repositories/persistence'
import { translate, type TranslationKey } from '../localization/translations'
import { checkoutSaleForUser } from './checkout-sale'
import { completeSaleForUser } from './complete-sale'
import {
  canCreateReturn,
  canCreateSale as canCreateSaleFinancial,
} from './financial-access'
import { listAccessibleInventoryForUser, setStock } from './inventory'
import { newId, nowIso } from './primitives'
import { seedEnabledBusinessModules } from './organization-modules'
import {
  confirmSaleForUser,
  createSaleForUser,
} from './sales'
import { createUser, listUsersForUser } from './users'
import {
  getWarehouseForUser,
  listWarehousesForUser,
} from './warehouses'

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
  departmentId?: Id,
): User {
  const now = nowIso()
  const user: User = {
    id: newId(),
    organizationId,
    email: `${role}-${newId()}@${organizationId}.local`,
    firstName: role,
    lastName: organizationId,
    role,
    status: 'active',
    branchId,
    departmentId,
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

function saleDraft(warehouseId: Id, productId: Id, itemWarehouseId?: Id) {
  return {
    warehouseId,
    discount: 0,
    items: [
      {
        productId,
        quantity: 1,
        unitPrice: 10,
        discount: 0,
        warehouseId: itemWarehouseId,
      },
    ],
  }
}

function warehouseIds(result: ServiceResult<Warehouse[]>): Set<Id> {
  assert(result.ok, 'warehouse list ok')
  return new Set(result.value.map((warehouse) => warehouse.id))
}

function seedWorld() {
  const persistence = createInMemoryPersistence()
  const now = nowIso()
  const orgA = newId()
  const orgB = newId()
  seedEnabledBusinessModules(persistence, orgA, 'seed')
  seedEnabledBusinessModules(persistence, orgB, 'seed')
  const branchA = newId()
  const branchB = newId()
  const branchXB = newId()
  const departmentA = newId()

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
  persistence.departments.create({
    id: departmentA,
    organizationId: orgA,
    branchId: branchA,
    name: 'Sales A',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  })

  const a1 = addWarehouse(persistence, orgA, branchA, 'A1')
  const a2 = addWarehouse(persistence, orgA, branchA, 'A2')
  const b1 = addWarehouse(persistence, orgA, branchB, 'B1')
  const xb1 = addWarehouse(persistence, orgB, branchXB, 'XB1')

  const product: Product = {
    id: newId(),
    organizationId: orgA,
    name: 'Product X',
    sku: 'PX',
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
    name: 'Product XB',
    sku: 'PXB',
    unit: 'pcs',
    itemType: 'product',
    basePrice: 0,
    costPrice: 0,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  }
  persistence.products.create(productB)

  assert(setStock(persistence, orgA, a1.id, product.id, 0).ok, 'stock A1 zero')
  assert(setStock(persistence, orgA, a2.id, product.id, 20).ok, 'stock A2')
  assert(setStock(persistence, orgA, b1.id, product.id, 20).ok, 'stock B1')
  assert(setStock(persistence, orgB, xb1.id, productB.id, 20).ok, 'stock XB1')

  const employee = addUser(
    persistence,
    orgA,
    'sales_employee',
    branchA,
    a1.id,
    departmentA,
  )
  const employeeWithoutWarehouse = addUser(
    persistence,
    orgA,
    'sales_employee',
    branchA,
    undefined,
    departmentA,
  )

  const manager = addUser(
    persistence,
    orgA,
    'sales_manager',
    branchA,
    a1.id,
    departmentA,
  )
  const director = addUser(
    persistence,
    orgA,
    'branch_director',
    branchA,
    a1.id,
  )
  const commercial = addUser(
    persistence,
    orgA,
    'commercial_director',
    undefined,
    a1.id,
  )
  const owner = addUser(persistence, orgA, 'owner', undefined, a1.id)
  const foreignOwner = addUser(persistence, orgB, 'owner')

  return {
    persistence,
    orgA,
    a1,
    a2,
    b1,
    xb1,
    product,
    productB,
    departmentA,
    branchA,
    employee,
    employeeWithoutWarehouse,
    manager,
    director,
    commercial,
    owner,
    foreignOwner,
  }
}

export function runWarehouseAssignmentChecks(): void {
  const world = seedWorld()
  const {
    persistence,
    orgA,
    a1,
    a2,
    b1,
    xb1,
    product,
    productB,
    departmentA,
    branchA,
    employee,
    employeeWithoutWarehouse,
    manager,
    director,
    commercial,
    owner,
    foreignOwner,
  } = world

  assert(Boolean(employee.warehouseId), '1 sales_employee has warehouseId')

  denied(
    getWarehouseForUser(persistence, employeeWithoutWarehouse, a1.id),
    'USER_WAREHOUSE_REQUIRED',
    '2 employee without warehouseId',
  )
  denied(
    createSaleForUser(
      persistence,
      employeeWithoutWarehouse,
      orgA,
      'KZT',
      saleDraft(a1.id, product.id),
    ),
    'USER_WAREHOUSE_REQUIRED',
    '2 employee sale without warehouseId',
  )
  denied(
    createUser(persistence, orgA, {
      firstName: 'No',
      lastName: 'Warehouse',
      email: 'demo-user-038@example.com',
      role: 'sales_employee',
      status: 'active',
      branchId: branchA,
      departmentId: departmentA,
    }),
    'USER_WAREHOUSE_REQUIRED',
    '2 create employee without warehouse',
  )

  const employeeWarehouses = warehouseIds(
    listWarehousesForUser(persistence, employee),
  )
  assert(
    employeeWarehouses.has(a1.id) &&
      !employeeWarehouses.has(a2.id) &&
      !employeeWarehouses.has(b1.id),
    '3 employee sees only assigned warehouse',
  )

  denied(
    createSaleForUser(
      persistence,
      employee,
      orgA,
      'KZT',
      saleDraft(a2.id, product.id),
    ),
    'ACCESS_DENIED',
    '4 employee cannot choose other warehouse',
  )

  denied(
    createSaleForUser(
      persistence,
      employee,
      orgA,
      'KZT',
      saleDraft(a2.id, product.id),
    ),
    'ACCESS_DENIED',
    '5 employee cannot sell from other warehouse',
  )

  const employeeInventory = listAccessibleInventoryForUser(persistence, employee)
  assert(employeeInventory.ok, '6 employee inventory ok')
  assert(
    employeeInventory.value.every((item) => item.warehouseId === a1.id),
    '6 employee inventory assigned warehouse only',
  )
  const a1Stock = employeeInventory.value.find(
    (item) => item.productId === product.id,
  )
  assert(a1Stock?.quantity === 0, '6 product X is 0 on assigned warehouse')

  const managerWarehouses = warehouseIds(
    listWarehousesForUser(persistence, manager),
  )
  assert(
    manager.warehouseId === a1.id &&
      managerWarehouses.has(a1.id) &&
      managerWarehouses.has(a2.id) &&
      !managerWarehouses.has(b1.id),
    '7-8 manager not limited by warehouseId, sees branch zone',
  )

  const managerSale = createSaleForUser(
    persistence,
    manager,
    orgA,
    'KZT',
    saleDraft(a2.id, product.id),
  )
  assert(managerSale.ok, '9 manager sale on accessible warehouse A2')
  assert(
    managerSale.value.sale.warehouseId === a2.id,
    '16 Sale.warehouseId is allowed warehouse',
  )
  assert(
    managerSale.value.items.every(
      (item) => item.warehouseId === managerSale.value.sale.warehouseId,
    ),
    '17 SaleItem.warehouseId matches Sale',
  )

  denied(
    createSaleForUser(
      persistence,
      manager,
      orgA,
      'KZT',
      saleDraft(b1.id, product.id),
    ),
    'WAREHOUSE_BRANCH_MISMATCH',
    '10 manager cannot sell from foreign branch',
  )

  const directorWarehouses = warehouseIds(
    listWarehousesForUser(persistence, director),
  )
  assert(
    director.warehouseId === a1.id &&
      directorWarehouses.has(a1.id) &&
      directorWarehouses.has(a2.id) &&
      !directorWarehouses.has(b1.id),
    '11-12 branch_director sees own branch only',
  )

  const commercialWarehouses = warehouseIds(
    listWarehousesForUser(persistence, commercial),
  )
  const ownerWarehouses = warehouseIds(listWarehousesForUser(persistence, owner))
  assert(
    commercialWarehouses.has(a1.id) &&
      commercialWarehouses.has(a2.id) &&
      commercialWarehouses.has(b1.id) &&
      !commercialWarehouses.has(xb1.id),
    '13 commercial_director organization warehouses',
  )
  assert(
    ownerWarehouses.has(a1.id) &&
      ownerWarehouses.has(a2.id) &&
      ownerWarehouses.has(b1.id) &&
      !ownerWarehouses.has(xb1.id),
    '14 owner organization warehouses',
  )

  denied(
    getWarehouseForUser(persistence, employee, xb1.id),
    'WAREHOUSE_ORGANIZATION_MISMATCH',
    '15 employee cross-organization warehouse',
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
    '15 employee sale cross-organization',
  )

  denied(
    createSaleForUser(persistence, manager, orgA, 'KZT', {
      warehouseId: a2.id,
      discount: 0,
      items: [
        {
          productId: product.id,
          quantity: 1,
          unitPrice: 10,
          discount: 0,
          warehouseId: b1.id,
        },
      ],
    }),
    'ACCESS_DENIED',
    '17 SaleItem warehouse mismatch',
  )

  const beforeA2 =
    persistence.inventory.getByWarehouseAndProduct(orgA, a2.id, product.id)
      ?.quantity ?? 0
  assert(
    confirmSaleForUser(persistence, manager, orgA, managerSale.value.sale.id)
      .ok,
    '18 confirm manager sale',
  )
  assert(
    completeSaleForUser(persistence, manager, orgA, managerSale.value.sale.id)
      .ok,
    '18 completeSale on allowed warehouse',
  )
  const afterA2 =
    persistence.inventory.getByWarehouseAndProduct(orgA, a2.id, product.id)
      ?.quantity ?? 0
  const afterA1 =
    persistence.inventory.getByWarehouseAndProduct(orgA, a1.id, product.id)
      ?.quantity ?? 0
  assert(afterA2 === beforeA2 - 1, '18 stock deducted from A2')
  assert(afterA1 === 0, '18 assigned warehouse stock unchanged')

  const saleCount = persistence.sales.list(orgA).length
  denied(
    createSaleForUser(
      persistence,
      employee,
      orgA,
      'KZT',
      saleDraft(b1.id, product.id),
    ),
    'ACCESS_DENIED',
    '19 employee cannot pass arbitrary warehouseId',
  )
  assert(
    persistence.sales.list(orgA).length === saleCount,
    '19 rejected sale is not persisted',
  )

  assert(
    hasFinancialPermission(employee.role, 'sales.complete'),
    '20 employee has sales.complete',
  )
  assert(
    canCreateSaleFinancial(persistence, employee, a1).ok,
    '20 warehouse + financial allow assigned warehouse',
  )
  denied(
    canCreateSaleFinancial(persistence, employee, a2),
    'ACCESS_DENIED',
    '20 warehouse deny wins over financial permission',
  )
  assert(setStock(persistence, orgA, a1.id, product.id, 5).ok, '20 stock for financial')
  const employeeSale = createSaleForUser(
    persistence,
    employee,
    orgA,
    'KZT',
    saleDraft(a1.id, product.id),
  )
  assert(employeeSale.ok, '20 employee sale on assigned warehouse')
  denied(
    canCreateReturn(persistence, employee, employeeSale.value.sale),
    'ACCESS_DENIED',
    '20 financial permission still required',
  )

  denied(
    listWarehousesForUser(persistence, null),
    'CURRENT_USER_REQUIRED',
    '21 no currentUser',
  )
  denied(
    createSaleForUser(persistence, null, orgA, 'KZT', saleDraft(a1.id, product.id)),
    'CURRENT_USER_REQUIRED',
    '21 no currentUser sale',
  )

  const localeKeys: TranslationKey[] = [
    'USER_WAREHOUSE_REQUIRED',
    'WAREHOUSE_ORGANIZATION_MISMATCH',
    'WAREHOUSE_BRANCH_MISMATCH',
    'ACCESS_DENIED',
    'CURRENT_USER_REQUIRED',
    'WAREHOUSE_NOT_FOUND',
    'posPay',
    'posSaleCompleted',
  ]
  for (const key of localeKeys) {
    const ru = translate('ru', key)
    const kk = translate('kk', key)
    const ruAgain = translate('ru', key)
    assert(Boolean(ru) && Boolean(kk), `22 ${key} ru/kk`)
    assert(ruAgain === ru, `22 ${key} RU → KZ → RU`)
    assert(ru !== kk, `22 ${key} locales differ`)
  }

  const listedByEmployee = listUsersForUser(persistence, employee)
  assert(
    listedByEmployee.ok &&
      listedByEmployee.value.length === 1 &&
      listedByEmployee.value[0].id === employee.id,
    'users scope: employee self only',
  )
  const listedByOwner = listUsersForUser(persistence, owner)
  assert(
    listedByOwner.ok && listedByOwner.value.length > 1,
    'users scope: owner organization',
  )

  denied(
    createSaleForUser(persistence, foreignOwner, orgA, 'KZT', saleDraft(a1.id, product.id)),
    'ACCESS_DENIED',
    'foreign owner into org A',
  )

  const productY: Product = {
    id: newId(),
    organizationId: orgA,
    name: 'Product Y',
    sku: 'PY',
    unit: 'pcs',
    itemType: 'product',
    basePrice: 0,
    costPrice: 0,
    status: 'active',
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }
  persistence.products.create(productY)
  assert(setStock(persistence, orgA, a2.id, productY.id, 1).ok, 'stock Y A2')

  const atomicSale = createSaleForUser(persistence, manager, orgA, 'KZT', {
    warehouseId: a2.id,
    discount: 0,
    items: [
      {
        productId: product.id,
        quantity: 3,
        unitPrice: 10,
        discount: 0,
      },
      {
        productId: productY.id,
        quantity: 1,
        unitPrice: 10,
        discount: 0,
      },
    ],
  })
  assert(atomicSale.ok, 'atomic sale draft')
  const stockYBefore =
    persistence.inventory.getByWarehouseAndProduct(orgA, a2.id, productY.id)
      ?.quantity ?? 0
  const stockXBefore =
    persistence.inventory.getByWarehouseAndProduct(orgA, a2.id, product.id)
      ?.quantity ?? 0
  assert(stockYBefore === 1, '13 draft does not deduct Y')
  assert(setStock(persistence, orgA, a2.id, productY.id, 0).ok, 'drop Y stock')
  const paymentsBefore = persistence.payments.list(orgA).length
  denied(
    checkoutSaleForUser(
      persistence,
      manager,
      orgA,
      atomicSale.value.sale.id,
      { amount: 50, method: 'cash' },
    ),
    'INSUFFICIENT_STOCK',
    '20 atomic checkout rolls back',
  )
  assert(
    persistence.sales.getById(atomicSale.value.sale.id)?.status === 'draft',
    '20 sale stays draft after failed checkout',
  )
  assert(
    (persistence.inventory.getByWarehouseAndProduct(orgA, a2.id, productY.id)
      ?.quantity ?? 0) === 0,
    '20 product Y not deducted by failed checkout',
  )
  assert(
    (persistence.inventory.getByWarehouseAndProduct(orgA, a2.id, product.id)
      ?.quantity ?? 0) === stockXBefore,
    '20 product X not deducted',
  )
  assert(
    persistence.payments.list(orgA).length === paymentsBefore,
    '20 payment not kept',
  )

  const paidSale = createSaleForUser(
    persistence,
    manager,
    orgA,
    'KZT',
    saleDraft(a2.id, product.id),
  )
  assert(paidSale.ok, 'checkout sale')
  const stockBeforePay =
    persistence.inventory.getByWarehouseAndProduct(orgA, a2.id, product.id)
      ?.quantity ?? 0
  const checkout = checkoutSaleForUser(
    persistence,
    manager,
    orgA,
    paidSale.value.sale.id,
    { amount: 15, method: 'cash' },
  )
  assert(checkout.ok && checkout.value.change === 5, 'checkout pays due and change')
  assert(
    persistence.sales.getById(paidSale.value.sale.id)?.status === 'completed',
    'checkout completes sale',
  )
  assert(
    (persistence.inventory.getByWarehouseAndProduct(orgA, a2.id, product.id)
      ?.quantity ?? 0) === stockBeforePay - 1,
    'checkout deducts inventory',
  )
  const movements = persistence.stockMovements.list(orgA)
  assert(
    movements.some(
      (movement) =>
        movement.warehouseId === a2.id &&
        movement.productId === product.id &&
        movement.type === 'shipment' &&
        movement.note === paidSale.value.sale.id,
    ),
    'checkout creates stock movement',
  )
  const afterSecond =
    persistence.inventory.getByWarehouseAndProduct(orgA, a2.id, product.id)
      ?.quantity ?? 0
  denied(
    completeSaleForUser(
      persistence,
      manager,
      orgA,
      paidSale.value.sale.id,
    ),
    'INSUFFICIENT_STOCK',
    'repeat complete does not deduct again',
  )
  assert(
    (persistence.inventory.getByWarehouseAndProduct(orgA, a2.id, product.id)
      ?.quantity ?? 0) === afterSecond,
    'repeat complete stock unchanged',
  )
}
