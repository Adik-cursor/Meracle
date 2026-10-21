import { createSaleInvoiceForUser, generateSaleInvoicePdfForUser } from './sales-invoices'
import {
  addManySaleItems,
  assert,
  readPdfMeta,
  setupInvoiceOrg,
} from './sale-invoice-pdf.verify-support'

export async function runSaleInvoicePdfMultipageChecks(): Promise<void> {
  const ctx = setupInvoiceOrg('org-pdf-multi', 'ТОО Много', '000000000003')
  const sale = ctx.persistence.sales.getById(ctx.saleId)
  assert(sale?.customerId, 'customer')
  const large = addManySaleItems(
    ctx.persistence,
    ctx.orgId,
    ctx.owner,
    ctx.warehouseId,
    sale.customerId,
    40,
  )
  const invoice = createSaleInvoiceForUser(ctx.persistence, ctx.owner, { saleId: large.id })
  assert(invoice.ok, 'invoice')
  const pdf = await generateSaleInvoicePdfForUser(ctx.persistence, ctx.owner, invoice.value.id)
  assert(pdf.ok, 'pdf')
  const meta = await readPdfMeta(pdf.value.bytes)
  assert(meta.pageCount >= 2, 'second page for many rows')
  console.log('sale-invoice-pdf-multipage.verify: ok')
}

void runSaleInvoicePdfMultipageChecks()
