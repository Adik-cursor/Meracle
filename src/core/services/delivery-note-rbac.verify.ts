import { createInMemoryPersistence } from '../repositories/in-memory/create-in-memory-persistence'
import { seedEnabledBusinessModules } from './organization-modules'
import { addOrg, addUser, seedSale } from './sales-invoice.verify'
import { addRoleUser } from './sales-debt.fixture'
import { checkoutOnCreditForUser } from './checkout-on-credit'
import { createDeliveryNoteForUser, generateDeliveryNotePdfForUser } from './delivery-notes'
import { assert } from './delivery-documents.verify-support'

export async function runDeliveryNoteRbacChecks(): Promise<void> {
  const persistence = createInMemoryPersistence()
  addOrg(persistence, 'org-dn-rbac', 'RBAC Org')
  seedEnabledBusinessModules(persistence, 'org-dn-rbac', 'seed', ['sales', 'warehouse', 'crm'])
  const owner = addUser(persistence, 'org-dn-rbac', 'owner')
  const seeded = seedSale(persistence, 'org-dn-rbac', owner)
  const actor = persistence.users.getById(owner.id)
  const credited = checkoutOnCreditForUser(persistence, actor, 'org-dn-rbac', seeded.saleId)
  assert(credited.ok, 'complete')
  const employee = addRoleUser(persistence, 'org-dn-rbac', 'sales_employee', seeded.warehouseId)
  const created = createDeliveryNoteForUser(persistence, employee, { saleId: seeded.saleId })
  assert(created.ok, 'employee can issue')
  const ownerAgain = createDeliveryNoteForUser(persistence, actor, { saleId: seeded.saleId })
  assert(ownerAgain.ok && ownerAgain.value.id === created.value.id, 'owner reuses')
  const readable = await generateDeliveryNotePdfForUser(persistence, employee, created.value.id)
  assert(readable.ok, 'employee can read')

  const rental = createInMemoryPersistence()
  addOrg(rental, 'org-dn-rent', 'Rental')
  seedEnabledBusinessModules(rental, 'org-dn-rent', 'seed', ['crm', 'warehouse', 'rental'])
  const rentalOwner = addUser(rental, 'org-dn-rent', 'owner')
  const rentalDenied = createDeliveryNoteForUser(rental, rentalOwner, { saleId: 'x' })
  assert(!rentalDenied.ok && rentalDenied.error.code === 'MODULE_NOT_ENABLED', 'rental')

  const kg = createInMemoryPersistence()
  addOrg(kg, 'org-dn-kg', 'Kindergarten')
  seedEnabledBusinessModules(kg, 'org-dn-kg', 'seed', ['crm', 'children'])
  const kgOwner = addUser(kg, 'org-dn-kg', 'owner')
  const kgDenied = createDeliveryNoteForUser(kg, kgOwner, { saleId: 'x' })
  assert(!kgDenied.ok && kgDenied.error.code === 'MODULE_NOT_ENABLED', 'kindergarten')
  console.log('delivery-note-rbac.verify: ok')
}

void runDeliveryNoteRbacChecks()
