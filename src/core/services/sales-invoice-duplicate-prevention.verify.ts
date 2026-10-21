import { createInMemoryPersistence } from '../repositories/in-memory/create-in-memory-persistence'
import { seedEnabledBusinessModules } from './organization-modules'
import { addOrg, addUser, seedSale } from './sales-invoice.verify'
import {
  createSaleInvoiceForUser,
  findActiveSaleInvoiceForUser,
} from './sales-invoices'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

export function runSalesInvoiceDuplicatePreventionChecks(): void {
  const persistence = createInMemoryPersistence()
  const org = 'org-dsk-dup'
  addOrg(persistence, org, 'DSK')
  persistence.organizations.update(org, {
    legalName: 'ТОО DSK',
    taxId: '000000000003',
    bankName: 'Bank',
    iban: 'KZ000',
    bik: 'BIK',
  })
  seedEnabledBusinessModules(persistence, org, 'seed', ['sales', 'warehouse', 'crm'])
  const owner = addUser(persistence, org, 'owner')
  const seeded = seedSale(persistence, org, owner)
  const actor = persistence.users.getById(owner.id)
  const first = createSaleInvoiceForUser(persistence, actor, { saleId: seeded.saleId })
  assert(first.ok, 'first invoice')
  const second = createSaleInvoiceForUser(persistence, actor, { saleId: seeded.saleId })
  assert(second.ok && second.value.id === first.value.id, 'duplicate returns existing')
  const active = findActiveSaleInvoiceForUser(persistence, actor, seeded.saleId)
  assert(active.ok && active.value?.id === first.value.id, 'existing invoice reused')
  console.log('sales-invoice-duplicate-prevention.verify: ok')
}

runSalesInvoiceDuplicatePreventionChecks()
