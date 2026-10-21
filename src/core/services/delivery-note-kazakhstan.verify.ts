import { createDeliveryNoteForUser } from './delivery-notes'
import { renderDeliveryNotePdfWithLayout } from '../pdf/delivery-note-pdf'
import { buildDeliveryNoteDocumentForUser } from './delivery-notes'
import { completeSeededSale, setupInvoiceOrg, texts } from './delivery-documents.verify-support'

export async function runDeliveryNoteKazakhstanChecks(): Promise<void> {
  const ctx = completeSeededSale(setupInvoiceOrg('org-dn-kz-form', 'ТОО KZForm', '000000000006'))
  const created = createDeliveryNoteForUser(ctx.persistence, ctx.owner, { saleId: ctx.saleId })
  if (!created.ok) {
    throw new Error('create')
  }
  const doc = buildDeliveryNoteDocumentForUser(ctx.persistence, ctx.owner, created.value.id)
  if (!doc.ok) {
    throw new Error('doc')
  }
  const layout = await renderDeliveryNotePdfWithLayout(doc.value)
  const joined = texts(layout.boxes).join('|')
  if (!joined.includes('Республики Казахстан') || !joined.includes('KZT')) {
    throw new Error('kz')
  }
  if (created.value.currency !== 'KZT') {
    throw new Error('currency')
  }
  console.log('delivery-note-kazakhstan.verify: ok')
}

void runDeliveryNoteKazakhstanChecks()
