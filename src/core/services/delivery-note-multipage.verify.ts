import { createDeliveryNoteForUser, generateDeliveryNotePdfForUser } from './delivery-notes'
import { checkoutOnCreditForUser } from './checkout-on-credit'
import {
  addManySaleItems,
  readPdfMeta,
  setupInvoiceOrg,
} from './delivery-documents.verify-support'

export async function runDeliveryNoteMultipageChecks(): Promise<void> {
  const ctx = setupInvoiceOrg('org-dn-multi', 'ТОО MultiNakl', '000000000003')
  const sale = ctx.persistence.sales.getById(ctx.saleId)
  if (!sale?.customerId) {
    throw new Error('customer')
  }
  const large = addManySaleItems(
    ctx.persistence,
    ctx.orgId,
    ctx.owner,
    ctx.warehouseId,
    sale.customerId,
    40,
  )
  const credited = checkoutOnCreditForUser(ctx.persistence, ctx.owner, ctx.orgId, large.id)
  if (!credited.ok) {
    throw new Error('complete')
  }
  const created = createDeliveryNoteForUser(ctx.persistence, ctx.owner, { saleId: large.id })
  if (!created.ok) {
    throw new Error('create')
  }
  const pdf = await generateDeliveryNotePdfForUser(ctx.persistence, ctx.owner, created.value.id)
  if (!pdf.ok) {
    throw new Error('pdf')
  }
  const meta = await readPdfMeta(pdf.value.bytes)
  if (meta.pageCount < 2) {
    throw new Error('pages')
  }
  console.log('delivery-note-multipage.verify: ok')
}

void runDeliveryNoteMultipageChecks()
