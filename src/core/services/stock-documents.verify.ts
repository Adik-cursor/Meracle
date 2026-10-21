import type {
  Id,
  Product,
  StockAudit,
  StockAuditItem,
  StockReceipt,
  StockReceiptItem,
  StockWriteoff,
  StockWriteoffItem,
  Warehouse,
} from '../types'
import { createInMemoryPersistence } from '../repositories/in-memory/create-in-memory-persistence'
import type { Persistence } from '../repositories/persistence'
import { completeAudit } from './complete-audit'
import { completeReceipt } from './complete-receipt'
import { completeWriteoff } from './complete-writeoff'
import { setStock } from './inventory'
import { newId, nowIso } from './primitives'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function seedCatalog(persistence: Persistence, organizationId: Id, sku: string) {
  const now = nowIso()
  const branchId = newId()
  persistence.branches.create({
    id: branchId,
    organizationId,
    name: 'Main branch',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  })
  const warehouse: Warehouse = {
    id: newId(),
    organizationId,
    branchId,
    name: 'Main',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  }
  const product: Product = {
    id: newId(),
    organizationId,
    name: sku,
    sku,
    unit: 'pcs',
    itemType: 'product',
    basePrice: 0,
    costPrice: 0,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  }

  persistence.warehouses.create(warehouse)
  persistence.products.create(product)

  return { warehouse, product }
}

function stockOf(
  persistence: Persistence,
  organizationId: Id,
  warehouseId: Id,
  productId: Id,
): number {
  return (
    persistence.inventory.getByWarehouseAndProduct(
      organizationId,
      warehouseId,
      productId,
    )?.quantity ?? 0
  )
}

function addReceipt(
  persistence: Persistence,
  organizationId: Id,
  warehouseId: Id,
  productId: Id,
  quantity: number,
  status: StockReceipt['status'] = 'draft',
) {
  const now = nowIso()
  const receipt: StockReceipt = {
    id: newId(),
    organizationId,
    warehouseId,
    status,
    createdAt: now,
    updatedAt: now,
  }
  const item: StockReceiptItem = {
    id: newId(),
    organizationId,
    receiptId: receipt.id,
    warehouseId,
    productId,
    quantity,
    unitCost: 1,
    total: quantity * 1,
    createdAt: now,
    updatedAt: now,
  }

  persistence.stockReceipts.create(receipt)
  persistence.stockReceiptItems.create(item)
  return receipt
}

function addWriteoff(
  persistence: Persistence,
  organizationId: Id,
  warehouseId: Id,
  productId: Id,
  quantity: number,
) {
  const now = nowIso()
  const writeoff: StockWriteoff = {
    id: newId(),
    organizationId,
    warehouseId,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  }
  const item: StockWriteoffItem = {
    id: newId(),
    organizationId,
    writeoffId: writeoff.id,
    warehouseId,
    productId,
    quantity,
    createdAt: now,
    updatedAt: now,
  }

  persistence.stockWriteoffs.create(writeoff)
  persistence.stockWriteoffItems.create(item)
  return writeoff
}

function addAudit(
  persistence: Persistence,
  organizationId: Id,
  warehouseId: Id,
  lines: { productId: Id; actualQuantity: number }[],
) {
  const now = nowIso()
  const audit: StockAudit = {
    id: newId(),
    organizationId,
    warehouseId,
    status: 'in_progress',
    createdAt: now,
    updatedAt: now,
  }

  persistence.stockAudits.create(audit)

  for (const line of lines) {
    const item: StockAuditItem = {
      id: newId(),
      organizationId,
      auditId: audit.id,
      warehouseId,
      productId: line.productId,
      systemQuantity: 0,
      actualQuantity: line.actualQuantity,
      difference: 0,
      createdAt: now,
      updatedAt: now,
    }
    persistence.stockAuditItems.create(item)
  }

  return audit
}

export function runStockDocumentChecks(): void {
  const orgA = 'org-a'
  const orgB = 'org-b'

  {
    const persistence = createInMemoryPersistence()
    const { warehouse, product } = seedCatalog(persistence, orgA, 'R-1')
    const stock = setStock(persistence, orgA, warehouse.id, product.id, 10)
    assert(stock.ok, 'seed receipt stock')
    const receipt = addReceipt(
      persistence,
      orgA,
      warehouse.id,
      product.id,
      10,
    )
    const first = completeReceipt(persistence, orgA, receipt.id)
    assert(first.ok && first.value.status === 'completed', 'receipt 10→20')
    assert(
      stockOf(persistence, orgA, warehouse.id, product.id) === 20,
      'receipt stock 20',
    )
    const second = completeReceipt(persistence, orgA, receipt.id)
    assert(second.ok, 'receipt repeat complete')
    assert(
      stockOf(persistence, orgA, warehouse.id, product.id) === 20,
      'receipt repeat does not add stock',
    )
  }

  {
    const persistence = createInMemoryPersistence()
    const { warehouse } = seedCatalog(persistence, orgA, 'R-2')
    const receipt = addReceipt(
      persistence,
      orgA,
      warehouse.id,
      'missing-product',
      5,
    )
    const result = completeReceipt(persistence, orgA, receipt.id)
    assert(!result.ok && result.error.code === 'PRODUCT_NOT_FOUND', 'missing product')
    assert(result.ok === false, 'receipt missing product fails')
  }

  {
    const persistence = createInMemoryPersistence()
    const { product } = seedCatalog(persistence, orgA, 'R-3')
    const receipt = addReceipt(
      persistence,
      orgA,
      'missing-warehouse',
      product.id,
      5,
    )
    const result = completeReceipt(persistence, orgA, receipt.id)
    assert(!result.ok && result.error.code === 'WAREHOUSE_NOT_FOUND', 'missing warehouse')
  }

  {
    const persistence = createInMemoryPersistence()
    const local = seedCatalog(persistence, orgA, 'R-4')
    const foreign = seedCatalog(persistence, orgB, 'R-4B')
    const receipt = addReceipt(
      persistence,
      orgA,
      foreign.warehouse.id,
      local.product.id,
      5,
    )
    const result = completeReceipt(persistence, orgA, receipt.id)
    assert(
      !result.ok &&
        (result.error.code === 'WAREHOUSE_NOT_FOUND' ||
          result.error.code === 'ORGANIZATION_MISMATCH'),
      'foreign warehouse',
    )
  }

  {
    const persistence = createInMemoryPersistence()
    const { warehouse, product } = seedCatalog(persistence, orgA, 'R-5')
    const receipt = addReceipt(persistence, orgA, warehouse.id, product.id, 0)
    const result = completeReceipt(persistence, orgA, receipt.id)
    assert(!result.ok && result.error.code === 'INVALID_QUANTITY', 'qty <= 0')
  }

  {
    const persistence = createInMemoryPersistence()
    const { warehouse, product } = seedCatalog(persistence, orgA, 'R-6')
    setStock(persistence, orgA, warehouse.id, product.id, 10)
    const receipt = addReceipt(persistence, orgA, warehouse.id, product.id, 5)
    const now = nowIso()
    persistence.stockReceiptItems.create({
      id: newId(),
      organizationId: orgA,
      receiptId: receipt.id,
      warehouseId: warehouse.id,
      productId: 'ghost',
      quantity: 2,
      unitCost: 1,
      total: 2,
      createdAt: now,
      updatedAt: now,
    })
    const result = completeReceipt(persistence, orgA, receipt.id)
    assert(!result.ok, 'receipt rollback on invalid item')
    assert(
      stockOf(persistence, orgA, warehouse.id, product.id) === 10,
      'receipt rollback keeps stock',
    )
    assert(
      persistence.stockReceipts.getById(receipt.id)?.status === 'draft',
      'receipt rollback keeps status',
    )
  }

  {
    const persistence = createInMemoryPersistence()
    const { warehouse, product } = seedCatalog(persistence, orgA, 'W-1')
    setStock(persistence, orgA, warehouse.id, product.id, 10)
    const writeoff = addWriteoff(persistence, orgA, warehouse.id, product.id, 3)
    const first = completeWriteoff(persistence, orgA, writeoff.id)
    assert(first.ok && first.value.status === 'completed', 'writeoff 10→7')
    assert(
      stockOf(persistence, orgA, warehouse.id, product.id) === 7,
      'writeoff stock 7',
    )
    const second = completeWriteoff(persistence, orgA, writeoff.id)
    assert(second.ok, 'writeoff repeat complete')
    assert(
      stockOf(persistence, orgA, warehouse.id, product.id) === 7,
      'writeoff repeat does not change stock',
    )
  }

  {
    const persistence = createInMemoryPersistence()
    const { warehouse, product } = seedCatalog(persistence, orgA, 'W-2')
    setStock(persistence, orgA, warehouse.id, product.id, 10)
    const writeoff = addWriteoff(persistence, orgA, warehouse.id, product.id, 11)
    const result = completeWriteoff(persistence, orgA, writeoff.id)
    assert(
      !result.ok && result.error.code === 'INSUFFICIENT_STOCK',
      'writeoff 11 from 10',
    )
    assert(
      stockOf(persistence, orgA, warehouse.id, product.id) === 10,
      'writeoff insufficient keeps stock',
    )
  }

  {
    const persistence = createInMemoryPersistence()
    const { warehouse, product } = seedCatalog(persistence, orgA, 'W-3')
    setStock(persistence, orgA, warehouse.id, product.id, 10)
    const writeoff = addWriteoff(persistence, orgA, warehouse.id, product.id, 2)
    const now = nowIso()
    persistence.stockWriteoffItems.create({
      id: newId(),
      organizationId: orgA,
      writeoffId: writeoff.id,
      warehouseId: warehouse.id,
      productId: 'ghost',
      quantity: 1,
      createdAt: now,
      updatedAt: now,
    })
    const result = completeWriteoff(persistence, orgA, writeoff.id)
    assert(!result.ok, 'writeoff rollback')
    assert(
      stockOf(persistence, orgA, warehouse.id, product.id) === 10,
      'writeoff rollback stock',
    )
    assert(
      persistence.stockWriteoffs.getById(writeoff.id)?.status === 'draft',
      'writeoff rollback status',
    )
  }

  {
    const persistence = createInMemoryPersistence()
    const { warehouse, product } = seedCatalog(persistence, orgA, 'A-1')
    setStock(persistence, orgA, warehouse.id, product.id, 10)
    const down = addAudit(persistence, orgA, warehouse.id, [
      { productId: product.id, actualQuantity: 8 },
    ])
    const downResult = completeAudit(persistence, orgA, down.id)
    assert(downResult.ok, 'audit 10→8')
    assert(
      stockOf(persistence, orgA, warehouse.id, product.id) === 8,
      'audit stock 8',
    )
    const item = persistence.stockAuditItems.listByAuditId(down.id)[0]
    assert(item?.systemQuantity === 10 && item.difference === -2, 'audit diff -2')
  }

  {
    const persistence = createInMemoryPersistence()
    const { warehouse, product } = seedCatalog(persistence, orgA, 'A-2')
    setStock(persistence, orgA, warehouse.id, product.id, 10)
    const up = addAudit(persistence, orgA, warehouse.id, [
      { productId: product.id, actualQuantity: 13 },
    ])
    const upResult = completeAudit(persistence, orgA, up.id)
    assert(upResult.ok, 'audit 10→13')
    assert(
      stockOf(persistence, orgA, warehouse.id, product.id) === 13,
      'audit stock 13',
    )
    const item = persistence.stockAuditItems.listByAuditId(up.id)[0]
    assert(item?.difference === 3, 'audit diff +3')
    const again = completeAudit(persistence, orgA, up.id)
    assert(
      !again.ok && again.error.code === 'AUDIT_ALREADY_COMPLETED',
      'audit repeat complete',
    )
    assert(
      stockOf(persistence, orgA, warehouse.id, product.id) === 13,
      'audit repeat stock',
    )
  }

  {
    const persistence = createInMemoryPersistence()
    const { warehouse, product } = seedCatalog(persistence, orgA, 'A-3')
    setStock(persistence, orgA, warehouse.id, product.id, 10)
    const audit = addAudit(persistence, orgA, warehouse.id, [
      { productId: product.id, actualQuantity: -1 },
    ])
    const result = completeAudit(persistence, orgA, audit.id)
    assert(
      !result.ok && result.error.code === 'INVALID_ACTUAL_QUANTITY',
      'actual < 0',
    )
    assert(
      stockOf(persistence, orgA, warehouse.id, product.id) === 10,
      'invalid actual keeps stock',
    )
  }

  {
    const persistence = createInMemoryPersistence()
    const first = seedCatalog(persistence, orgA, 'A-4A')
    const secondProduct: Product = {
      id: newId(),
      organizationId: orgA,
      name: 'A-4B',
      sku: 'A-4B',
      unit: 'pcs',
    itemType: 'product',
    basePrice: 0,
    costPrice: 0,
      status: 'active',
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }
    persistence.products.create(secondProduct)
    setStock(persistence, orgA, first.warehouse.id, first.product.id, 10)
    setStock(persistence, orgA, first.warehouse.id, secondProduct.id, 4)
    const audit = addAudit(persistence, orgA, first.warehouse.id, [
      { productId: first.product.id, actualQuantity: 8 },
      { productId: secondProduct.id, actualQuantity: 6 },
    ])
    const result = completeAudit(persistence, orgA, audit.id)
    assert(result.ok, 'audit multiple products')
    assert(
      stockOf(persistence, orgA, first.warehouse.id, first.product.id) === 8,
      'audit product A',
    )
    assert(
      stockOf(persistence, orgA, first.warehouse.id, secondProduct.id) === 6,
      'audit product B',
    )
  }

  {
    const persistence = createInMemoryPersistence()
    const first = seedCatalog(persistence, orgA, 'A-5A')
    const secondProduct: Product = {
      id: newId(),
      organizationId: orgA,
      name: 'A-5B',
      sku: 'A-5B',
      unit: 'pcs',
    itemType: 'product',
    basePrice: 0,
    costPrice: 0,
      status: 'active',
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }
    persistence.products.create(secondProduct)
    setStock(persistence, orgA, first.warehouse.id, first.product.id, 10)
    setStock(persistence, orgA, first.warehouse.id, secondProduct.id, 4)
    const audit = addAudit(persistence, orgA, first.warehouse.id, [
      { productId: first.product.id, actualQuantity: 8 },
      { productId: secondProduct.id, actualQuantity: -3 },
    ])
    const result = completeAudit(persistence, orgA, audit.id)
    assert(!result.ok, 'audit one invalid rolls back all')
    assert(
      stockOf(persistence, orgA, first.warehouse.id, first.product.id) === 10,
      'audit rollback A',
    )
    assert(
      stockOf(persistence, orgA, first.warehouse.id, secondProduct.id) === 4,
      'audit rollback B',
    )
    assert(
      persistence.stockAudits.getById(audit.id)?.status === 'in_progress',
      'audit rollback status',
    )
  }

  {
    const persistence = createInMemoryPersistence()
    const { warehouse, product } = seedCatalog(persistence, orgA, 'R-7')
    const receipt = addReceipt(persistence, orgA, warehouse.id, product.id, 4)
    const result = completeReceipt(persistence, orgB, receipt.id)
    assert(
      !result.ok && result.error.code === 'ORGANIZATION_MISMATCH',
      'foreign organization',
    )
  }
}

runStockDocumentChecks()

