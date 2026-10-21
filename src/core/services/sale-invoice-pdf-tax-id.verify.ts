import {
  buildSaleInvoiceDocumentForUser,
  createSaleInvoiceForUser,
} from './sales-invoices'
import { assert, setupInvoiceOrg } from './sale-invoice-pdf.verify-support'

export function runSaleInvoicePdfTaxIdChecks(): void {
  const ctx = setupInvoiceOrg('org-pdf-tax', 'ТОО Поставщик', '000000000003')
  const sale = ctx.persistence.sales.getById(ctx.saleId)
  const customer = sale?.customerId
    ? ctx.persistence.customers.getById(sale.customerId)
    : undefined
  assert(customer?.taxId === '000000000004', 'customer tax seeded')
  const invoice = createSaleInvoiceForUser(ctx.persistence, ctx.owner, { saleId: ctx.saleId })
  assert(invoice.ok, 'invoice')
  const doc = buildSaleInvoiceDocumentForUser(ctx.persistence, ctx.owner, invoice.value.id)
  assert(doc.ok, 'document')
  const supplierTax = String(doc.value.supplier.taxId ?? '')
  const buyerTax = String(doc.value.buyer.taxId ?? '')
  const distinctTaxes = supplierTax !== buyerTax
  assert(supplierTax === '000000000003', 'org tax')
  assert(buyerTax === '000000000004', 'customer tax')
  assert(distinctTaxes, 'distinct tax ids')
  assert(doc.value.supplierTaxLabel === 'БИН', 'too uses bin')
  assert(doc.value.buyer.taxLabel === 'ИИН', 'person uses iin')
  console.log('sale-invoice-pdf-tax-id.verify: ok')
}

runSaleInvoicePdfTaxIdChecks()
