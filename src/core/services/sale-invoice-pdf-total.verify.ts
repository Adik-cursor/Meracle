import {
  buildSaleInvoiceDocumentForUser,
  createSaleInvoiceForUser,
} from './sales-invoices'
import { formatInvoiceMoney } from '../pdf/invoice-format'
import { assert, setupInvoiceOrg } from './sale-invoice-pdf.verify-support'

export function runSaleInvoicePdfTotalChecks(): void {
  const ctx = setupInvoiceOrg('org-pdf-total', 'ТОО Итого', '000000000003')
  const invoice = createSaleInvoiceForUser(ctx.persistence, ctx.owner, { saleId: ctx.saleId })
  assert(invoice.ok, 'invoice')
  const doc = buildSaleInvoiceDocumentForUser(ctx.persistence, ctx.owner, invoice.value.id)
  assert(doc.ok, 'document')
  assert(doc.value.invoice.total === 100, 'total')
  assert(formatInvoiceMoney(20230000) === '20 230 000,00', 'money format')
  assert(doc.value.vatLabel === 'Без НДС', 'vat')
  assert(doc.value.itemCount === 1, 'count')
  console.log('sale-invoice-pdf-total.verify: ok')
}

runSaleInvoicePdfTotalChecks()
