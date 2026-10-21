import { createDeliveryNoteForUser } from './delivery-notes'
import { renderDeliveryNotePdfWithLayout } from '../pdf/delivery-note-pdf'
import { buildDeliveryNoteDocumentForUser } from './delivery-notes'
import { completeSeededSale, setupInvoiceOrg, texts } from './delivery-documents.verify-support'

export async function runDeliveryNoteNoRussianDataChecks(): Promise<void> {
  const ctx = completeSeededSale(setupInvoiceOrg('org-dn-ru', 'ТОО NoRU', '000000000003'))
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
  for (const banned of [
    'ОКПО',
    'ОКУД',
    'ОКЕИ',
    'ОКДП',
    'Госкомстат',
    'России',
    'Российская',
    'руб.',
    'RUB',
    'КПП',
    'ТОРГ-12',
  ]) {
    if (joined.includes(banned)) {
      throw new Error(banned)
    }
  }
  console.log('delivery-note-no-russian-data.verify: ok')
}

void runDeliveryNoteNoRussianDataChecks()
