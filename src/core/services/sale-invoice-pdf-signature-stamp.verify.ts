import {
  buildSaleInvoiceDocumentForUser,
  createSaleInvoiceForUser,
} from './sales-invoices'
import { renderSaleInvoicePdfWithLayout } from '../pdf/sale-invoice-pdf'
import { assert, setupInvoiceOrg } from './sale-invoice-pdf.verify-support'

export async function runSaleInvoicePdfSignatureStampChecks(): Promise<void> {
  const ctx = setupInvoiceOrg('org-pdf-sign', 'ТОО Подпись', '000000000003')
  const invoice = createSaleInvoiceForUser(ctx.persistence, ctx.owner, { saleId: ctx.saleId })
  assert(invoice.ok, 'invoice')
  const doc = buildSaleInvoiceDocumentForUser(ctx.persistence, ctx.owner, invoice.value.id)
  assert(doc.ok, 'document')
  const layout = await renderSaleInvoicePdfWithLayout(doc.value)
  const signature = layout.boxes.filter((box) => box.block === 'signature')
  const payment = layout.boxes.filter((box) => box.block === 'payment')
  const products = layout.boxes.filter((box) => box.block === 'products')
  assert(signature.some((box) => box.text.startsWith('Исполнитель')), 'executor')
  assert((signature[0]?.y ?? 0) < (products[0]?.y ?? 0), 'signature below products')
  assert((signature[0]?.y ?? 0) < (payment[0]?.y ?? 0), 'signature below payment table')
  assert(layout.pageCount >= 1, 'page')
  console.log('sale-invoice-pdf-signature-stamp.verify: ok')
}

void runSaleInvoicePdfSignatureStampChecks()
