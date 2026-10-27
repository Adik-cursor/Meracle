import {
  buildSaleInvoiceDocumentForUser,
  createSaleInvoiceForUser,
} from './sales-invoices'
import { assert, setupInvoiceOrg } from './sale-invoice-pdf.verify-support'

export function runSaleInvoicePdfBankDetailsChecks(): void {
  const ctx = setupInvoiceOrg('org-pdf-bank', 'ТОО Банк', '000000000003')
  const invoice = createSaleInvoiceForUser(ctx.persistence, ctx.owner, { saleId: ctx.saleId })
  assert(invoice.ok, 'invoice')
  const doc = buildSaleInvoiceDocumentForUser(ctx.persistence, ctx.owner, invoice.value.id)
  assert(doc.ok, 'document')
  assert(doc.value.supplier.bankName === 'АО Тест Банк', 'bank')
  assert(doc.value.supplier.iban === 'KZ070000000000000000', 'iban')
  assert(doc.value.supplier.bik === 'TESTKZKA', 'bik')
  assert(doc.value.supplier.kbe === '17', 'kbe')
  assert(doc.value.supplier.knp === '710', 'knp')
  console.log('sale-invoice-pdf-bank-details.verify: ok')
}

runSaleInvoicePdfBankDetailsChecks()
