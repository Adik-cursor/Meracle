import {
  createSaleInvoiceForUser,
  generateSaleInvoicePdfForUser,
  listSaleInvoicesForUser,
} from './sales-invoices'
import { assert, isPdfBytes, setupInvoiceOrg } from './sale-invoice-pdf.verify-support'

export async function runSaleInvoicePdfExistingInvoiceChecks(): Promise<void> {
  const ctx = setupInvoiceOrg('org-pdf-existing', 'ТОО Existing15', '000000000003')
  const created = createSaleInvoiceForUser(ctx.persistence, ctx.owner, { saleId: ctx.saleId })
  assert(created.ok, 'create once')
  const number = created.value.invoiceNumber
  const invoiceId = created.value.id
  const openPdf = await generateSaleInvoicePdfForUser(
    ctx.persistence,
    ctx.owner,
    invoiceId,
  )
  assert(openPdf.ok, 'open existing')
  assert(isPdfBytes(openPdf.value.bytes), 'open %PDF-')
  const downloadPdf = await generateSaleInvoicePdfForUser(
    ctx.persistence,
    ctx.owner,
    invoiceId,
  )
  assert(downloadPdf.ok, 'download existing')
  assert(isPdfBytes(downloadPdf.value.bytes), 'download %PDF-')
  const listed = listSaleInvoicesForUser(ctx.persistence, ctx.owner, ctx.saleId)
  assert(listed.ok, 'list')
  assert(listed.value.length === 1, 'no duplicate invoice')
  assert(listed.value[0]?.id === invoiceId, 'same invoice id')
  assert(listed.value[0]?.invoiceNumber === number, 'same invoice number')
  const duplicate = createSaleInvoiceForUser(ctx.persistence, ctx.owner, { saleId: ctx.saleId })
  assert(duplicate.ok && duplicate.value.id === invoiceId, 'open does not create')
  console.log('sale-invoice-pdf-existing-invoice.verify: ok')
}

void runSaleInvoicePdfExistingInvoiceChecks()
