import { createInMemoryPersistence } from '../repositories/in-memory/create-in-memory-persistence'
import { seedEnabledBusinessModules } from './organization-modules'
import { addOrg, addUser, seedSale } from './sales-invoice.verify'
import { checkoutOnCreditForUser } from './checkout-on-credit'
import { createDeliveryNoteForUser, generateDeliveryNotePdfForUser } from './delivery-notes'
import { assert } from './delivery-documents.verify-support'

export async function runDeliveryNoteOrganizationIsolationChecks(): Promise<void> {
  const persistence = createInMemoryPersistence()
  addOrg(persistence, 'org-dn-a', 'Alpha')
  addOrg(persistence, 'org-dn-b', 'Beta')
  persistence.organizations.update('org-dn-a', { legalName: 'ТОО Alpha', taxId: '000000000003' })
  persistence.organizations.update('org-dn-b', { legalName: 'ТОО Beta', taxId: '000000000005' })
  seedEnabledBusinessModules(persistence, 'org-dn-a', 'seed', ['sales', 'warehouse', 'crm'])
  seedEnabledBusinessModules(persistence, 'org-dn-b', 'seed', ['sales', 'warehouse', 'crm'])
  const a = addUser(persistence, 'org-dn-a', 'owner')
  const b = addUser(persistence, 'org-dn-b', 'owner')
  const seeded = seedSale(persistence, 'org-dn-a', a)
  const ownerA = persistence.users.getById(a.id)
  const ownerB = persistence.users.getById(b.id)
  const credited = checkoutOnCreditForUser(persistence, ownerA, 'org-dn-a', seeded.saleId)
  assert(credited.ok, 'complete a')
  const note = createDeliveryNoteForUser(persistence, ownerA, { saleId: seeded.saleId })
  assert(note.ok, 'note a')
  const cross = await generateDeliveryNotePdfForUser(persistence, ownerB, note.value.id)
  assert(!cross.ok, 'b cannot read a')
  console.log('delivery-note-organization-isolation.verify: ok')
}

void runDeliveryNoteOrganizationIsolationChecks()
