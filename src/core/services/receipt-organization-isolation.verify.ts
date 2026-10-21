import { checkoutSaleForUser } from './checkout-sale'
import { getInternalReceiptForUser, listInternalReceiptsForUser } from './internal-receipts'
import { addOrg, addUser, seedSale } from './sales-invoice.verify'
import { createInMemoryPersistence } from '../repositories/in-memory/create-in-memory-persistence'
import { seedEnabledBusinessModules } from './organization-modules'
import { assert } from './sales-debt.fixture'

export function runReceiptOrganizationIsolationChecks(): void {
  const persistence = createInMemoryPersistence()
  addOrg(persistence, 'org-dsk-rcpt', 'DSK')
  addOrg(persistence, 'org-dent-rcpt', 'Dentis')
  seedEnabledBusinessModules(persistence, 'org-dsk-rcpt', 'seed', [
    'sales',
    'warehouse',
    'crm',
  ])
  seedEnabledBusinessModules(persistence, 'org-dent-rcpt', 'seed', [
    'sales',
    'warehouse',
    'crm',
  ])
  const dsk = addUser(persistence, 'org-dsk-rcpt', 'owner')
  const dent = addUser(persistence, 'org-dent-rcpt', 'owner')
  const dskSale = seedSale(persistence, 'org-dsk-rcpt', dsk)
  seedSale(persistence, 'org-dent-rcpt', dent)
  const paid = checkoutSaleForUser(
    persistence,
    persistence.users.getById(dsk.id),
    'org-dsk-rcpt',
    dskSale.saleId,
    { amount: 100, method: 'cash' },
  )
  assert(paid.ok, 'dsk receipt')
  const dentActor = persistence.users.getById(dent.id)
  const cross = getInternalReceiptForUser(persistence, dentActor, paid.value.receiptId)
  assert(
    !cross.ok &&
      (cross.error.code === 'ORGANIZATION_MISMATCH' || cross.error.code === 'ACCESS_DENIED'),
    'foreign receipt denied',
  )
  const listed = listInternalReceiptsForUser(persistence, dentActor)
  assert(listed.ok && !listed.value.some((item) => item.id === paid.value.receiptId), 'isolated list')
  console.log('receipt-organization-isolation.verify: ok')
}

runReceiptOrganizationIsolationChecks()
