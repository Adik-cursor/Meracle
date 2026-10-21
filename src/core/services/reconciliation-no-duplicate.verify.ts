import {
  createReconciliationStatementForUser,
  generateReconciliationStatementPdfForUser,
  listReconciliationStatementsForUser,
} from './reconciliation-statements'
import { completeSeededSale, setupInvoiceOrg } from './delivery-documents.verify-support'

export async function runReconciliationNoDuplicateChecks(): Promise<void> {
  const ctx = completeSeededSale(setupInvoiceOrg('org-rec-nodup', 'ТОО RecDup', '000000000003'))
  const draft = {
    customerId: ctx.customerId,
    dateFrom: '2026-08-01',
    dateTo: '2026-08-31',
    documentDate: '2026-08-27',
  }
  const created = createReconciliationStatementForUser(ctx.persistence, ctx.owner, draft)
  if (!created.ok) {
    throw new Error(created.error.code)
  }
  const again = createReconciliationStatementForUser(ctx.persistence, ctx.owner, draft)
  if (!again.ok || again.value.id !== created.value.id) {
    throw new Error('same document')
  }
  await generateReconciliationStatementPdfForUser(ctx.persistence, ctx.owner, created.value.id)
  await generateReconciliationStatementPdfForUser(ctx.persistence, ctx.owner, created.value.id)
  const listed = listReconciliationStatementsForUser(ctx.persistence, ctx.owner, ctx.customerId)
  if (!listed.ok || listed.value.length !== 1) {
    throw new Error('no extra')
  }
  if (listed.value[0]?.documentNumber !== created.value.documentNumber) {
    throw new Error('number')
  }
  console.log('reconciliation-no-duplicate.verify: ok')
}

void runReconciliationNoDuplicateChecks()
