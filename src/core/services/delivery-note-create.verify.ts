import { checkoutOnCreditForUser } from './checkout-on-credit'
import { createDeliveryNoteForUser, findActiveDeliveryNoteForUser } from './delivery-notes'
import { assert, setupInvoiceOrg } from './delivery-documents.verify-support'

export function runDeliveryNoteCreateChecks(): void {
  const ctx = setupInvoiceOrg('org-dn-create', 'ТОО Накладная', '000000000003')
  const draft = createDeliveryNoteForUser(ctx.persistence, ctx.owner, { saleId: ctx.saleId })
  assert(!draft.ok && draft.error.code === 'SALE_NOT_COMPLETED', 'draft sale blocked')
  const credited = checkoutOnCreditForUser(ctx.persistence, ctx.owner, ctx.orgId, ctx.saleId)
  assert(credited.ok, 'completed')
  const created = createDeliveryNoteForUser(ctx.persistence, ctx.owner, { saleId: ctx.saleId })
  assert(created.ok, 'create note')
  assert(created.value.documentNumber === '1', 'org sequence')
  assert(created.value.saleId === ctx.saleId, 'sale link')
  assert(created.value.shipper.taxId === '000000000003', 'org snapshot')
  assert(created.value.consignee.taxId === '000000000004', 'customer snapshot')
  const found = findActiveDeliveryNoteForUser(ctx.persistence, ctx.owner, ctx.saleId)
  assert(found.ok && found.value?.id === created.value.id, 'find active')
  console.log('delivery-note-create.verify: ok')
}

runDeliveryNoteCreateChecks()
