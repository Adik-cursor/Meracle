import { createDeliveryNoteForUser } from './delivery-notes'
import { renderDeliveryNotePdfWithLayout } from '../pdf/delivery-note-pdf'
import { buildDeliveryNoteDocumentForUser } from './delivery-notes'
import { completeSeededSale, setupInvoiceOrg, texts } from './delivery-documents.verify-support'

export async function runDeliveryNoteZ2Checks(): Promise<void> {
  const ctx = completeSeededSale(setupInvoiceOrg('org-dn-z2', 'ТОО ФормаЗ2', '000000000006'))
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
  for (const label of [
    'Приложение 26',
    'Форма З-2',
    'НАКЛАДНАЯ НА ОТПУСК ЗАПАСОВ НА СТОРОНУ',
    'отправитель',
    'получатель',
    '№',
    'Наименование, характеристика',
    'Номенклатурный',
    'Единица',
    'подлежит',
    'отпуску',
    'отпущено',
    'Цена за единицу',
    'Сумма с НДС',
    'Сумма НДС',
  ]) {
    if (!joined.includes(label)) {
      throw new Error(label)
    }
  }
  const headers = layout.boxes.filter((box) => box.block === 'products-header')
  if (headers.filter((box) => box.text === '1' || box.text === '9').length < 2) {
    throw new Error('nine columns')
  }
  console.log('delivery-note-z2.verify: ok')
}

void runDeliveryNoteZ2Checks()
