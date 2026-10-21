import {
  createReconciliationStatementForUser,
  generateReconciliationStatementPdfForUser,
} from './reconciliation-statements'
import { completeSeededSale, isPdfBytes, setupInvoiceOrg } from './delivery-documents.verify-support'

export async function runReconciliationPdfChecks(): Promise<void> {
  const ctx = completeSeededSale(setupInvoiceOrg('org-rec-pdf', 'ТОО RecPdf', '000000000003'))
  const created = createReconciliationStatementForUser(ctx.persistence, ctx.owner, {
    customerId: ctx.customerId,
    dateFrom: '2020-01-01',
    dateTo: '2030-12-31',
    documentDate: '2026-08-27',
  })
  if (!created.ok) {
    throw new Error(created.error.code)
  }
  const pdf = await generateReconciliationStatementPdfForUser(
    ctx.persistence,
    ctx.owner,
    created.value.id,
  )
  if (!pdf.ok || !isPdfBytes(pdf.value.bytes) || pdf.value.mimeType !== 'application/pdf') {
    throw new Error('pdf')
  }
  console.log('reconciliation-pdf.verify: ok')
}

void runReconciliationPdfChecks()
