import {
  buildSaleInvoiceDocumentForUser,
  createSaleInvoiceForUser,
} from './sales-invoices'
import { renderSaleInvoicePdfWithLayout } from '../pdf/sale-invoice-pdf'
import { assert, setupInvoiceOrg } from './sale-invoice-pdf.verify-support'

export async function runInvoiceKbeKnpUpdatedExistingChecks(): Promise<void> {
  const ctx = setupInvoiceOrg('org-kbe-live', 'ТОО ЖивыеРеквизиты', '000000000003')
  ctx.persistence.organizations.update(ctx.orgId, { kbe: '', knp: '' })
  const invoice = createSaleInvoiceForUser(ctx.persistence, ctx.owner, { saleId: ctx.saleId })
  assert(invoice.ok, 'existing invoice')
  const number = invoice.value.invoiceNumber
  const invoiceId = invoice.value.id

  const emptyDoc = buildSaleInvoiceDocumentForUser(ctx.persistence, ctx.owner, invoiceId)
  assert(emptyDoc.ok && emptyDoc.value.supplier.kbe === '', 'first pdf empty kbe')
  assert(emptyDoc.value.supplier.knp === '', 'first pdf empty knp')

  ctx.persistence.organizations.update(ctx.orgId, { kbe: '19', knp: '710' })
  const filledDoc = buildSaleInvoiceDocumentForUser(ctx.persistence, ctx.owner, invoiceId)
  assert(filledDoc.ok, 'same invoiceId')
  assert(filledDoc.value.invoice.id === invoiceId, 'did not create invoice')
  assert(filledDoc.value.invoice.invoiceNumber === number, 'number unchanged')
  assert(filledDoc.value.supplier.kbe === '19', 'live kbe 19')
  assert(filledDoc.value.supplier.knp === '710', 'live knp 710')
  const filledPdf = await renderSaleInvoicePdfWithLayout(filledDoc.value)
  const filledText = filledPdf.boxes.map((box) => box.text)
  assert(filledText.includes('19') && filledText.includes('710'), 'pdf uses current org')

  ctx.persistence.organizations.update(ctx.orgId, { kbe: '20', knp: '710' })
  const updatedDoc = buildSaleInvoiceDocumentForUser(ctx.persistence, ctx.owner, invoiceId)
  assert(updatedDoc.ok && updatedDoc.value.supplier.kbe === '20', 'kbe 20 after org change')
  assert(updatedDoc.value.invoice.invoiceNumber === number, 'still same number')
  const updatedPdf = await renderSaleInvoicePdfWithLayout(updatedDoc.value)
  const updatedText = updatedPdf.boxes.filter((box) => box.block === 'payment').map((box) => box.text)
  assert(updatedText.includes('20'), 'pdf shows 20')
  assert(!updatedText.includes('19'), 'old kbe not kept on invoice')
  assert(
    ctx.persistence.saleInvoices.list(ctx.orgId).filter((item) => item.saleId === ctx.saleId)
      .length === 1,
    'one invoice',
  )
  console.log('invoice-kbe-knp-updated-existing.verify: ok')
}

void runInvoiceKbeKnpUpdatedExistingChecks()
