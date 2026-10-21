import {
  buildSaleInvoiceDocumentForUser,
  createSaleInvoiceForUser,
} from './sales-invoices'
import { renderSaleInvoicePdfWithLayout } from '../pdf/sale-invoice-pdf'
import { assert, setupInvoiceOrg } from './sale-invoice-pdf.verify-support'

export async function runInvoiceKbeKnpEmptyChecks(): Promise<void> {
  const ctx = setupInvoiceOrg('org-kbe-empty', 'ТОО ПустойКБе', '000000000003')
  ctx.persistence.organizations.update(ctx.orgId, { kbe: '', knp: '' })
  const invoice = createSaleInvoiceForUser(ctx.persistence, ctx.owner, { saleId: ctx.saleId })
  assert(invoice.ok, 'invoice without kbe/knp')
  const doc = buildSaleInvoiceDocumentForUser(ctx.persistence, ctx.owner, invoice.value.id)
  assert(doc.ok, 'empty kbe/knp does not block pdf')
  assert(doc.value.supplier.kbe === '', 'empty kbe')
  assert(doc.value.supplier.knp === '', 'empty knp')
  const layout = await renderSaleInvoicePdfWithLayout(doc.value)
  const payment = layout.boxes.filter((box) => box.block === 'payment').map((box) => box.text)
  assert(payment.includes('Кбе'), 'kbe cell exists')
  assert(payment.includes('КНП'), 'knp cell exists')
  assert(!payment.includes('19'), 'no default 19')
  assert(!payment.includes('710'), 'no default 710')
  console.log('invoice-kbe-knp-empty.verify: ok')
}

void runInvoiceKbeKnpEmptyChecks()
