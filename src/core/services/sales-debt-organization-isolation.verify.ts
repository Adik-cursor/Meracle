import { checkoutOnCreditForUser } from './checkout-on-credit'
import { createCustomerDebtPaymentForUser, listSaleDebtRowsForUser } from './customer-debts'
import { addOrg, addUser, seedSale } from './sales-invoice.verify'
import { createInMemoryPersistence } from '../repositories/in-memory/create-in-memory-persistence'
import { seedEnabledBusinessModules } from './organization-modules'
import { assert } from './sales-debt.fixture'

export function runSalesDebtOrganizationIsolationChecks(): void {
  const persistence = createInMemoryPersistence()
  addOrg(persistence, 'org-dsk-iso', 'DSK')
  addOrg(persistence, 'org-dent-iso', 'Dentis')
  seedEnabledBusinessModules(persistence, 'org-dsk-iso', 'seed', [
    'sales',
    'warehouse',
    'crm',
  ])
  seedEnabledBusinessModules(persistence, 'org-dent-iso', 'seed', [
    'sales',
    'warehouse',
    'crm',
  ])
  const dsk = addUser(persistence, 'org-dsk-iso', 'owner')
  const dent = addUser(persistence, 'org-dent-iso', 'owner')
  const dskSale = seedSale(persistence, 'org-dsk-iso', dsk)
  const dentSale = seedSale(persistence, 'org-dent-iso', dent)
  const dskActor = persistence.users.getById(dsk.id)
  const dentActor = persistence.users.getById(dent.id)

  const dskCredit = checkoutOnCreditForUser(
    persistence,
    dskActor,
    'org-dsk-iso',
    dskSale.saleId,
  )
  const dentCredit = checkoutOnCreditForUser(
    persistence,
    dentActor,
    'org-dent-iso',
    dentSale.saleId,
  )
  assert(dskCredit.ok && dentCredit.ok, 'both orgs credit')

  const crossCheckout = checkoutOnCreditForUser(
    persistence,
    dentActor,
    'org-dsk-iso',
    dskSale.saleId,
  )
  assert(!crossCheckout.ok, 'cannot credit other org sale')

  const dskRows = listSaleDebtRowsForUser(persistence, dskActor)
  const dentRows = listSaleDebtRowsForUser(persistence, dentActor)
  assert(dskRows.ok && dentRows.ok, 'lists')
  assert(
    dskRows.value.every((row) => row.organizationId === 'org-dsk-iso'),
    'dsk isolation',
  )
  assert(
    dentRows.value.every((row) => row.organizationId === 'org-dent-iso'),
    'dent isolation',
  )
  assert(
    !dskRows.value.some((row) => row.saleId === dentSale.saleId),
    'dsk cannot see dent debt',
  )

  const dskCustomer = persistence.sales.getById(dskSale.saleId)?.customerId
  assert(dskCustomer, 'dsk customer')
  const crossPay = createCustomerDebtPaymentForUser(persistence, dentActor, {
    customerId: dskCustomer,
    saleId: dskSale.saleId,
    amount: 10,
    method: 'cash',
  })
  assert(!crossPay.ok, 'cannot pay other org debt')
  console.log('sales-debt-organization-isolation.verify: ok')
}

runSalesDebtOrganizationIsolationChecks()
