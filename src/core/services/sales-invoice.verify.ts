import type { Id, User, UserRole } from '../types'
import { createInMemoryPersistence } from '../repositories/in-memory/create-in-memory-persistence'
import type { Persistence } from '../repositories/persistence'
import { seedEnabledBusinessModules } from './organization-modules'
import { newId, nowIso } from './primitives'
import { setStock } from './inventory'
import { createSaleForUser } from './sales'
import {
  buildSaleInvoiceDocumentForUser,
  createSaleInvoiceForUser,
} from './sales-invoices'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

export function addOrg(persistence: Persistence, id: Id, name: string) {
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

export function addUser(persistence: Persistence, organizationId: Id, role: UserRole): User {
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

export function seedSale(persistence: Persistence, organizationId: Id, owner: User) {
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
  persistence.users.update(owner.id, { warehouseId, branchId })
  const productId = newId()
  persistence.products.create({
    id: productId,
    organizationId,
    name: 'Товар',
    sku: 'SKU-1',
    unit: 'шт',
    itemType: 'product',
    basePrice: 100,
    costPrice: 40,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  })
  setStock(persistence, organizationId, warehouseId, productId, 10)
  const contactId = newId()
  persistence.contacts.create({
    id: contactId,
    organizationId,
    firstName: 'Иван',
    lastName: 'Клиент',
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
    organizationId,
    type: 'contact',
    contactId,
    status: 'active',
    taxId: '000000000004',
    createdAt: now,
    updatedAt: now,
  })
  const actor = persistence.users.getById(owner.id)
  const sale = createSaleForUser(persistence, actor, organizationId, 'KZT', {
    warehouseId,
    discount: 0,
    customerId,
    items: [{ productId, quantity: 1, unitPrice: 100, discount: 0 }],
  })
  assert(sale.ok, 'create sale')
  return {
    warehouseId,
    productId,
    saleId: sale.value.sale.id,
    stockBefore: 10,
  }
}

export function runSalesInvoiceChecks(): void {
  const persistence = createInMemoryPersistence()
  const org = 'org-dsk-inv'
  addOrg(persistence, org, 'DSK')
  persistence.organizations.update(org, {
    legalName: 'ТОО Пример',
    taxId: '000000000003',
    bankName: 'Bank',
    iban: 'KZ000',
    bik: 'BIK',
  })
  seedEnabledBusinessModules(persistence, org, 'seed', ['sales', 'warehouse', 'crm'])
  const owner = addUser(persistence, org, 'owner')
  const seeded = seedSale(persistence, org, owner)
  const invoice = createSaleInvoiceForUser(persistence, persistence.users.getById(owner.id), {
    saleId: seeded.saleId,
  })
  assert(invoice.ok, 'create invoice')
  const stock = persistence.inventory.getByWarehouseAndProduct(
    org,
    seeded.warehouseId,
    seeded.productId,
  )
  assert(stock?.quantity === seeded.stockBefore, 'invoice does not write stock')
  const pdf = buildSaleInvoiceDocumentForUser(
    persistence,
    persistence.users.getById(owner.id),
    invoice.value.id,
  )
  assert(pdf.ok, 'pdf document')
  assert(pdf.value.supplier.name.includes('Пример'), 'org requisites')
  assert(pdf.value.buyer.taxId === '000000000004', 'customer tax')

  const rental = createInMemoryPersistence()
  addOrg(rental, 'org-rent', 'Rental')
  seedEnabledBusinessModules(rental, 'org-rent', 'seed', ['crm', 'warehouse', 'rental'])
  const rentalOwner = addUser(rental, 'org-rent', 'owner')
  const rejected = createSaleInvoiceForUser(rental, rentalOwner, { saleId: 'x' })
  assert(!rejected.ok && rejected.error.code === 'MODULE_NOT_ENABLED', 'rental invoice rejected')

  const kindergarten = createInMemoryPersistence()
  addOrg(kindergarten, 'org-kg', 'Kindergarten')
  seedEnabledBusinessModules(kindergarten, 'org-kg', 'seed', ['crm', 'children'])
  const kgOwner = addUser(kindergarten, 'org-kg', 'owner')
  const kgRejected = createSaleInvoiceForUser(kindergarten, kgOwner, { saleId: 'x' })
  assert(
    !kgRejected.ok && kgRejected.error.code === 'MODULE_NOT_ENABLED',
    'kindergarten invoice rejected',
  )
  console.log('sales-invoice.verify: ok')
}

export function runSalesInvoiceIsolationChecks(): void {
  const persistence = createInMemoryPersistence()
  addOrg(persistence, 'org-dsk', 'DSK')
  addOrg(persistence, 'org-dent', 'Dentis')
  persistence.organizations.update('org-dsk', {
    legalName: 'DSK Ltd',
    taxId: '222',
    bankName: 'Bank',
    iban: 'KZ1',
  })
  persistence.organizations.update('org-dent', {
    legalName: 'Dentis Ltd',
    taxId: '333',
    bankName: 'Bank',
    iban: 'KZ2',
  })
  seedEnabledBusinessModules(persistence, 'org-dsk', 'seed', ['sales', 'warehouse', 'crm'])
  seedEnabledBusinessModules(persistence, 'org-dent', 'seed', ['sales', 'warehouse', 'crm'])
  const dsk = addUser(persistence, 'org-dsk', 'owner')
  const dent = addUser(persistence, 'org-dent', 'owner')
  const dskSale = seedSale(persistence, 'org-dsk', dsk)
  const dentSale = seedSale(persistence, 'org-dent', dent)
  const dskInvoice = createSaleInvoiceForUser(persistence, persistence.users.getById(dsk.id), {
    saleId: dskSale.saleId,
  })
  const dentInvoice = createSaleInvoiceForUser(persistence, persistence.users.getById(dent.id), {
    saleId: dentSale.saleId,
  })
  assert(dskInvoice.ok && dentInvoice.ok, 'both invoices')
  assert(dskInvoice.value.invoiceNumber === '1', 'dsk numbering')
  assert(dentInvoice.value.invoiceNumber === '1', 'dentis numbering independent')
  const cross = buildSaleInvoiceDocumentForUser(
    persistence,
    persistence.users.getById(dsk.id),
    dentInvoice.value.id,
  )
  assert(!cross.ok, 'dsk cannot read dentis invoice')
  console.log('sales-invoice-organization-isolation.verify: ok')
}

runSalesInvoiceChecks()
