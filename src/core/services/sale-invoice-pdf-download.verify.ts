import { createSaleInvoiceForUser, generateSaleInvoicePdfForUser } from './sales-invoices'
import { saleInvoicePdfBlob } from '../pdf/sale-invoice-pdf'
import { assert, setupInvoiceOrg } from './sale-invoice-pdf.verify-support'

export async function runSaleInvoicePdfDownloadChecks(): Promise<void> {
  const ctx = setupInvoiceOrg('org-pdf-dl', 'ТОО Скачать', '000000000003')
  const invoice = createSaleInvoiceForUser(ctx.persistence, ctx.owner, { saleId: ctx.saleId })
  assert(invoice.ok, 'invoice')
  const pdf = await generateSaleInvoicePdfForUser(ctx.persistence, ctx.owner, invoice.value.id)
  assert(pdf.ok, 'pdf')
  assert(pdf.value.filename.startsWith('Счёт на оплату №'), 'filename')
  assert(pdf.value.filename.endsWith('.pdf'), 'pdf ext')
  const blob = saleInvoicePdfBlob(pdf.value.bytes)
  assert(blob.type === 'application/pdf', 'blob mime')
  console.log('sale-invoice-pdf-download.verify: ok')
}

void runSaleInvoicePdfDownloadChecks()
