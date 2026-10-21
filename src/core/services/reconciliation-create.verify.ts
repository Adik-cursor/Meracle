import { createReconciliationStatementForUser, listReconciliationStatementsForUser } from './reconciliation-statements'
import { addSaleOnDay, completeSeededSale, setupInvoiceOrg } from './delivery-documents.verify-support'

export function runReconciliationCreateChecks(): void {
  const ctx = completeSeededSale(setupInvoiceOrg('org-rec-create', 'ТОО Акт', '000000000003'))
  addSaleOnDay(
    ctx.persistence,
    ctx.owner,
    ctx.orgId,
    ctx.warehouseId,
    ctx.productId,
    ctx.customerId,
    250000,
    '2026-08-10',
  )
  const created = createReconciliationStatementForUser(ctx.persistence, ctx.owner, {
    customerId: ctx.customerId,
    dateFrom: '2026-08-01',
    dateTo: '2026-08-31',
    documentDate: '2026-08-27',
  })
  if (!created.ok) {
    throw new Error(created.error.code)
  }
  if (created.value.documentNumber !== '1') {
    throw new Error('number')
  }
  if (created.value.documentDate !== '2026-08-27') {
    throw new Error('documentDate')
  }
  const listed = listReconciliationStatementsForUser(ctx.persistence, ctx.owner, ctx.customerId)
  if (!listed.ok || listed.value.length !== 1) {
    throw new Error('list')
  }
  console.log('reconciliation-create.verify: ok')
}

runReconciliationCreateChecks()
