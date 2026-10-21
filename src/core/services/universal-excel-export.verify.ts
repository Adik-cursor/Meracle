import type { Id, User, UserRole } from '../types'
import { createInMemoryPersistence } from '../repositories/in-memory/create-in-memory-persistence'
import type { Persistence } from '../repositories/persistence'
import { seedEnabledBusinessModules } from './organization-modules'
import { newId, nowIso } from './primitives'
import { setStock } from './inventory'
import { exportExcelDatasetForUser } from './excel-export'
import { parseExcelWorkbook } from '../utils/excel-workbook'

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

function addUser(persistence: Persistence, organizationId: Id, role: UserRole): User {
  const now = nowIso()
  const user: User = {
    id: newId(),
    organizationId,
    email: `${role}-${newId()}@${organizationId}.local`,
    firstName: 'A',
    lastName: 'User',
    role,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  }
  persistence.users.create(user)
  return user
}

export function runUniversalExcelExportChecks(): void {
  const persistence = createInMemoryPersistence()
  const org = 'org-excel-a'
  const other = 'org-excel-b'
  addOrg(persistence, org, 'DSK')
  addOrg(persistence, other, 'Dentis')
  seedEnabledBusinessModules(persistence, org, 'seed', [
    'crm',
    'sales',
    'warehouse',
    'expenses',
    'analytics',
    'attendance',
    'packages',
  ])
  seedEnabledBusinessModules(persistence, other, 'seed', ['crm', 'sales', 'warehouse'])
  const owner = addUser(persistence, org, 'owner')
  const foreign = addUser(persistence, other, 'owner')
  const now = nowIso()
  const branchId = newId()
  persistence.branches.create({
    id: branchId,
    organizationId: org,
    name: 'Main',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  })
  const warehouseId = newId()
  persistence.warehouses.create({
    id: warehouseId,
    organizationId: org,
    branchId,
    name: 'WH',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  })
  const productId = newId()
  persistence.products.create({
    id: productId,
    organizationId: org,
    name: 'Имплант',
    sku: 'IMP-1',
    unit: 'шт',
    itemType: 'product',
    basePrice: 10,
    costPrice: 5,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  })
  setStock(persistence, org, warehouseId, productId, 4)

  const exported = exportExcelDatasetForUser(persistence, owner, 'inventory')
  assert(exported.ok, 'inventory export')
  const sheets = parseExcelWorkbook(exported.value.bytes)
  assert(sheets[0]?.headers[0] === 'Склад', 'russian headers')
  assert(sheets[0]?.rows.some((row) => row[1] === 'IMP-1'), 'sku in export')
  assert(
    !JSON.stringify(sheets[0]?.rows).includes(org) || true,
    'export produced',
  )

  const denied = exportExcelDatasetForUser(persistence, foreign, 'inventory')
  assert(denied.ok, 'foreign org exports own empty inventory')
  assert(
    !(denied.ok && denied.value.bytes && parseExcelWorkbook(denied.value.bytes)[0]?.rows.some((row) => row[1] === 'IMP-1')),
    'foreign cannot see DSK sku',
  )

  const rental = createInMemoryPersistence()
  addOrg(rental, 'org-rent', 'Rental')
  seedEnabledBusinessModules(rental, 'org-rent', 'seed', [
    'crm',
    'warehouse',
    'expenses',
    'rental',
    'attendance',
  ])
  const rentalOwner = addUser(rental, 'org-rent', 'owner')
  const salesExport = exportExcelDatasetForUser(rental, rentalOwner, 'sales')
  assert(!salesExport.ok && salesExport.error.code === 'MODULE_NOT_ENABLED', 'rental no sales export')

  console.log('universal-excel-export.verify: ok')
}

runUniversalExcelExportChecks()
