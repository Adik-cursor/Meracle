import type { Id, User, UserRole } from '../types'
import type { DomainErrorCode } from '../types/domain-error'
import { createInMemoryPersistence } from '../repositories/in-memory/create-in-memory-persistence'
import type { Persistence } from '../repositories/persistence'
import { setStock, setStockForUser } from './inventory'
import { seedEnabledBusinessModules } from './organization-modules'
import { newId, nowIso } from './primitives'
import {
  createProductCategoryForUser,
  updateProductCategoryForUser,
} from './product-categories'
import {
  createProductForUser,
  listProductsForUser,
  setProductStatusForUser,
  updateProductForUser,
} from './products'
import { createReceiptForUser } from './stock-operations'
import { createMovementForUser } from './stock-movements'
import { createTransferForUser } from './transfers'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function denied(
  result: { ok: boolean; error?: { code: DomainErrorCode } },
  message: string,
): void {
  assert(!result.ok && result.error?.code === 'ACCESS_DENIED', message)
}

function addUser(
  persistence: Persistence,
  organizationId: Id,
  role: UserRole,
  extras: { branchId?: Id; warehouseId?: Id } = {},
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
    ...extras,
    createdAt: now,
    updatedAt: now,
  }
  persistence.users.create(user)
  return user
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

export function runSalesEmployeeWarehouseChecks(): void {
  const persistence = createInMemoryPersistence()
  const orgA = 'org-se-wh'
  const now = nowIso()
  addOrg(persistence, orgA, 'Org A')
  seedEnabledBusinessModules(persistence, orgA, 'seed')

  const branch = persistence.branches.create({
    id: newId(),
    organizationId: orgA,
    name: 'Branch',
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
  const warehouseB = persistence.warehouses.create({
    id: newId(),
    organizationId: orgA,
    branchId: branch.id,
    name: 'WH-B',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  })

  const owner = addUser(persistence, orgA, 'owner')
  const warehouseManager = addUser(persistence, orgA, 'warehouse_manager', {
    branchId: branch.id,
    warehouseId: warehouse.id,
  })
  const employee = addUser(persistence, orgA, 'sales_employee', {
    branchId: branch.id,
    warehouseId: warehouse.id,
  })

  const product = createProductForUser(persistence, owner, orgA, {
    name: 'Item',
    sku: 'IT-1',
    unit: 'шт',
    itemType: 'product',
    basePrice: 1000,
    costPrice: 400,
    status: 'active',
    warehouseId: warehouse.id,
    initialQuantity: 10,
  })
  assert(product.ok, 'owner creates product')
  assert(setStock(persistence, orgA, warehouse.id, product.value.id, 10, 400).ok, 'stock')

  const listed = listProductsForUser(persistence, employee)
  assert(listed.ok && listed.value.some((item) => item.id === product.value.id), 'employee can read product')

  denied(
    createProductForUser(persistence, employee, orgA, {
      name: 'Hack',
      sku: 'H-1',
      unit: 'шт',
      itemType: 'product',
      basePrice: 1,
      costPrice: 1,
      status: 'active',
    }),
    'employee cannot create product',
  )
  denied(
    updateProductForUser(persistence, employee, orgA, product.value.id, {
      name: 'Hacked',
      sku: 'IT-1',
      unit: 'шт',
      itemType: 'product',
      basePrice: 1,
      costPrice: 1,
      status: 'active',
    }),
    'employee cannot update product',
  )
  denied(
    setProductStatusForUser(persistence, employee, orgA, product.value.id, 'inactive'),
    'employee cannot disable product',
  )
  denied(
    setStockForUser(persistence, employee, orgA, warehouse.id, product.value.id, 99),
    'employee cannot change stock',
  )
  denied(
    createReceiptForUser(persistence, employee, orgA, {
      warehouseId: warehouse.id,
      items: [{ productId: product.value.id, quantity: 1, unitCost: 1 }],
    }),
    'employee cannot create stock receipt',
  )
  denied(
    createMovementForUser(persistence, employee, orgA, employee.id, {
      warehouseId: warehouse.id,
      productId: product.value.id,
      quantity: 1,
      type: 'adjustment',
    }),
    'employee cannot create movement',
  )
  denied(
    createTransferForUser(persistence, employee, orgA, {
      sourceWarehouseId: warehouse.id,
      destinationWarehouseId: warehouseB.id,
      productId: product.value.id,
      quantity: 1,
    }),
    'employee cannot transfer stock',
  )

  const category = createProductCategoryForUser(persistence, owner, {
    name: 'Cat',
    status: 'active',
  })
  assert(category.ok, 'owner category')
  denied(
    createProductCategoryForUser(persistence, employee, {
      name: 'Employee cat',
      status: 'active',
    }),
    'employee cannot create category',
  )
  denied(
    updateProductCategoryForUser(persistence, employee, category.value.id, {
      name: 'Hacked cat',
      status: 'active',
    }),
    'employee cannot update category',
  )

  const managerUpdate = updateProductForUser(
    persistence,
    warehouseManager,
    orgA,
    product.value.id,
    {
      name: 'Item WH',
      sku: 'IT-1',
      unit: 'шт',
      itemType: 'product',
      basePrice: 1200,
      costPrice: 400,
      status: 'active',
    },
  )
  assert(managerUpdate.ok, 'warehouse manager can update product')
  assert(
    setStockForUser(persistence, warehouseManager, orgA, warehouse.id, product.value.id, 12).ok,
    'warehouse manager can adjust stock',
  )
  assert(
    createReceiptForUser(persistence, warehouseManager, orgA, {
      warehouseId: warehouse.id,
      items: [{ productId: product.value.id, quantity: 1, unitCost: 400 }],
    }).ok,
    'warehouse manager can create receipt',
  )

  const ownerStatus = setProductStatusForUser(
    persistence,
    owner,
    orgA,
    product.value.id,
    'active',
  )
  assert(ownerStatus.ok, 'owner can set product status')

  console.log('sales-employee-warehouse.verify: ok')
}

runSalesEmployeeWarehouseChecks()
