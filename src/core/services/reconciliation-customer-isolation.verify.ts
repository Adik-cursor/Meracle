import { createReconciliationStatementForUser } from './reconciliation-statements'
import { completeSeededSale, setupInvoiceOrg } from './delivery-documents.verify-support'
import { createInMemoryPersistence } from '../repositories/in-memory/create-in-memory-persistence'
import { seedEnabledBusinessModules } from './organization-modules'
import { addOrg, addUser, seedSale } from './sales-invoice.verify'

export function runReconciliationCustomerIsolationChecks(): void {
  const ctx = completeSeededSale(setupInvoiceOrg('org-rec-cust', 'ТОО Cust', '000000000003'))
  const foreign = createInMemoryPersistence()
  addOrg(foreign, 'org-rec-other', 'Other')
  seedEnabledBusinessModules(foreign, 'org-rec-other', 'seed', ['sales', 'warehouse', 'crm'])
  const otherOwner = addUser(foreign, 'org-rec-other', 'owner')
  const otherSale = seedSale(foreign, 'org-rec-other', otherOwner)
  const otherCustomer = foreign.sales.getById(otherSale.saleId)?.customerId
  if (!otherCustomer) {
    throw new Error('foreign customer')
  }
  const cross = createReconciliationStatementForUser(ctx.persistence, ctx.owner, {
    customerId: otherCustomer,
    dateFrom: '2026-08-01',
    dateTo: '2026-08-31',
    documentDate: '2026-08-27',
  })
  if (cross.ok || cross.error.code !== 'CUSTOMER_NOT_FOUND') {
    throw new Error('foreign customer blocked')
  }
  console.log('reconciliation-customer-isolation.verify: ok')
}

runReconciliationCustomerIsolationChecks()
