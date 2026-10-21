import { createSaleInvoiceForUser, generateSaleInvoicePdfForUser } from './sales-invoices'
import {
  addManySaleItems,
  assert,
  isPdfBytes,
  readPdfMeta,
  setupInvoiceOrg,
} from './sale-invoice-pdf.verify-support'

export async function runSaleInvoiceRealPdfChecks(): Promise<void> {
  const ctx = setupInvoiceOrg('org-pdf-real', 'ТОО Meracle', '000000000003')
  const invoice = createSaleInvoiceForUser(ctx.persistence, ctx.owner, { saleId: ctx.saleId })
  assert(invoice.ok, 'invoice')
  const first = invoice.value.invoiceNumber
  const pdf = await generateSaleInvoicePdfForUser(ctx.persistence, ctx.owner, invoice.value.id)
  assert(pdf.ok, 'generate pdf')
  assert(pdf.value.mimeType === 'application/pdf', 'mime')
  assert(pdf.value.filename.endsWith('.pdf'), 'extension')
  assert(isPdfBytes(pdf.value.bytes), 'binary pdf header')
  const meta = await readPdfMeta(pdf.value.bytes)
  assert(Math.abs(meta.width - 595.28) < 1, 'A4 width')
  assert(Math.abs(meta.height - 841.89) < 1, 'A4 height')
  assert(!meta.landscape, 'portrait')
  const again = await generateSaleInvoicePdfForUser(ctx.persistence, ctx.owner, invoice.value.id)
  assert(again.ok, 'reopen')
  assert(again.value.filename.includes(`№${first}`), 'same number in filename')

  const sale = ctx.persistence.sales.getById(ctx.saleId)
  assert(sale?.customerId, 'customer')
  const compact = addManySaleItems(
    ctx.persistence,
    ctx.orgId,
    ctx.owner,
    ctx.warehouseId,
    sale.customerId,
    16,
  )
  const compactInvoice = createSaleInvoiceForUser(ctx.persistence, ctx.owner, {
    saleId: compact.id,
  })
  assert(compactInvoice.ok, '16-row invoice')
  const compactPdf = await generateSaleInvoicePdfForUser(
    ctx.persistence,
    ctx.owner,
    compactInvoice.value.id,
  )
  assert(compactPdf.ok, '16-row pdf')
  const compactMeta = await readPdfMeta(compactPdf.value.bytes)
  assert(compactMeta.pageCount === 1, '16 items fit one A4 page')
  console.log('sale-invoice-real-pdf.verify: ok')
}

void runSaleInvoiceRealPdfChecks()
