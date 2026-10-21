import {
  buildSaleInvoiceDocumentForUser,
  createSaleInvoiceForUser,
} from './sales-invoices'
import { assert, setupInvoiceOrg } from './sale-invoice-pdf.verify-support'

export function runSaleInvoicePdfProductsChecks(): void {
  const ctx = setupInvoiceOrg('org-pdf-items', 'ТОО Товары', '000000000003')
  const invoice = createSaleInvoiceForUser(ctx.persistence, ctx.owner, { saleId: ctx.saleId })
  assert(invoice.ok, 'invoice')
  const doc = buildSaleInvoiceDocumentForUser(ctx.persistence, ctx.owner, invoice.value.id)
  assert(doc.ok, 'document')
  assert(doc.value.items.length === 1, 'sale items')
  assert(doc.value.items[0]?.name === 'Товар', 'product name')
  assert(doc.value.items[0]?.sku === 'SKU-1', 'sku')
  assert(doc.value.items[0]?.quantity === 1, 'qty')
  console.log('sale-invoice-pdf-products.verify: ok')
}

runSaleInvoicePdfProductsChecks()
