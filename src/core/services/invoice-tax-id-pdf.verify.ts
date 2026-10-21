import {
  buildSaleInvoiceDocumentForUser,
  createSaleInvoiceForUser,
  generateSaleInvoicePdfForUser,
} from './sales-invoices'
import { addOrg, addUser, seedSale } from './sales-invoice.verify'
import { createInMemoryPersistence } from '../repositories/in-memory/create-in-memory-persistence'
import { seedEnabledBusinessModules } from './organization-modules'
import { isPdfBytes } from './sale-invoice-pdf.verify-support'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

export async function runInvoiceTaxIdPdfChecks(): Promise<void> {
  const persistence = createInMemoryPersistence()
  const org = 'org-inv-pdf-tax'
  addOrg(persistence, org, 'DSK')
  persistence.organizations.update(org, {
    legalName: 'ТОО Пример',
    taxId: '000000000003',
    bankName: 'Bank',
    iban: 'KZ000',
    bik: 'BIK',
    kbe: '17',
    knp: '710',
  })
  seedEnabledBusinessModules(persistence, org, 'seed', ['sales', 'warehouse', 'crm'])
  const owner = addUser(persistence, org, 'owner')
  const seeded = seedSale(persistence, org, owner)
  const actor = persistence.users.getById(owner.id)
  const invoice = createSaleInvoiceForUser(persistence, actor, { saleId: seeded.saleId })
  assert(invoice.ok, 'invoice')
  const doc = buildSaleInvoiceDocumentForUser(persistence, actor, invoice.value.id)
  assert(doc.ok, 'document')
  assert(doc.value.buyer.taxId === '000000000004', 'buyer tax from customer')
  assert(doc.value.buyer.taxLabel === 'ИИН', 'individual label')
  assert(doc.value.supplier.taxId === '000000000003', 'supplier tax')
  const pdf = await generateSaleInvoicePdfForUser(persistence, actor, invoice.value.id)
  assert(pdf.ok && isPdfBytes(pdf.value.bytes), 'real pdf')
  console.log('invoice-tax-id-pdf.verify: ok')
}

void runInvoiceTaxIdPdfChecks()
