import { createDeliveryNoteForUser, generateDeliveryNotePdfForUser, listDeliveryNotesForUser } from './delivery-notes'
import { completeSeededSale, setupInvoiceOrg } from './delivery-documents.verify-support'

export async function runDeliveryNoteNoDuplicateChecks(): Promise<void> {
  const ctx = completeSeededSale(setupInvoiceOrg('org-dn-nodup', 'ТОО DupNakl', '000000000003'))
  const created = createDeliveryNoteForUser(ctx.persistence, ctx.owner, { saleId: ctx.saleId })
  if (!created.ok) {
    throw new Error('create')
  }
  const number = created.value.documentNumber
  await generateDeliveryNotePdfForUser(ctx.persistence, ctx.owner, created.value.id)
  await generateDeliveryNotePdfForUser(ctx.persistence, ctx.owner, created.value.id)
  const listed = listDeliveryNotesForUser(ctx.persistence, ctx.owner, ctx.saleId)
  if (!listed.ok || listed.value.length !== 1) {
    throw new Error('duplicate pdf')
  }
  if (listed.value[0]?.documentNumber !== number) {
    throw new Error('number changed')
  }
  const second = createDeliveryNoteForUser(ctx.persistence, ctx.owner, { saleId: ctx.saleId })
  if (!second.ok || second.value.id !== created.value.id) {
    throw new Error('second create')
  }
  console.log('delivery-note-no-duplicate.verify: ok')
}

void runDeliveryNoteNoDuplicateChecks()
