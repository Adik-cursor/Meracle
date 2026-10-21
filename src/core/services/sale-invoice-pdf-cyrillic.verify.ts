import { createSaleInvoiceForUser, generateSaleInvoicePdfForUser } from './sales-invoices'
import { assert, setupInvoiceOrg } from './sale-invoice-pdf.verify-support'

export async function runSaleInvoicePdfCyrillicChecks(): Promise<void> {
  const ctx = setupInvoiceOrg('org-pdf-cyr', 'ТОО Кириллица', '000000000003')
  const invoice = createSaleInvoiceForUser(ctx.persistence, ctx.owner, { saleId: ctx.saleId })
  assert(invoice.ok, 'invoice')
  const pdf = await generateSaleInvoicePdfForUser(ctx.persistence, ctx.owner, invoice.value.id)
  assert(pdf.ok, 'pdf')
  const latin1 = new TextDecoder('latin1').decode(pdf.value.bytes)
  assert(
    /FontFile2|FontFile3|CIDFontType2|Identity-H|Type0/.test(latin1),
    'embedded unicode font',
  )
  console.log('sale-invoice-pdf-cyrillic.verify: ok')
}

void runSaleInvoicePdfCyrillicChecks()
