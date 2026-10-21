import { createSaleInvoiceForUser, generateSaleInvoicePdfForUser } from './sales-invoices'
import { assert, setupInvoiceOrg } from './sale-invoice-pdf.verify-support'

export async function runSaleInvoiceNoDuplicateChecks(): Promise<void> {
  const ctx = setupInvoiceOrg('org-pdf-no-dup', 'ТОО БезДубля', '000000000003')
  const first = createSaleInvoiceForUser(ctx.persistence, ctx.owner, { saleId: ctx.saleId })
  assert(first.ok, 'first invoice')
  const number = first.value.invoiceNumber
  const duplicate = createSaleInvoiceForUser(ctx.persistence, ctx.owner, { saleId: ctx.saleId })
  assert(duplicate.ok && duplicate.value.id === first.value.id, 'no second invoice')
  const openOnce = await generateSaleInvoicePdfForUser(
    ctx.persistence,
    ctx.owner,
    first.value.id,
  )
  const openTwice = await generateSaleInvoicePdfForUser(
    ctx.persistence,
    ctx.owner,
    first.value.id,
  )
  assert(openOnce.ok && openTwice.ok, 'repeated open')
  assert(openOnce.value.filename.includes(`№${number}`), 'first open same number')
  assert(openTwice.value.filename.includes(`№${number}`), 'second open same number')
  assert(
    ctx.persistence.saleInvoices.list(ctx.orgId).filter((item) => item.saleId === ctx.saleId)
      .length === 1,
    'still one invoice',
  )
  console.log('sale-invoice-no-duplicate.verify: ok')
}

void runSaleInvoiceNoDuplicateChecks()
