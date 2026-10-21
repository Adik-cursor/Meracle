import { createSaleInvoiceForUser, generateSaleInvoicePdfForUser } from './sales-invoices'
import { assert, setupInvoiceOrg } from './sale-invoice-pdf.verify-support'

export async function runSaleInvoicePdfNoDuplicateNumberChecks(): Promise<void> {
  const ctx = setupInvoiceOrg('org-pdf-num', 'ТОО Номер', '000000000003')
  const invoice = createSaleInvoiceForUser(ctx.persistence, ctx.owner, { saleId: ctx.saleId })
  assert(invoice.ok, 'invoice')
  const number = invoice.value.invoiceNumber
  const first = await generateSaleInvoicePdfForUser(ctx.persistence, ctx.owner, invoice.value.id)
  const second = await generateSaleInvoicePdfForUser(ctx.persistence, ctx.owner, invoice.value.id)
  assert(first.ok && second.ok, 'pdf twice')
  const listed = ctx.persistence.saleInvoices.list(ctx.orgId)
  assert(listed.filter((item) => item.saleId === ctx.saleId).length === 1, 'one invoice')
  assert(first.value.filename.includes(`№${number}`), 'first name')
  assert(second.value.filename.includes(`№${number}`), 'same number')
  console.log('sale-invoice-pdf-no-duplicate-number.verify: ok')
}

void runSaleInvoicePdfNoDuplicateNumberChecks()
