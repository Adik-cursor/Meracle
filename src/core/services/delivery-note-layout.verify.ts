import { createDeliveryNoteForUser } from './delivery-notes'
import { renderDeliveryNotePdfWithLayout } from '../pdf/delivery-note-pdf'
import { buildDeliveryNoteDocumentForUser } from './delivery-notes'
import {
  completeSeededSale,
  firstY,
  readPdfMeta,
  setupInvoiceOrg,
  texts,
} from './delivery-documents.verify-support'

export async function runDeliveryNoteLayoutChecks(): Promise<void> {
  const ctx = completeSeededSale(setupInvoiceOrg('org-dn-layout', 'ТОО LayoutNakl', '000000000003'))
  const created = createDeliveryNoteForUser(ctx.persistence, ctx.owner, { saleId: ctx.saleId })
  if (!created.ok) {
    throw new Error('create')
  }
  const doc = buildDeliveryNoteDocumentForUser(ctx.persistence, ctx.owner, created.value.id)
  if (!doc.ok) {
    throw new Error('doc')
  }
  const layout = await renderDeliveryNotePdfWithLayout(doc.value)
  const meta = await readPdfMeta(layout.bytes)
  if (Math.abs(meta.width - 841.89) > 0.2 || Math.abs(meta.height - 595.28) > 0.2) {
    throw new Error('A4 landscape')
  }
  const joined = texts(layout.boxes).join('|')
  for (const banned of ['ОКПО', 'ОКУД', 'ОКЕИ', 'ОКДП', 'Госкомстат', 'России', 'руб.', 'КПП', 'ТОРГ-12']) {
    if (joined.includes(banned)) {
      throw new Error(`russian ${banned}`)
    }
  }
  for (const label of [
    'Приложение 26',
    'Форма З-2',
    'Республики Казахстан',
    'ИИН/БИН',
    'НАКЛАДНАЯ НА ОТПУСК ЗАПАСОВ НА СТОРОНУ',
    'отправитель',
    'получатель',
    'Наименование, характеристика',
    'Номенклатурный',
    'подлежит',
    'отпуску',
    'отпущено',
    'в KZT',
    'Отпуск разрешил',
    'Главный бухгалтер',
    'Запасы получил',
    'М.П.',
  ]) {
    if (!joined.includes(label)) {
      throw new Error(label)
    }
  }
  if (!joined.includes('000000000003') || !joined.includes('ТОО LayoutNakl')) {
    throw new Error('org data')
  }
  const headers = layout.boxes.filter((box) => box.block === 'products-header').map((box) => box.text)
  if (!headers.some((item) => item.includes('KZT'))) {
    throw new Error('kzt columns')
  }
  const y = {
    meta: firstY(layout.boxes, 'meta'),
    org: firstY(layout.boxes, 'org'),
    title: firstY(layout.boxes, 'title'),
    party: firstY(layout.boxes, 'party'),
    products: firstY(layout.boxes, 'products-header'),
    totals: firstY(layout.boxes, 'totals'),
    signature: firstY(layout.boxes, 'signature'),
  }
  if (
    !(
      y.meta > y.org &&
      y.org > y.title &&
      y.title > y.party &&
      y.party > y.products &&
      y.products > y.totals &&
      y.totals > y.signature
    )
  ) {
    throw new Error('vertical order')
  }
  console.log('delivery-note-layout.verify: ok')
}

void runDeliveryNoteLayoutChecks()
