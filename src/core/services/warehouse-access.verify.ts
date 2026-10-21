import type {
  Id,
  Product,
  User,
  UserRole,
  Warehouse,
} from '../types'
import type { DomainErrorCode, ServiceResult } from '../types/domain-error'
import { createInMemoryPersistence } from '../repositories/in-memory/create-in-memory-persistence'
import type { Persistence } from '../repositories/persistence'
import { completeAuditForUser } from './complete-audit'
import { completeReceiptForUser } from './complete-receipt'
import { completeReturnForUser } from './complete-return'
import { completeSaleForUser } from './complete-sale'
import { completeTransferForUser } from './complete-transfer'
import { completeWriteoffForUser } from './complete-writeoff'
import { listInventoryForAnalytics, listInventoryForUser, setStock } from './inventory'
import { newId, nowIso } from './primitives'
import { seedEnabledBusinessModules } from './organization-modules'
import { listProductsForUser } from './products'
import {
  confirmSaleForUser,
  createSaleForUser,
  listSalesForAnalytics,
} from './sales'
import { createReturnForUser } from './sale-returns'
import {
  createAuditForUser,
  createReceiptForUser,
  createWriteoffForUser,
} from './stock-operations'
import { createMovement, listMovementsForUser } from './stock-movements'
import { createTransferForUser } from './transfers'
import {
  getWarehouseForUser,
  listWarehousesForAnalytics,
  listWarehousesForUser,
  updateWarehouseForUser,
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
  const a2 = addWarehouse(persistence, orgA, branchA, 'A2')
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

  for (const warehouse of [a1, a2, b1]) {
    const stock = setStock(persistence, orgA, warehouse.id, product.id, 100)
    assert(stock.ok, `stock ${warehouse.name}`)
  }
  assert(
    setStock(persistence, orgB, xb1.id, productB.id, 50).ok,
    'stock XB1',
  )

  const employee = addUser(persistence, orgA, 'sales_employee', branchA, a1.id)
  const manager = addUser(persistence, orgA, 'sales_manager', branchA, a1.id)
  const director = addUser(persistence, orgA, 'branch_director', branchA, a1.id)
  const commercial = addUser(persistence, orgA, 'commercial_director', undefined, a1.id)
  const owner = addUser(persistence, orgA, 'owner', undefined, a1.id)
  const foreignOwner = addUser(persistence, orgB, 'owner')

  return {
    persistence,
    orgA,
    orgB,
    branchA,
    branchB,
    a1,
    a2,
    b1,
    xb1,
    product,
    employee,
    manager,
    director,
    commercial,
    owner,
    foreignOwner,
  }
}

function warehouseIds(result: ServiceResult<Warehouse[]>): Set<Id> {
  assert(result.ok, 'warehouse list ok')
  return new Set(result.value.map((warehouse) => warehouse.id))
}

export function runWarehouseAccessChecks(): void {
  const world = seedWorld()
  const {
    persistence,
    orgA,
    a1,
    a2,
    b1,
    xb1,
    product,
    employee,
    manager,
    director,
    commercial,
    owner,
    foreignOwner,
  } = world

  {
    const listed = listWarehousesForUser(persistence, employee)
    const ids = warehouseIds(listed)
    assert(ids.has(a1.id) && !ids.has(a2.id), '1 employee assigned warehouse only')
    assert(!ids.has(b1.id), '1 employee hides foreign branch')
    assert(getWarehouseForUser(persistence, employee, a1.id).ok, '1 get A1')
    denied(
      getWarehouseForUser(persistence, employee, a2.id),
      'ACCESS_DENIED',
      '1 employee other warehouse same branch',
    )
  }

  {
    denied(
      getWarehouseForUser(persistence, employee, b1.id),
      'ACCESS_DENIED',
      '2 employee foreign branch',
    )
  }

  {
    const ids = warehouseIds(listWarehousesForUser(persistence, manager))
    assert(ids.has(a1.id) && ids.has(a2.id) && !ids.has(b1.id), '3 manager own')
    assert(getWarehouseForUser(persistence, manager, a1.id).ok, '3 manager A1')
  }

  {
    denied(
      getWarehouseForUser(persistence, manager, b1.id),
      'WAREHOUSE_BRANCH_MISMATCH',
      '4 manager foreign branch',
    )
  }

  {
    const ids = warehouseIds(listWarehousesForUser(persistence, director))
    assert(
      ids.has(a1.id) && ids.has(a2.id) && !ids.has(b1.id),
      '5 branch director branch only',
    )
  }

  {
    const ids = warehouseIds(listWarehousesForUser(persistence, commercial))
    assert(
      ids.has(a1.id) && ids.has(a2.id) && ids.has(b1.id) && !ids.has(xb1.id),
      '6 commercial director organization',
    )
  }

  {
    const ids = warehouseIds(listWarehousesForUser(persistence, owner))
    assert(
      ids.has(a1.id) && ids.has(a2.id) && ids.has(b1.id),
      '7 owner organization',
    )
  }

  {
    denied(
      getWarehouseForUser(persistence, employee, xb1.id),
      'WAREHOUSE_ORGANIZATION_MISMATCH',
      '8 employee cross organization',
    )
    denied(
      getWarehouseForUser(persistence, owner, xb1.id),
      'WAREHOUSE_ORGANIZATION_MISMATCH',
      '8 owner cross organization',
    )
    denied(
      getWarehouseForUser(persistence, foreignOwner, a1.id),
      'WAREHOUSE_ORGANIZATION_MISMATCH',
      '8 foreign owner warehouse A',
    )
  }

  {
    assert(
      listInventoryForUser(persistence, employee, a1.id).ok,
      '9 inventory A1 employee',
    )
    denied(
      listInventoryForUser(persistence, employee, b1.id),
      'ACCESS_DENIED',
      '9 inventory B1 employee',
    )
    assert(
      listInventoryForUser(persistence, commercial, b1.id).ok,
      '9 inventory B1 commercial',
    )
  }

  {
    assert(
      createMovement(persistence, orgA, owner.id, {
        warehouseId: a1.id,
        productId: product.id,
        type: 'adjustment',
        quantity: 1,
      }).ok,
      'seed movement A1',
    )
    assert(
      createMovement(persistence, orgA, owner.id, {
        warehouseId: b1.id,
        productId: product.id,
        type: 'adjustment',
        quantity: 1,
      }).ok,
      'seed movement B1',
    )
    assert(
      listMovementsForUser(persistence, employee, a1.id).ok,
      '10 movements A1 employee',
    )
    denied(
      listMovementsForUser(persistence, employee, b1.id),
      'ACCESS_DENIED',
      '10 movements B1 employee',
    )
  }

  {
    const saleA1 = createSaleForUser(persistence, employee, orgA, 'KZT', {
      warehouseId: a1.id,
      discount: 0,
      items: [
        {
          productId: product.id,
          quantity: 1,
          unitPrice: 10,
          discount: 0,
        },
      ],
    })
    assert(saleA1.ok, '11 sale A1 employee')
    denied(
      createSaleForUser(persistence, employee, orgA, 'KZT', {
        warehouseId: b1.id,
        discount: 0,
        items: [
          {
            productId: product.id,
            quantity: 1,
            unitPrice: 10,
            discount: 0,
          },
        ],
      }),
      'ACCESS_DENIED',
      '11 sale B1 employee',
    )
    assert(
      confirmSaleForUser(persistence, employee, orgA, saleA1.value.sale.id).ok,
      '11 confirm A1',
    )
    assert(
      completeSaleForUser(persistence, employee, orgA, saleA1.value.sale.id)
        .ok,
      '11 complete A1',
    )

    const saleB1 = createSaleForUser(persistence, owner, orgA, 'KZT', {
      warehouseId: b1.id,
      discount: 0,
      items: [
        {
          productId: product.id,
          quantity: 1,
          unitPrice: 10,
          discount: 0,
        },
      ],
    })
    assert(saleB1.ok, '11 owner sale B1')
    assert(
      confirmSaleForUser(persistence, owner, orgA, saleB1.value.sale.id).ok,
      '11 owner confirm B1',
    )
    denied(
      completeSaleForUser(persistence, employee, orgA, saleB1.value.sale.id),
      'ACCESS_DENIED',
      '11 employee complete B1',
    )
  }

  {
    const saleForReturn = createSaleForUser(persistence, manager, orgA, 'KZT', {
      warehouseId: a1.id,
      discount: 0,
      items: [
        {
          productId: product.id,
          quantity: 1,
          unitPrice: 10,
          discount: 0,
        },
      ],
    })
    assert(saleForReturn.ok, '12 sale for return')
    assert(
      confirmSaleForUser(persistence, manager, orgA, saleForReturn.value.sale.id)
        .ok,
      '12 confirm return sale',
    )
    assert(
      completeSaleForUser(
        persistence,
        manager,
        orgA,
        saleForReturn.value.sale.id,
      ).ok,
      '12 complete return sale',
    )
    const createdReturn = createReturnForUser(persistence, manager, orgA, {
      saleId: saleForReturn.value.sale.id,
      reason: 'Возврат товара',
      items: [
        {
          saleItemId: saleForReturn.value.items[0].id,
          quantity: 1,
        },
      ],
    })
    assert(createdReturn.ok, '12 manager create return')
    denied(
      createReturnForUser(persistence, employee, orgA, {
        saleId: saleForReturn.value.sale.id,
        reason: 'Возврат товара',
        items: [
          {
            saleItemId: saleForReturn.value.items[0].id,
            quantity: 1,
          },
        ],
      }),
      'ACCESS_DENIED',
      '12 employee create return',
    )
    assert(
      completeReturnForUser(persistence, manager, orgA, createdReturn.value.id)
        .ok,
      '12 complete return',
    )
  }

  {
    denied(
      createReceiptForUser(persistence, employee, orgA, {
        warehouseId: a1.id,
        items: [{ productId: product.id, quantity: 1, unitCost: 1 }],
      }),
      'ACCESS_DENIED',
      '13 employee receipt create',
    )
    const receipt = createReceiptForUser(persistence, director, orgA, {
      warehouseId: a1.id,
      items: [{ productId: product.id, quantity: 2, unitCost: 1 }],
    })
    assert(receipt.ok, '13 director receipt create')
    denied(
      completeReceiptForUser(persistence, employee, orgA, receipt.value.id),
      'ACCESS_DENIED',
      '13 employee receipt complete',
    )
    denied(
      completeReceiptForUser(persistence, commercial, orgA, receipt.value.id),
      'ACCESS_DENIED',
      '13 commercial receipt complete',
    )
    assert(
      completeReceiptForUser(persistence, director, orgA, receipt.value.id).ok,
      '13 director receipt complete',
    )
  }

  {
    denied(
      createWriteoffForUser(persistence, employee, orgA, {
        warehouseId: a1.id,
        items: [{ productId: product.id, quantity: 1 }],
      }),
      'ACCESS_DENIED',
      '14 employee writeoff',
    )
    denied(
      createWriteoffForUser(persistence, manager, orgA, {
        warehouseId: a1.id,
        items: [{ productId: product.id, quantity: 1 }],
      }),
      'ACCESS_DENIED',
      '20 manager writeoff permission',
    )
    const writeoff = createWriteoffForUser(persistence, director, orgA, {
      warehouseId: a1.id,
      items: [{ productId: product.id, quantity: 1 }],
    })
    assert(writeoff.ok, '14 director writeoff create')
    denied(
      completeWriteoffForUser(persistence, employee, orgA, writeoff.value.id),
      'ACCESS_DENIED',
      '14 employee writeoff complete',
    )
    assert(
      completeWriteoffForUser(persistence, director, orgA, writeoff.value.id)
        .ok,
      '14 director writeoff complete',
    )
  }

  {
    denied(
      createAuditForUser(persistence, employee, orgA, {
        warehouseId: a1.id,
        items: [{ productId: product.id, actualQuantity: 90 }],
      }),
      'ACCESS_DENIED',
      '15 employee audit',
    )
    const audit = createAuditForUser(persistence, director, orgA, {
      warehouseId: a1.id,
      items: [{ productId: product.id, actualQuantity: 90 }],
    })
    assert(audit.ok, '15 director audit create')
    assert(
      completeAuditForUser(persistence, director, orgA, audit.value.id).ok,
      '15 director audit complete',
    )
  }

  {
    denied(
      createTransferForUser(persistence, employee, orgA, {
        sourceWarehouseId: a1.id,
        destinationWarehouseId: a2.id,
        productId: product.id,
        quantity: 1,
      }),
      'ACCESS_DENIED',
      '16 employee transfer A→A permission',
    )
    const transferAA = createTransferForUser(persistence, director, orgA, {
      sourceWarehouseId: a1.id,
      destinationWarehouseId: a2.id,
      productId: product.id,
      quantity: 1,
    })
    assert(transferAA.ok, '16 director transfer A→A')
    assert(
      completeTransferForUser(persistence, director, orgA, transferAA.value.id)
        .ok,
      '16 complete transfer A→A',
    )
  }

  {
    denied(
      createTransferForUser(persistence, director, orgA, {
        sourceWarehouseId: a1.id,
        destinationWarehouseId: b1.id,
        productId: product.id,
        quantity: 1,
      }),
      'WAREHOUSE_BRANCH_MISMATCH',
      '17 director transfer A→B',
    )
    denied(
      createTransferForUser(persistence, commercial, orgA, {
        sourceWarehouseId: a1.id,
        destinationWarehouseId: b1.id,
        productId: product.id,
        quantity: 1,
      }),
      'ACCESS_DENIED',
      '17 commercial transfer permission',
    )
    const transferAB = createTransferForUser(persistence, owner, orgA, {
      sourceWarehouseId: a1.id,
      destinationWarehouseId: b1.id,
      productId: product.id,
      quantity: 1,
    })
    assert(transferAB.ok, '17 owner transfer A→B')
  }

  {
    const employeeAnalytics = listWarehousesForAnalytics(persistence, employee)
    assert(
      employeeAnalytics.ok && employeeAnalytics.value.length === 0,
      '18 employee analytics empty',
    )
    const managerAnalytics = listWarehousesForAnalytics(persistence, manager)
    assert(
      managerAnalytics.ok &&
        managerAnalytics.value.every(
          (warehouse) => warehouse.branchId === employee.branchId,
        ) &&
        managerAnalytics.value.length === 2,
      '18 manager analytics branch',
    )
    const commercialAnalytics = listWarehousesForAnalytics(
      persistence,
      commercial,
    )
    assert(
      commercialAnalytics.ok && commercialAnalytics.value.length === 3,
      '18 commercial analytics org',
    )
    const employeeInventoryAnalytics = listInventoryForAnalytics(
      persistence,
      employee,
    )
    assert(
      employeeInventoryAnalytics.ok &&
        employeeInventoryAnalytics.value.length === 0,
      '18 employee analytics inventory empty',
    )
    const employeeSalesAnalytics = listSalesForAnalytics(persistence, employee)
    assert(
      employeeSalesAnalytics.ok && employeeSalesAnalytics.value.length === 0,
      '18 employee analytics sales empty',
    )
  }

  {
    denied(
      listWarehousesForUser(persistence, null),
      'CURRENT_USER_REQUIRED',
      '19 no currentUser list',
    )
    denied(
      getWarehouseForUser(persistence, undefined, a1.id),
      'CURRENT_USER_REQUIRED',
      '19 no currentUser get',
    )
    denied(
      createSaleForUser(persistence, null, orgA, 'KZT', {
        warehouseId: a1.id,
        discount: 0,
        items: [
          {
            productId: product.id,
            quantity: 1,
            unitPrice: 1,
            discount: 0,
          },
        ],
      }),
      'CURRENT_USER_REQUIRED',
      '19 no currentUser sale',
    )
  }

  {
    denied(
      updateWarehouseForUser(persistence, director, orgA, a1.id, {
        name: 'A1 moved',
        status: 'active',
        branchId: world.branchB,
      }),
      'ACCESS_DENIED',
      '20 director cannot move warehouse to foreign branch',
    )
    denied(
      createWriteoffForUser(persistence, commercial, orgA, {
        warehouseId: a1.id,
        items: [{ productId: product.id, quantity: 1 }],
      }),
      'ACCESS_DENIED',
      '20 commercial writeoff permission',
    )
    const products = listProductsForUser(persistence, employee)
    assert(
      products.ok && products.value.some((item) => item.id === product.id),
      '20 employee reads org products',
    )
  }
}

runWarehouseAccessChecks()

