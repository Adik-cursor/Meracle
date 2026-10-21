import {
  buildSaleInvoiceDocumentForUser,
  createSaleInvoiceForUser,
  generateSaleInvoicePdfForUser,
} from './sales-invoices'
import { assert, isPdfBytes, setupInvoiceOrg } from './sale-invoice-pdf.verify-support'

export async function runSaleInvoicePdfEmptyKbeKnpChecks(): Promise<void> {
  const ctx = setupInvoiceOrg('org-pdf-empty-kbe', 'ТОО EmptyKbe', '000000000003')
  ctx.persistence.organizations.update(ctx.orgId, { kbe: '', knp: '' })
  const invoice = createSaleInvoiceForUser(ctx.persistence, ctx.owner, { saleId: ctx.saleId })
  assert(invoice.ok, 'invoice')
  const doc = buildSaleInvoiceDocumentForUser(ctx.persistence, ctx.owner, invoice.value.id)
  assert(doc.ok, 'empty kbe/knp does not block document')
  assert(doc.value.supplier.kbe === '', 'kbe empty')
  assert(doc.value.supplier.knp === '', 'knp empty')
  const pdf = await generateSaleInvoicePdfForUser(
    ctx.persistence,
    ctx.owner,
    invoice.value.id,
  )
  assert(pdf.ok, 'pdf with empty kbe/knp')
  assert(isPdfBytes(pdf.value.bytes), '%PDF-')
  console.log('sale-invoice-pdf-empty-kbe-knp.verify: ok')
}

void runSaleInvoicePdfEmptyKbeKnpChecks()
