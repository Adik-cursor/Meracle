import type { Id, User, UserRole } from '../types'
import { createInMemoryPersistence } from '../repositories/in-memory/create-in-memory-persistence'
import type { Persistence } from '../repositories/persistence'
import { seedEnabledBusinessModules } from './organization-modules'
import { newId, nowIso } from './primitives'
import { setStock } from './inventory'
import {
  completeInventoryAuditForUser,
  startInventoryAuditForUser,
  updateInventoryAuditActualsForUser,
} from './inventory-audit'
import { exportInventoryAuditExcelForUser, importInventoryAuditExcelForUser } from './inventory-audit'
import { parseExcelWorkbook } from '../utils/excel-workbook'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function addOrg(persistence: Persistence, id: Id, name: string) {
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

function addUser(persistence: Persistence, organizationId: Id, role: UserRole): User {
  const now = nowIso()
  const user: User = {
    id: newId(),
    organizationId,
    email: `${role}@${organizationId}.local`,
    firstName: 'A',
    lastName: 'B',
    role,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  }
  persistence.users.create(user)
  return user
}

function seedWarehouse(persistence: Persistence, organizationId: Id) {
  const now = nowIso()
  const branchId = newId()
  persistence.branches.create({
    id: branchId,
    organizationId,
    name: 'B',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  })
  const warehouseId = newId()
  persistence.warehouses.create({
    id: warehouseId,
    organizationId,
    branchId,
    name: 'WH',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  })
  const productId = newId()
  persistence.products.create({
    id: productId,
    organizationId,
    name: 'Товар',
    sku: 'SKU-1',
    unit: 'шт',
    itemType: 'product',
    basePrice: 1,
    costPrice: 1,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  })
  setStock(persistence, organizationId, warehouseId, productId, 25)
  return { warehouseId, productId }
}

export function runInventoryAuditChecks(): void {
  const persistence = createInMemoryPersistence()
  const org = 'org-audit'
  addOrg(persistence, org, 'DSK')
  seedEnabledBusinessModules(persistence, org, 'seed', ['warehouse', 'crm'])
  const owner = addUser(persistence, org, 'owner')
  const { warehouseId, productId } = seedWarehouse(persistence, org)
  const started = startInventoryAuditForUser(persistence, owner, warehouseId)
  assert(started.ok, 'start audit')
  const item = persistence.stockAuditItems.listByAuditId(started.value.id)[0]
  assert(item?.systemQuantity === 25, 'snapshot 25')
  assert(item?.actualQuantity === undefined, 'actual empty')
  const filled = updateInventoryAuditActualsForUser(persistence, owner, started.value.id, [
    { productId, actualQuantity: 23 },
  ])
  assert(filled.ok, 'fill actual')
  const updatedItem = persistence.stockAuditItems.listByAuditId(started.value.id)[0]
  assert(updatedItem?.difference === -2, 'service difference')
  const completed = completeInventoryAuditForUser(persistence, owner, started.value.id)
  assert(completed.ok, 'complete')
  const stock = persistence.inventory.getByWarehouseAndProduct(org, warehouseId, productId)
  assert(stock?.quantity === 23, 'stock after audit')
  const movement = persistence.stockMovements.list(org).find((row) => row.note?.includes('diff:-2'))
  assert(movement, 'adjustment movement')
  const again = completeInventoryAuditForUser(persistence, owner, started.value.id)
  assert(!again.ok && again.error.code === 'AUDIT_ALREADY_COMPLETED', 'no double complete')

  const kinder = createInMemoryPersistence()
  addOrg(kinder, 'org-k', 'Kinder')
  seedEnabledBusinessModules(kinder, 'org-k', 'seed', ['crm', 'children', 'attendance', 'expenses'])
  const kOwner = addUser(kinder, 'org-k', 'owner')
  const denied = startInventoryAuditForUser(kinder, kOwner, 'wh')
  assert(!denied.ok && denied.error.code === 'MODULE_NOT_ENABLED', 'kinder no warehouse audit')
  console.log('inventory-audit.verify: ok')
}

export function runInventoryAuditExcelChecks(): void {
  const persistence = createInMemoryPersistence()
  const org = 'org-audit-x'
  addOrg(persistence, org, 'Rental')
  seedEnabledBusinessModules(persistence, org, 'seed', ['warehouse', 'crm', 'rental'])
  const owner = addUser(persistence, org, 'owner')
  const { warehouseId, productId } = seedWarehouse(persistence, org)
  void productId
  const started = startInventoryAuditForUser(persistence, owner, warehouseId)
  assert(started.ok, 'start')
  const exported = exportInventoryAuditExcelForUser(persistence, owner, started.value.id)
  assert(exported.ok, 'export template')
  const sheet = parseExcelWorkbook(exported.value.bytes)[0]
  assert(sheet?.headers.includes('Учётное количество'), 'account qty header')
  const actualIndex = sheet.headers.indexOf('Фактическое количество')
  assert(String(sheet.rows[0]?.[actualIndex] ?? '') === '', 'actual empty on export')
  const imported = importInventoryAuditExcelForUser(
    persistence,
    owner,
    started.value.id,
    exported.value.bytes,
  )
  assert(imported.ok, 'import empty actuals ok')
  const withActual = {
    ...exported.value.sheet,
    rows: exported.value.sheet.rows.map((row) => {
      const next = [...row]
      next[actualIndex] = 20
      return next
    }),
  }
  const rebuilt = exportInventoryAuditExcelForUser(persistence, owner, started.value.id)
  assert(rebuilt.ok, 'rebuild')
  void withActual
  const csv = `Артикул,Наименование,Категория,Размер,Ед. измерения,Склад,Учётное количество,Фактическое количество,Разница,Комментарий\nSKU-1,Товар,,,шт,WH,25,20,,`
  const csvImport = importInventoryAuditExcelForUser(persistence, owner, started.value.id, csv)
  assert(csvImport.ok, 'csv import')
  const item = persistence.stockAuditItems.listByAuditId(started.value.id)[0]
  assert(item?.actualQuantity === 20 && item.difference === -5, 'csv difference service-side')
  console.log('inventory-audit-excel.verify: ok')
}

runInventoryAuditChecks()
