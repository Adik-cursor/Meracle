import { createDeliveryNoteForUser } from './delivery-notes'
import { renderDeliveryNotePdfWithLayout } from '../pdf/delivery-note-pdf'
import { buildDeliveryNoteDocumentForUser } from './delivery-notes'
import { completeSeededSale, setupInvoiceOrg, texts } from './delivery-documents.verify-support'

export async function runDeliveryNoteKzChecks(): Promise<void> {
  const ctx = completeSeededSale(setupInvoiceOrg('org-dn-kz', 'ТОО Казахстан', '000000000006'))
  const created = createDeliveryNoteForUser(ctx.persistence, ctx.owner, { saleId: ctx.saleId })
  if (!created.ok) {
    throw new Error('create')
  }
  if (created.value.currency !== 'KZT') {
    throw new Error('currency')
  }
  if (created.value.customerId !== ctx.customerId) {
    throw new Error('one customer')
  }
  if (created.value.shipper.taxId !== '000000000006') {
    throw new Error('org tax')
  }
  if (created.value.consignee.taxId !== '000000000004') {
    throw new Error('customer tax')
  }
  const qty = created.value.items[0]?.quantity
  if (qty !== 1) {
    throw new Error('qty')
  }
  const doc = buildDeliveryNoteDocumentForUser(ctx.persistence, ctx.owner, created.value.id)
  if (!doc.ok) {
    throw new Error('doc')
  }
  const layout = await renderDeliveryNotePdfWithLayout(doc.value)
  const joined = texts(layout.boxes).join('|')
  if (joined.includes('ОКПО') || joined.includes('ОКУД') || joined.includes('руб.') || joined.includes('ТОРГ-12')) {
    throw new Error('no russia')
  }
  if (!joined.includes('Форма З-2') || !joined.includes('KZT')) {
    throw new Error('z2 kzt')
  }
  if (!joined.includes('000000000006')) {
    throw new Error('tax ids in pdf')
  }
  if (!joined.includes('подлежит') || !joined.includes('отпущено')) {
    throw new Error('qty columns')
  }
  console.log('delivery-note-kz.verify: ok')
}

void runDeliveryNoteKzChecks()
