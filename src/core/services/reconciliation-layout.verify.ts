import {
  buildReconciliationDocumentForUser,
  createReconciliationStatementForUser,
} from './reconciliation-statements'
import { renderReconciliationStatementPdfWithLayout } from '../pdf/reconciliation-statement-pdf'
import {
  completeSeededSale,
  firstY,
  readPdfMeta,
  setupInvoiceOrg,
  texts,
} from './delivery-documents.verify-support'

export async function runReconciliationLayoutChecks(): Promise<void> {
  const ctx = completeSeededSale(setupInvoiceOrg('org-rec-layout', 'ТОО RecLayout', '000000000003'))
  const created = createReconciliationStatementForUser(ctx.persistence, ctx.owner, {
    customerId: ctx.customerId,
    dateFrom: '2020-01-01',
    dateTo: '2030-12-31',
    documentDate: '2026-08-27',
  })
  if (!created.ok) {
    throw new Error(created.error.code)
  }
  const doc = buildReconciliationDocumentForUser(ctx.persistence, ctx.owner, created.value.id)
  if (!doc.ok) {
    throw new Error('doc')
  }
  const layout = await renderReconciliationStatementPdfWithLayout(doc.value)
  const meta = await readPdfMeta(layout.bytes)
  if (Math.abs(meta.width - 595.28) > 0.2 || Math.abs(meta.height - 841.89) > 0.2) {
    throw new Error(`A4 portrait ${meta.width}x${meta.height}`)
  }
  if (meta.width >= meta.height) {
    throw new Error('portrait')
  }
  const joined = texts(layout.boxes).join('|')
  for (const label of [
    'АКТ СВЕРКИ №',
    'взаимных расчетов за период',
    'Мы, нижеподписавшиеся',
    'ПО ДАННЫМ',
    'Дебет',
    'Кредит',
    'Сальдо на начало',
    'Обороты за период',
    'Сальдо на конец',
    'М.П.',
    'БИН:',
    'ИИН/БИН:',
  ]) {
    if (!joined.includes(label)) {
      throw new Error(label)
    }
  }
  const headers = layout.boxes.filter((box) => box.block === 'table-header')
  const debitBoxes = headers.filter((box) => box.text === 'Дебет')
  if (debitBoxes.length < 2) {
    throw new Error('two debit headers')
  }
  const side = [...debitBoxes].sort((a, b) => a.x - b.x)
  if ((side[1]?.x ?? 0) - (side[0]?.x ?? 0) < 200) {
    throw new Error('side by side')
  }
  if (Math.abs((side[0]?.y ?? 0) - (side[1]?.y ?? 0)) > 8) {
    throw new Error('same row')
  }
  const y = {
    title: firstY(layout.boxes, 'title'),
    intro: firstY(layout.boxes, 'intro'),
    header: firstY(layout.boxes, 'table-header'),
    opening: firstY(layout.boxes, 'opening'),
    turnover: firstY(layout.boxes, 'turnover'),
    closing: firstY(layout.boxes, 'closing'),
    conclusion: firstY(layout.boxes, 'conclusion'),
    signature: firstY(layout.boxes, 'signature'),
  }
  if (
    !(
      y.title > y.intro &&
      y.intro > y.header &&
      y.header > y.opening &&
      y.opening > y.turnover &&
      y.turnover > y.closing &&
      y.closing > y.conclusion &&
      y.conclusion > y.signature
    )
  ) {
    throw new Error('vertical order')
  }
  console.log('reconciliation-layout.verify: ok')
}

void runReconciliationLayoutChecks()
