import { createSaleInvoiceForUser, generateSaleInvoicePdfForUser } from './sales-invoices'
import { saleInvoicePdfBlob } from '../pdf/sale-invoice-pdf'
import { assert, isPdfBytes, setupInvoiceOrg } from './sale-invoice-pdf.verify-support'

export async function runSaleInvoicePdfBlobChecks(): Promise<void> {
  const ctx = setupInvoiceOrg('org-pdf-blob', 'ТОО Blob', '000000000003')
  const invoice = createSaleInvoiceForUser(ctx.persistence, ctx.owner, { saleId: ctx.saleId })
  assert(invoice.ok, 'invoice')
  const pdf = await generateSaleInvoicePdfForUser(
    ctx.persistence,
    ctx.owner,
    invoice.value.id,
  )
  assert(pdf.ok, 'pdf')
  assert(isPdfBytes(pdf.value.bytes), '%PDF header')
  const blob = saleInvoicePdfBlob(pdf.value.bytes)
  assert(blob.type === 'application/pdf', 'application/pdf')
  assert(blob.size === pdf.value.bytes.byteLength, 'blob size')
  console.log('sale-invoice-pdf-blob.verify: ok')
}

void runSaleInvoicePdfBlobChecks()
