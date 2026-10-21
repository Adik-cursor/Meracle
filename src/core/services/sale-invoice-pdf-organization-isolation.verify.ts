import { createInMemoryPersistence } from '../repositories/in-memory/create-in-memory-persistence'
import { seedEnabledBusinessModules } from './organization-modules'
import { addOrg, addUser, seedSale } from './sales-invoice.verify'
import { createSaleInvoiceForUser, generateSaleInvoicePdfForUser } from './sales-invoices'
import { assert } from './sale-invoice-pdf.verify-support'

export async function runSaleInvoicePdfOrganizationIsolationChecks(): Promise<void> {
  const persistence = createInMemoryPersistence()
  addOrg(persistence, 'org-pdf-dsk', 'DSK')
  addOrg(persistence, 'org-pdf-dent', 'Dentis')
  persistence.organizations.update('org-pdf-dsk', {
    legalName: 'ТОО DSK',
    taxId: '000000000003',
    bankName: 'Bank',
    iban: 'KZ1',
    bik: 'BIK1',
    kbe: '17',
    knp: '710',
  })
  persistence.organizations.update('org-pdf-dent', {
    legalName: 'ТОО Dentis',
    taxId: '000000000005',
    bankName: 'Bank',
    iban: 'KZ2',
    bik: 'BIK2',
    kbe: '17',
    knp: '710',
  })
  seedEnabledBusinessModules(persistence, 'org-pdf-dsk', 'seed', ['sales', 'warehouse', 'crm'])
  seedEnabledBusinessModules(persistence, 'org-pdf-dent', 'seed', ['sales', 'warehouse', 'crm'])
  const dsk = addUser(persistence, 'org-pdf-dsk', 'owner')
  const dent = addUser(persistence, 'org-pdf-dent', 'owner')
  const seeded = seedSale(persistence, 'org-pdf-dsk', dsk)
  const invoice = createSaleInvoiceForUser(persistence, persistence.users.getById(dsk.id), {
    saleId: seeded.saleId,
  })
  assert(invoice.ok, 'dsk invoice')
  const cross = await generateSaleInvoicePdfForUser(
    persistence,
    persistence.users.getById(dent.id),
    invoice.value.id,
  )
  assert(!cross.ok, 'foreign org cannot open invoice pdf')
  console.log('sale-invoice-pdf-organization-isolation.verify: ok')
}

void runSaleInvoicePdfOrganizationIsolationChecks()
