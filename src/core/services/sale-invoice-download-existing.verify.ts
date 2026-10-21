import {
  createSaleInvoiceForUser,
  generateSaleInvoicePdfForUser,
} from './sales-invoices'
import { saleInvoicePdfBlob } from '../pdf/sale-invoice-pdf'
import { assert, isPdfBytes, setupInvoiceOrg } from './sale-invoice-pdf.verify-support'

export async function runSaleInvoiceDownloadExistingChecks(): Promise<void> {
  const ctx = setupInvoiceOrg('org-pdf-dl-existing', 'ТОО СкачатьСуществующий', '000000000003')
  const invoice = createSaleInvoiceForUser(ctx.persistence, ctx.owner, { saleId: ctx.saleId })
  assert(invoice.ok, 'invoice')
  const pdf = await generateSaleInvoicePdfForUser(
    ctx.persistence,
    ctx.owner,
    invoice.value.id,
  )
  assert(pdf.ok, 'download uses existing invoiceId')
  assert(isPdfBytes(pdf.value.bytes), 'pdf bytes')
  assert(pdf.value.mimeType === 'application/pdf', 'mime')
  const blob = saleInvoicePdfBlob(pdf.value.bytes)
  assert(blob.type === 'application/pdf', 'blob type')
  assert(pdf.value.filename.endsWith('.pdf'), 'download name')
  assert(pdf.value.filename.includes(`№${invoice.value.invoiceNumber}`), 'same number')
  console.log('sale-invoice-download-existing.verify: ok')
}

void runSaleInvoiceDownloadExistingChecks()
