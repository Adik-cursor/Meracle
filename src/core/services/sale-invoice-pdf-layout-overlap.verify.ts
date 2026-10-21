import {
  buildSaleInvoiceDocumentForUser,
  createSaleInvoiceForUser,
} from './sales-invoices'
import {
  findOverlappingInvoiceText,
  renderSaleInvoicePdfWithLayout,
} from '../pdf/sale-invoice-pdf'
import { assert, setupInvoiceOrg } from './sale-invoice-pdf.verify-support'

export async function runSaleInvoicePdfLayoutOverlapChecks(): Promise<void> {
  const ctx = setupInvoiceOrg('org-pdf-overlap', 'ТОО Meracle', '000000000003')
  const invoice = createSaleInvoiceForUser(ctx.persistence, ctx.owner, { saleId: ctx.saleId })
  assert(invoice.ok, 'invoice')
  const doc = buildSaleInvoiceDocumentForUser(ctx.persistence, ctx.owner, invoice.value.id)
  assert(doc.ok, 'document')
  const layout = await renderSaleInvoicePdfWithLayout(doc.value)
  const overlap = findOverlappingInvoiceText(layout.boxes)
  assert(!overlap, overlap ? `overlap ${overlap[0].text} / ${overlap[1].text}` : 'no overlap')
  console.log('sale-invoice-pdf-layout-overlap.verify: ok')
}

void runSaleInvoicePdfLayoutOverlapChecks()
