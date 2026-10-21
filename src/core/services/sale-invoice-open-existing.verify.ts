import {
  createSaleInvoiceForUser,
  generateSaleInvoicePdfForUser,
} from './sales-invoices'
import { isPdfBytes, assert, setupInvoiceOrg } from './sale-invoice-pdf.verify-support'

export async function runSaleInvoiceOpenExistingChecks(): Promise<void> {
  const ctx = setupInvoiceOrg('org-pdf-open-existing', 'ТОО ОткрытьСуществующий', '000000000003')
  const invoice = createSaleInvoiceForUser(ctx.persistence, ctx.owner, { saleId: ctx.saleId })
  assert(invoice.ok, 'invoice created once')
  const pdf = await generateSaleInvoicePdfForUser(
    ctx.persistence,
    ctx.owner,
    invoice.value.id,
  )
  assert(pdf.ok, 'open uses existing invoiceId')
  assert(isPdfBytes(pdf.value.bytes), 'application/pdf bytes')
  assert(pdf.value.filename.includes(`№${invoice.value.invoiceNumber}`), 'existing number')
  const listed = ctx.persistence.saleInvoices.list(ctx.orgId)
  assert(listed.filter((item) => item.saleId === ctx.saleId).length === 1, 'no extra invoice')
  console.log('sale-invoice-open-existing.verify: ok')
}

void runSaleInvoiceOpenExistingChecks()
