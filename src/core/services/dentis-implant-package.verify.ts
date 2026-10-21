import type { Id, User, UserRole } from '../types'
import { createInMemoryPersistence } from '../repositories/in-memory/create-in-memory-persistence'
import type { Persistence } from '../repositories/persistence'
import { seedEnabledBusinessModules } from './organization-modules'
import { newId, nowIso } from './primitives'
import { setStock } from './inventory'
import {
  createImplantPackageForUser,
  getImplantPackageForUser,
  recordImplantPackageMovementForUser,
} from './implant-packages'
import { createPackageContractForUser, generatePackageContractDocumentForUser } from './package-contracts'
import { exportExcelDatasetForUser } from './excel-export'
import { parseExcelWorkbook } from '../utils/excel-workbook'
import { createSaleForUser } from './sales'

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

export function runDentisPackageChecks(): void {
  const persistence = createInMemoryPersistence()
  const org = 'org-dentis'
  const other = 'org-dsk'
  addOrg(persistence, org, 'Dentis')
  addOrg(persistence, other, 'DSK')
  persistence.organizations.update(org, {
    legalName: 'Dentis',
    taxId: '999',
    bankName: 'Bank',
    iban: 'KZ9',
  })
  seedEnabledBusinessModules(persistence, org, 'seed', [
    'crm',
    'sales',
    'warehouse',
    'packages',
  ])
  seedEnabledBusinessModules(persistence, other, 'seed', ['crm', 'sales', 'warehouse'])
  const owner = addUser(persistence, org, 'owner')
  const dsk = addUser(persistence, other, 'owner')
  const now = nowIso()
  const branchId = newId()
  persistence.branches.create({
    id: branchId,
    organizationId: org,
    name: 'B',
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
  persistence.users.update(owner.id, { warehouseId, branchId })
  const productId = newId()
  persistence.products.create({
    id: productId,
    organizationId: org,
    name: 'Имплант 4.2',
    sku: 'IMP-42',
    size: '4.2',
    unit: 'шт',
    itemType: 'product',
    basePrice: 50,
    costPrice: 20,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  })
  setStock(persistence, org, warehouseId, productId, 80)
  const contactId = newId()
  persistence.contacts.create({
    id: contactId,
    organizationId: org,
    firstName: 'Пациент',
    lastName: 'А',
    email: null,
    phone: null,
    companyId: null,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  })
  const customerId = newId()
  persistence.customers.create({
    id: customerId,
    organizationId: org,
    type: 'contact',
    contactId,
    status: 'active',
    taxId: '555',
    createdAt: now,
    updatedAt: now,
  })
  const actor = persistence.users.getById(owner.id)
  const pkg = createImplantPackageForUser(persistence, actor, {
    customerId,
    name: 'Пакет 100',
    price: 100000,
    currency: 'KZT',
    totalImplants: 100,
    startDate: now.slice(0, 10),
    status: 'active',
  })
  assert(pkg.ok, 'create package')
  const issued = recordImplantPackageMovementForUser(persistence, actor, {
    packageId: pkg.value.id,
    productId,
    warehouseId,
    movementType: 'issued',
    quantity: 37,
  })
  assert(issued.ok, 'issue')
  const used = recordImplantPackageMovementForUser(persistence, actor, {
    packageId: pkg.value.id,
    productId,
    movementType: 'used',
    quantity: 31,
  })
  assert(used.ok, 'used')
  const returned = recordImplantPackageMovementForUser(persistence, actor, {
    packageId: pkg.value.id,
    productId,
    warehouseId,
    movementType: 'returned',
    quantity: 6,
  })
  assert(returned.ok, 'returned')
  const view = getImplantPackageForUser(persistence, actor, pkg.value.id)
  assert(view.ok, 'get package')
  assert(view.value.balance.issued === 37, 'issued 37')
  assert(view.value.balance.used === 31, 'used 31')
  assert(view.value.balance.returned === 6, 'returned 6')
  assert(view.value.balance.remaining === 63, 'remaining 63')
  const stock = persistence.inventory.getByWarehouseAndProduct(org, warehouseId, productId)
  assert(stock?.quantity === 80 - 37 + 6, 'warehouse changed by issue/return not package ledger')

  const sale = createSaleForUser(persistence, actor, org, 'KZT', {
    warehouseId,
    discount: 0,
    customerId,
    items: [{ productId, quantity: 1, unitPrice: 50, discount: 0 }],
  })
  assert(sale.ok, 'individual implant sale')

  const foreign = getImplantPackageForUser(persistence, dsk, pkg.value.id)
  assert(!foreign.ok, 'dsk cannot read dentis package')

  const kinder = createInMemoryPersistence()
  addOrg(kinder, 'org-k', 'Kinder')
  seedEnabledBusinessModules(kinder, 'org-k', 'seed', ['crm', 'children', 'attendance'])
  const kOwner = addUser(kinder, 'org-k', 'owner')
  const hidden = createImplantPackageForUser(kinder, kOwner, {
    customerId: 'x',
    name: 'no',
    price: 1,
    currency: 'KZT',
    totalImplants: 1,
    startDate: now.slice(0, 10),
  })
  assert(!hidden.ok && hidden.error.code === 'MODULE_NOT_ENABLED', 'kinder no packages')
  console.log('dentis-implant-package.verify: ok')
}

export function runDentisContractChecks(): void {
  const persistence = createInMemoryPersistence()
  const org = 'org-dentis-c'
  addOrg(persistence, org, 'Dentis')
  seedEnabledBusinessModules(persistence, org, 'seed', ['crm', 'packages'])
  const owner = addUser(persistence, org, 'owner')
  const now = nowIso()
  const customerId = newId()
  persistence.customers.create({
    id: customerId,
    organizationId: org,
    type: 'contact',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  })
  const pkg = createImplantPackageForUser(persistence, owner, {
    customerId,
    name: 'Пакет',
    price: 1,
    currency: 'KZT',
    totalImplants: 2,
    startDate: now.slice(0, 10),
  })
  assert(pkg.ok, 'pkg')
  const contract = createPackageContractForUser(persistence, owner, {
    packageId: pkg.value.id,
    contractNumber: 'Д-1',
    contractDate: now.slice(0, 10),
  })
  assert(contract.ok, 'placeholder contract')
  assert(!contract.value.templateId, 'no template')
  const generated = generatePackageContractDocumentForUser(
    persistence,
    owner,
    contract.value.id,
  )
  assert(
    !generated.ok && generated.error.code === 'CONTRACT_TEMPLATE_UNAVAILABLE',
    'no legal text',
  )
  console.log('dentis-package-contract.verify: ok')
}

export function runDentisPackageExcelChecks(): void {
  const persistence = createInMemoryPersistence()
  const org = 'org-dentis-x'
  addOrg(persistence, org, 'Dentis')
  seedEnabledBusinessModules(persistence, org, 'seed', ['crm', 'packages', 'warehouse'])
  const owner = addUser(persistence, org, 'owner')
  const now = nowIso()
  const customerId = newId()
  persistence.customers.create({
    id: customerId,
    organizationId: org,
    type: 'contact',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  })
  const pkg = createImplantPackageForUser(persistence, owner, {
    customerId,
    name: 'Пакет Excel',
    price: 10,
    currency: 'KZT',
    totalImplants: 5,
    startDate: now.slice(0, 10),
  })
  assert(pkg.ok, 'pkg')
  const exported = exportExcelDatasetForUser(persistence, owner, 'implant_packages')
  assert(exported.ok, 'package excel')
  const sheet = parseExcelWorkbook(exported.value.bytes)[0]
  assert(sheet?.headers.includes('Всего имплантов'), 'package columns')
  const history = exportExcelDatasetForUser(persistence, owner, 'implant_movements')
  assert(history.ok, 'movement excel')
  console.log('dentis-package-excel.verify: ok')
}

runDentisPackageChecks()
