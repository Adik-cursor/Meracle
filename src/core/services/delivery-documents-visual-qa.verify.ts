import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { createDeliveryNoteForUser, generateDeliveryNotePdfForUser } from './delivery-notes'
import {
  createReconciliationStatementForUser,
  generateReconciliationStatementPdfForUser,
} from './reconciliation-statements'
import { addSaleOnDay, completeSeededSale, isPdfBytes, setupInvoiceOrg } from './delivery-documents.verify-support'
import { createCustomerDebtPaymentForUser } from './customer-debts'

export async function runDeliveryDocumentsVisualQa(): Promise<void> {
  const dir = join(process.cwd(), 'tmp-qa-pdf')
  mkdirSync(dir, { recursive: true })
  const ctx = completeSeededSale(setupInvoiceOrg('org-visual-qa', 'ТОО Визуал', '000000000001'))
  ctx.persistence.organizations.update(ctx.orgId, {
    legalName: 'ТОО Визуал',
    legalAddress: 'г. Алматы, ул. Тестовая, 1',
    bankName: 'АО Банк',
    iban: 'KZ111222333444555666',
    bik: 'TESTKZKA',
    kbe: '17',
    knp: '710',
    vatStatus: 'no_vat',
  })
  const saleId = addSaleOnDay(
    ctx.persistence,
    ctx.owner,
    ctx.orgId,
    ctx.warehouseId,
    ctx.productId,
    ctx.customerId,
    250000,
    '2026-08-10',
  )
  const paid = createCustomerDebtPaymentForUser(ctx.persistence, ctx.owner, {
    customerId: ctx.customerId,
    saleId,
    amount: 100000,
    method: 'cash',
  })
  if (!paid.ok) {
    throw new Error(paid.error.code)
  }
  const note = createDeliveryNoteForUser(ctx.persistence, ctx.owner, { saleId: ctx.saleId })
  if (!note.ok) {
    throw new Error(note.error.code)
  }
  const notePdf = await generateDeliveryNotePdfForUser(ctx.persistence, ctx.owner, note.value.id)
  if (!notePdf.ok || !isPdfBytes(notePdf.value.bytes)) {
    throw new Error('note pdf')
  }
  const rec = createReconciliationStatementForUser(ctx.persistence, ctx.owner, {
    customerId: ctx.customerId,
    dateFrom: '2026-08-01',
    dateTo: '2026-08-31',
    documentDate: '2026-08-27',
  })
  if (!rec.ok) {
    throw new Error(rec.error.code)
  }
  const recPdf = await generateReconciliationStatementPdfForUser(
    ctx.persistence,
    ctx.owner,
    rec.value.id,
  )
  if (!recPdf.ok || !isPdfBytes(recPdf.value.bytes)) {
    throw new Error('rec pdf')
  }
  writeFileSync(join(dir, 'delivery-note.pdf'), notePdf.value.bytes)
  writeFileSync(join(dir, 'reconciliation.pdf'), recPdf.value.bytes)
  console.log(
    `visual-qa: delivery-note ${notePdf.value.bytes.byteLength}b landscape; reconciliation ${recPdf.value.bytes.byteLength}b`,
  )
}

void runDeliveryDocumentsVisualQa()
