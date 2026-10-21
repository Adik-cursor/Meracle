import { PDFDocument } from 'pdf-lib'
import type { Id, User } from '../types'
import { createInMemoryPersistence } from '../repositories/in-memory/create-in-memory-persistence'
import type { Persistence } from '../repositories/persistence'
import { seedEnabledBusinessModules } from './organization-modules'
import { addOrg, addUser, seedSale } from './sales-invoice.verify'
import { createSaleForUser } from './sales'
import { setStock } from './inventory'
import { newId, nowIso } from './primitives'

export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

export function isPdfBytes(bytes: Uint8Array): boolean {
  return (
    bytes.length > 8 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  )
}

export async function readPdfMeta(bytes: Uint8Array) {
  const pdf = await PDFDocument.load(bytes)
  const page = pdf.getPage(0)
  const { width, height } = page.getSize()
  return {
    pageCount: pdf.getPageCount(),
    width,
    height,
    landscape: width > height,
  }
}

export function setupInvoiceOrg(orgId: Id, name: string, taxId: string) {
  const persistence = createInMemoryPersistence()
  addOrg(persistence, orgId, name)
  persistence.organizations.update(orgId, {
    legalName: name,
    taxId,
    legalAddress: 'Казахстан, г. Тест',
    bankName: 'АО Тест Банк',
    iban: 'KZ111222333444555',
    bik: 'TESTKZKA',
    kbe: '17',
    knp: '710',
    vatStatus: 'no_vat',
  })
  seedEnabledBusinessModules(persistence, orgId, 'seed', ['sales', 'warehouse', 'crm'])
  const owner = addUser(persistence, orgId, 'owner')
  const seeded = seedSale(persistence, orgId, owner)
  return {
    persistence,
    orgId,
    owner: persistence.users.getById(owner.id) as User,
    ...seeded,
  }
}

export function addManySaleItems(
  persistence: Persistence,
  organizationId: Id,
  owner: User,
  warehouseId: Id,
  customerId: Id,
  count: number,
) {
  const now = nowIso()
  const items: { productId: string; quantity: number; unitPrice: number; discount: number }[] = []
  for (let i = 0; i < count; i += 1) {
    const productId = newId()
    persistence.products.create({
      id: productId,
      organizationId,
      name: i === 5 ? 'Сенсорный монитор моноблок 2 в 1' : `Позиция ${i + 1}`,
      sku: `SKU-${i + 1}`,
      unit: 'шт',
      itemType: 'product',
      basePrice: 1000 + i,
      costPrice: 400,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    })
    setStock(persistence, organizationId, warehouseId, productId, 50)
    items.push({ productId, quantity: 1, unitPrice: 1000 + i, discount: 0 })
  }
  const sale = createSaleForUser(persistence, owner, organizationId, 'KZT', {
    warehouseId,
    discount: 0,
    customerId,
    items,
  })
  assert(sale.ok, 'multi item sale')
  return sale.value.sale
}
