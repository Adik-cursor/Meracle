import {
  buildReconciliationDocumentForUser,
  createReconciliationStatementForUser,
} from './reconciliation-statements'
import { renderReconciliationStatementPdfWithLayout } from '../pdf/reconciliation-statement-pdf'
import { completeSeededSale, readPdfMeta, setupInvoiceOrg } from './delivery-documents.verify-support'

export async function runReconciliationA4PortraitChecks(): Promise<void> {
  const ctx = completeSeededSale(setupInvoiceOrg('org-rec-a4', 'ТОО RecA4', '000000000003'))
  const created = createReconciliationStatementForUser(ctx.persistence, ctx.owner, {
    customerId: ctx.customerId,
    dateFrom: '2020-01-01',
    dateTo: '2030-12-31',
    documentDate: '2026-08-27',
  })
  if (!created.ok) {
    throw new Error(created.error.code)
  }
  const doc = buildReconciliationDocumentForUser(ctx.persistence, ctx.owner, created.value.id)
  if (!doc.ok) {
    throw new Error('doc')
  }
  const layout = await renderReconciliationStatementPdfWithLayout(doc.value)
  const meta = await readPdfMeta(layout.bytes)
  if (Math.abs(meta.width - 595.28) > 0.2 || Math.abs(meta.height - 841.89) > 0.2) {
    throw new Error(`A4 portrait ${meta.width}x${meta.height}`)
  }
  if (meta.width >= meta.height) {
    throw new Error('not portrait')
  }
  if (layout.pageCount !== 1) {
    throw new Error(`pages ${layout.pageCount}`)
  }
  console.log(`reconciliation-a4-portrait.verify: ok ${meta.width}x${meta.height} pages=${layout.pageCount}`)
}

void runReconciliationA4PortraitChecks()
