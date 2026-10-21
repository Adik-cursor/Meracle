import {
  buildSaleInvoiceDocumentForUser,
  createSaleInvoiceForUser,
} from './sales-invoices'
import { renderSaleInvoicePdfWithLayout } from '../pdf/sale-invoice-pdf'
import { assert, setupInvoiceOrg } from './sale-invoice-pdf.verify-support'

export async function runInvoiceKbeKnpMappingChecks(): Promise<void> {
  const ctx = setupInvoiceOrg('org-kbe-map', 'ТОО КартаКБе', '000000000003')
  ctx.persistence.organizations.update(ctx.orgId, { kbe: '19', knp: '710' })
  const invoice = createSaleInvoiceForUser(ctx.persistence, ctx.owner, { saleId: ctx.saleId })
  assert(invoice.ok, 'invoice')
  const doc = buildSaleInvoiceDocumentForUser(ctx.persistence, ctx.owner, invoice.value.id)
  assert(doc.ok, 'document')
  assert(doc.value.supplier.kbe === '19', 'PDF.KБе = organization.kbe')
  assert(doc.value.supplier.knp === '710', 'PDF.KНП = organization.knp')
  const layout = await renderSaleInvoicePdfWithLayout(doc.value)
  const payment = layout.boxes.filter((box) => box.block === 'payment').map((box) => box.text)
  assert(payment.includes('19'), 'kbe in pdf')
  assert(payment.includes('710'), 'knp in pdf')
  console.log('invoice-kbe-knp-mapping.verify: ok')
}

void runInvoiceKbeKnpMappingChecks()
