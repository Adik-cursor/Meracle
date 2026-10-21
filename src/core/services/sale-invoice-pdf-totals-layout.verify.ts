import {
  buildSaleInvoiceDocumentForUser,
  createSaleInvoiceForUser,
} from './sales-invoices'
import { renderSaleInvoicePdfWithLayout } from '../pdf/sale-invoice-pdf'
import { formatInvoiceMoney } from '../pdf/invoice-format'
import { assert, setupInvoiceOrg } from './sale-invoice-pdf.verify-support'

export async function runSaleInvoicePdfTotalsLayoutChecks(): Promise<void> {
  const ctx = setupInvoiceOrg('org-pdf-totals-layout', 'ТОО Итоги', '000000000003')
  const invoice = createSaleInvoiceForUser(ctx.persistence, ctx.owner, { saleId: ctx.saleId })
  assert(invoice.ok, 'invoice')
  const doc = buildSaleInvoiceDocumentForUser(ctx.persistence, ctx.owner, invoice.value.id)
  assert(doc.ok, 'document')
  const layout = await renderSaleInvoicePdfWithLayout(doc.value)
  const totals = layout.boxes.filter((box) => box.block === 'totals')
  const joined = totals.map((box) => box.text).join(' ')
  assert(joined.includes('Итого:'), 'total label')
  assert(joined.includes('В том числе НДС:'), 'vat')
  assert(joined.includes('Всего наименований'), 'item count')
  assert(joined.includes('Всего к оплате:'), 'amount words')
  assert(joined.includes(formatInvoiceMoney(doc.value.invoice.total)), 'money format')
  const products = layout.boxes.filter((box) => box.block === 'products' || box.block === 'products-header')
  assert((products[0]?.y ?? 0) > (totals[0]?.y ?? 0), 'totals below products')
  console.log('sale-invoice-pdf-totals-layout.verify: ok')
}

void runSaleInvoicePdfTotalsLayoutChecks()
