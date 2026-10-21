import { createInMemoryPersistence } from '../repositories/in-memory/create-in-memory-persistence'
import { seedEnabledBusinessModules } from './organization-modules'
import { addOrg, addUser, seedSale } from './sales-invoice.verify'
import { checkoutOnCreditForUser } from './checkout-on-credit'
import {
  createReconciliationStatementForUser,
  generateReconciliationStatementPdfForUser,
} from './reconciliation-statements'
import { assert } from './delivery-documents.verify-support'

export async function runReconciliationOrganizationIsolationChecks(): Promise<void> {
  const persistence = createInMemoryPersistence()
  addOrg(persistence, 'org-rec-a', 'Alpha')
  addOrg(persistence, 'org-rec-b', 'Beta')
  persistence.organizations.update('org-rec-a', { legalName: 'ТОО Alpha', taxId: '000000000003' })
  persistence.organizations.update('org-rec-b', { legalName: 'ТОО Beta', taxId: '000000000005' })
  seedEnabledBusinessModules(persistence, 'org-rec-a', 'seed', ['sales', 'warehouse', 'crm'])
  seedEnabledBusinessModules(persistence, 'org-rec-b', 'seed', ['sales', 'warehouse', 'crm'])
  const a = addUser(persistence, 'org-rec-a', 'owner')
  const b = addUser(persistence, 'org-rec-b', 'owner')
  const seeded = seedSale(persistence, 'org-rec-a', a)
  const ownerA = persistence.users.getById(a.id)
  const ownerB = persistence.users.getById(b.id)
  const credited = checkoutOnCreditForUser(persistence, ownerA, 'org-rec-a', seeded.saleId)
  assert(credited.ok, 'complete')
  const statement = createReconciliationStatementForUser(persistence, ownerA, {
    customerId: credited.value.customerId,
    dateFrom: '2020-01-01',
    dateTo: '2030-12-31',
    documentDate: '2026-08-27',
  })
  assert(statement.ok, 'create')
  const cross = await generateReconciliationStatementPdfForUser(persistence, ownerB, statement.value.id)
  assert(!cross.ok, 'isolation')
  console.log('reconciliation-organization-isolation.verify: ok')
}

void runReconciliationOrganizationIsolationChecks()
