import { createInMemoryPersistence } from '../repositories/in-memory/create-in-memory-persistence'
import { checkoutSaleForUser } from './checkout-sale'
import { completeReturnForUser } from './complete-return'
import { createExpenseForUser, listExpensesForUser } from './expenses'
import { getFinancialAnalyticsForUser } from './financial-analytics'
import { createProductForUser } from './products'
import { receiveStockForUser } from './receive-stock'
import { createReturnForUser } from './sale-returns'
import { createSaleForUser } from './sales'
import { nowIso } from './primitives'
import { createUser } from './users'
import { seedEnabledBusinessModules } from './organization-modules'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function addOwner() {
  const persistence = createInMemoryPersistence()
  const now = nowIso()
  const orgId = 'org-runtime'
  seedEnabledBusinessModules(persistence, orgId, 'seed')
  persistence.branches.create({
    id: 'branch-1',
    organizationId: orgId,
    name: 'Шымкент',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  })
  persistence.warehouses.create({
    id: 'wh-1',
    organizationId: orgId,
    branchId: 'branch-1',
    name: 'Склад Шымкент',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  })
  const owner = createUser(persistence, orgId, {
    firstName: 'Owner',
    lastName: 'Test',
    email: 'demo-user-042@example.com',
    role: 'owner',
    status: 'active',
  })
  assert(owner.ok, 'owner')
  return { persistence, orgId, owner: owner.value }
}

export function runSalesPlatformRuntimeChecks(): void {
  const { persistence, orgId, owner } = addOwner()

  const office = createUser(persistence, orgId, {
    firstName: 'Office',
    lastName: 'Staff',
    email: 'demo-user-039@example.com',
    role: 'office_employee',
    status: 'active',
  })
  assert(office.ok, 'office user')

  const service = createProductForUser(persistence, owner, orgId, {
    name: 'Консультация',
    sku: 'SVC-001',
    unit: 'услуга',
    itemType: 'service',
    basePrice: 10000,
    costPrice: 2000,
    status: 'active',
  })
  assert(service.ok, '8 service created')
  assert(service.value.itemType === 'service', '9 service type')

  const officeSale = createSaleForUser(
    persistence,
    office.value,
    orgId,
    'KZT',
    {
      discount: 0,
      items: [
        {
          productId: service.value.id,
          quantity: 1,
          unitPrice: 1,
          discount: 0,
        },
      ],
    },
  )
  assert(!officeSale.ok, '42 office cannot create sale')

  const serviceSale = createSaleForUser(persistence, owner, orgId, 'KZT', {
    discount: 0,
    items: [
      {
        productId: service.value.id,
        quantity: 1,
        unitPrice: 10000,
        discount: 2000,
      },
    ],
  })
  assert(serviceSale.ok && !serviceSale.value.sale.warehouseId, '16 service sale')
  const paidService = checkoutSaleForUser(
    persistence,
    owner,
    orgId,
    serviceSale.value.sale.id,
    { amount: 8000, method: 'cash' },
  )
  assert(paidService.ok, '20 service checkout')
  assert(paidService.value.fiscalStatus === 'unavailable', '35 fiscal unavailable')
  assert(
    paidService.value.receiptNumber.startsWith('ЧЕК-'),
    'internal sale receipt number',
  )
  assert(
    persistence.internalReceipts.getBySaleId(orgId, serviceSale.value.sale.id)
      ?.receiptType === 'sale',
    'internal sale receipt stored',
  )
  assert(persistence.inventory.list(orgId).length === 0, '9 no inventory for service')
  assert(persistence.stockMovements.list(orgId).length === 0, '9 no movement for service')

  const serviceReturn = createReturnForUser(persistence, owner, orgId, {
    saleId: serviceSale.value.sale.id,
    reason: 'Возврат услуги',
    items: [{ saleItemId: serviceSale.value.items[0].id, quantity: 1 }],
  })
  assert(serviceReturn.ok, '25 return service create')
  assert(
    completeReturnForUser(persistence, owner, orgId, serviceReturn.value.id).ok,
    '25 return service complete',
  )
  assert(persistence.inventory.list(orgId).length === 0, '25 service return no stock')
  assert(
    persistence.internalReceipts.getBySaleReturnId(
      orgId,
      serviceReturn.value.id,
    )?.receiptType === 'return',
    'internal return receipt stored',
  )

  const zeroStock = createProductForUser(persistence, owner, orgId, {
    name: 'Новый товар',
    sku: 'ZERO-001',
    unit: 'шт',
    itemType: 'product',
    basePrice: 9990,
    costPrice: 0,
    status: 'active',
  })
  assert(zeroStock.ok, 'zero stock product without inventory')
  assert(
    !persistence.inventory.getByWarehouseAndProduct(
      orgId,
      'wh-1',
      zeroStock.value.id,
    ),
    'inventory missing before first receipt',
  )

  const firstReceipt = receiveStockForUser(persistence, owner, orgId, {
    warehouseId: 'wh-1',
    productId: zeroStock.value.id,
    quantity: 50,
    unitCost: 5000,
  })
  assert(firstReceipt.ok, 'first receipt creates inventory')
  assert(firstReceipt.value.quantity === 50, 'first receipt qty 50')
  assert(firstReceipt.value.unitCost === 5000, 'first receipt cost 5000')
  assert(
    persistence.stockMovements
      .list(orgId)
      .some(
        (item) =>
          item.productId === zeroStock.value.id &&
          item.type === 'receipt' &&
          item.quantity === 50,
      ),
    'first receipt movement',
  )
  assert(
    persistence.products.getById(zeroStock.value.id)?.basePrice === 9990,
    'receipt does not change basePrice',
  )

  const secondReceipt = receiveStockForUser(persistence, owner, orgId, {
    warehouseId: 'wh-1',
    productId: zeroStock.value.id,
    quantity: 30,
    unitCost: 6000,
  })
  assert(secondReceipt.ok, 'second receipt')
  assert(secondReceipt.value.quantity === 80, 'second receipt qty 80')
  assert(secondReceipt.value.unitCost === 5375, 'WAC 5375')
  assert(
    persistence.products.getById(zeroStock.value.id)?.costPrice === 5375,
    'product costPrice follows WAC',
  )
  assert(
    persistence.products.getById(zeroStock.value.id)?.basePrice === 9990,
    'second receipt does not change basePrice',
  )

  const shirt = createProductForUser(persistence, owner, orgId, {
    name: 'Футболка',
    sku: '100001',
    unit: 'шт',
    itemType: 'product',
    basePrice: 9990,
    costPrice: 6000,
    status: 'active',
    warehouseId: 'wh-1',
    initialQuantity: 100,
  })
  assert(shirt.ok, '4-5 product with opening stock')
  const opening = persistence.inventory.getByWarehouseAndProduct(
    orgId,
    'wh-1',
    shirt.value.id,
  )
  assert(opening && opening.quantity === 100, '6 inventory created')
  assert(opening.unitCost === 6000, '10 cost on inventory')
  const openingMove = persistence.stockMovements
    .list(orgId)
    .find((item) => item.note === 'initial_stock' && item.type === 'receipt')
  assert(openingMove && openingMove.quantity === 100, '7 opening movement')

  const receipt = receiveStockForUser(persistence, owner, orgId, {
    warehouseId: 'wh-1',
    productId: shirt.value.id,
    quantity: 50,
    unitCost: 7000,
    note: 'Завоз от поставщика',
  })
  assert(receipt.ok, '11 receipt')
  assert(receipt.value.quantity === 150, '11 qty 150')
  assert(receipt.value.unitCost === 6333.33, '14 weighted average')
  const refreshed = persistence.products.getById(shirt.value.id)
  assert(refreshed?.costPrice === 6333.33, '12 product cost updated')

  const mixed = createSaleForUser(persistence, owner, orgId, 'KZT', {
    warehouseId: 'wh-1',
    discount: 0,
    items: [
      {
        productId: shirt.value.id,
        quantity: 2,
        unitPrice: 9990,
        discount: 0,
      },
      {
        productId: service.value.id,
        quantity: 1,
        unitPrice: 10000,
        discount: 0,
      },
    ],
  })
  assert(mixed.ok, '17 mixed sale draft')
  const mixedPay = checkoutSaleForUser(
    persistence,
    owner,
    orgId,
    mixed.value.sale.id,
    { amount: 29980, method: 'cash' },
  )
  assert(mixedPay.ok, '21 mixed checkout')
  const afterSale = persistence.inventory.getByWarehouseAndProduct(
    orgId,
    'wh-1',
    shirt.value.id,
  )
  assert(afterSale?.quantity === 148, '22 inventory decrement')
  const saleItem = persistence.saleItems
    .listBySaleId(mixed.value.sale.id)
    .find((item) => item.productId === shirt.value.id)
  assert(saleItem?.costPrice === 6333.33, '13 historical costPrice')

  persistence.products.update(shirt.value.id, {
    costPrice: 9000,
    updatedAt: nowIso(),
  })
  const oldItem = persistence.saleItems.getById(saleItem.id)
  assert(oldItem?.costPrice === 6333.33, '13 cost not rewritten')

  const goodsReturn = createReturnForUser(persistence, owner, orgId, {
    saleId: mixed.value.sale.id,
    reason: 'Возврат товара',
    items: [{ saleItemId: saleItem.id, quantity: 1 }],
  })
  assert(goodsReturn.ok, '24 goods return')
  assert(
    completeReturnForUser(persistence, owner, orgId, goodsReturn.value.id).ok,
    '24 goods return complete',
  )
  const afterReturn = persistence.inventory.getByWarehouseAndProduct(
    orgId,
    'wh-1',
    shirt.value.id,
  )
  assert(afterReturn && afterReturn.quantity === 149, '24 stock restored')

  const expense = createExpenseForUser(persistence, owner, orgId, {
    category: 'rent',
    description: 'Аренда',
    amount: 300000,
    date: nowIso().slice(0, 10),
  })
  assert(expense.ok, 'expense created')
  const listedExpenses = listExpensesForUser(persistence, owner)
  assert(listedExpenses.ok && listedExpenses.value.length === 1, 'expense list')

  const analytics = getFinancialAnalyticsForUser(persistence, owner, {
    from: '2000-01-01T00:00:00.000Z',
    to: '2099-01-01T00:00:00.000Z',
  })
  assert(analytics.ok, '28 analytics')
  assert(analytics.value.kpis.expenses === 300000, '31 expense kpi')
  assert(analytics.value.kpis.grossProfit !== analytics.value.kpis.netProfit, '32-33 gross vs net')

  const snapshot = persistence.capture()
  snapshot.restore()
  assert(persistence.expenses.list(orgId).length === 1, '34 capture restore expenses')
}
