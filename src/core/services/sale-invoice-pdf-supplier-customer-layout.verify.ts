import {
  buildSaleInvoiceDocumentForUser,
  createSaleInvoiceForUser,
} from './sales-invoices'
import { renderSaleInvoicePdfWithLayout } from '../pdf/sale-invoice-pdf'
import { assert, setupInvoiceOrg } from './sale-invoice-pdf.verify-support'

export async function runSaleInvoicePdfSupplierCustomerLayoutChecks(): Promise<void> {
  const ctx = setupInvoiceOrg('org-pdf-parties', 'ТОО Поставщик', '000000000003')
  const invoice = createSaleInvoiceForUser(ctx.persistence, ctx.owner, { saleId: ctx.saleId })
  assert(invoice.ok, 'invoice')
  const doc = buildSaleInvoiceDocumentForUser(ctx.persistence, ctx.owner, invoice.value.id)
  assert(doc.ok, 'document')
  const layout = await renderSaleInvoicePdfWithLayout(doc.value)
  const supplier = layout.boxes.filter((box) => box.block === 'supplier')
  const customer = layout.boxes.filter((box) => box.block === 'customer')
  const contract = layout.boxes.filter((box) => box.block === 'contract')
  assert(supplier[0] && customer[0] && contract[0], 'party blocks')
  assert(supplier[0].y > customer[0].y, 'supplier above customer')
  assert(customer[0].y > contract[0].y, 'customer above contract')
  assert(customer.some((box) => box.text.includes(doc.value.buyer.taxId ?? '')), 'buyer tax')
  assert(supplier.some((box) => box.text.includes(doc.value.supplier.taxId ?? '')), 'supplier tax')
  assert(supplier.some((box) => box.text.includes('ИИН/БИН')), 'supplier tax prefix')
  console.log('sale-invoice-pdf-supplier-customer-layout.verify: ok')
}

void runSaleInvoicePdfSupplierCustomerLayoutChecks()
