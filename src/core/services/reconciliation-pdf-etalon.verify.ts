import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildReconciliationDocumentForUser,
  calculateReconciliationForCustomer,
  createReconciliationStatementForUser,
  generateReconciliationStatementPdfForUser,
  listReconciliationStatementsForUser,
} from './reconciliation-statements'
import { renderReconciliationStatementPdfWithLayout } from '../pdf/reconciliation-statement-pdf'
import {
  addSaleOnDay,
  completeSeededSale,
  isPdfBytes,
  readPdfMeta,
  setupInvoiceOrg,
  texts,
} from './delivery-documents.verify-support'
import { createCustomerDebtPaymentForUser } from './customer-debts'
import { createInMemoryPersistence } from '../repositories/in-memory/create-in-memory-persistence'
import { seedEnabledBusinessModules } from './organization-modules'
import { addOrg, addUser, seedSale } from './sales-invoice.verify'
import { checkoutOnCreditForUser } from './checkout-on-credit'
import { assert } from './sale-invoice-pdf.verify-support'

export async function runReconciliationPdfEtalonChecks(): Promise<void> {
  const ctx = completeSeededSale(setupInvoiceOrg('org-rec-etalon', 'ТОО ЭталонОрг', '000000000006'))
  ctx.persistence.customers.update(ctx.customerId, {
    taxId: '000000000002',
    updatedAt: ctx.persistence.customers.getById(ctx.customerId)?.updatedAt ?? '',
  })
  const saleId = addSaleOnDay(
    ctx.persistence,
    ctx.owner,
    ctx.orgId,
    ctx.warehouseId,
    ctx.productId,
    ctx.customerId,
    25000,
    '2026-08-10',
  )
  const paid = createCustomerDebtPaymentForUser(ctx.persistence, ctx.owner, {
    customerId: ctx.customerId,
    saleId,
    amount: 15000,
    method: 'cash',
  })
  if (!paid.ok) {
    throw new Error(paid.error.code)
  }
  const draft = {
    customerId: ctx.customerId,
    dateFrom: '2026-08-01',
    dateTo: '2026-08-31',
    documentDate: '2026-08-27',
  }
  const created = createReconciliationStatementForUser(ctx.persistence, ctx.owner, draft)
  if (!created.ok) {
    throw new Error(created.error.code)
  }
  const again = createReconciliationStatementForUser(ctx.persistence, ctx.owner, draft)
  if (!again.ok || again.value.id !== created.value.id || again.value.documentNumber !== created.value.documentNumber) {
    throw new Error('no new number')
  }
  const calc = calculateReconciliationForCustomer(
    ctx.persistence,
    ctx.orgId,
    ctx.customerId,
    draft.dateFrom,
    draft.dateTo,
  )
  if (created.value.debitTurnover !== calc.debitTurnover || created.value.creditTurnover !== calc.creditTurnover) {
    throw new Error('turnover')
  }
  if (created.value.balanceAmount !== calc.balanceAmount || created.value.balanceSide !== calc.balanceSide) {
    throw new Error('saldo')
  }
  const doc = buildReconciliationDocumentForUser(ctx.persistence, ctx.owner, created.value.id)
  if (!doc.ok) {
    throw new Error('doc')
  }
  const layout = await renderReconciliationStatementPdfWithLayout(doc.value)
  const meta = await readPdfMeta(layout.bytes)
  if (Math.abs(meta.width - 595.28) > 0.2 || Math.abs(meta.height - 841.89) > 0.2) {
    throw new Error(`page ${meta.width}x${meta.height}`)
  }
  if (meta.width >= meta.height) {
    throw new Error('portrait')
  }
  if (meta.pageCount !== 1) {
    throw new Error(`pages ${meta.pageCount}`)
  }
  if (!isPdfBytes(layout.bytes)) {
    throw new Error('pdf bytes')
  }
  const pdf = await generateReconciliationStatementPdfForUser(
    ctx.persistence,
    ctx.owner,
    created.value.id,
  )
  if (!pdf.ok || pdf.value.mimeType !== 'application/pdf') {
    throw new Error('mime')
  }
  const joined = texts(layout.boxes).join('|')
  for (const label of [
    'АКТ СВЕРКИ №',
    'взаимных расчетов за период',
    'Дата',
    'Документ',
    'Дебет',
    'Кредит',
    'ПО ДАННЫМ',
    'по договору',
    'По данным',
    'задолженность в пользу',
    'Обороты за период',
    'Сальдо на начало',
    'Сальдо на конец',
    'М.П.',
    'БИН:',
    'ИИН/БИН:',
    'ТОО ЭталонОрг',
    '000000000006',
    '000000000002',
    created.value.contractLabel,
    created.value.balanceWords,
  ]) {
    if (!joined.includes(label)) {
      throw new Error(label)
    }
  }
  if (!/[А-Яа-яЁё]/.test(joined)) {
    throw new Error('cyrillic')
  }
  const debit = layout.boxes.filter((box) => box.block === 'table-header' && box.text === 'Дебет')
  if (debit.length < 2) {
    throw new Error('two debit')
  }
  const sorted = [...debit].sort((a, b) => a.x - b.x)
  if ((sorted[1]?.x ?? 0) - (sorted[0]?.x ?? 0) < 200) {
    throw new Error('not side by side')
  }
  if (Math.abs((sorted[0]?.y ?? 0) - (sorted[1]?.y ?? 0)) > 8) {
    throw new Error('tables not same row')
  }
  const orgHead = layout.boxes.find(
    (box) => box.block === 'table-header' && box.text.includes('ТОО ЭталонОрг'),
  )
  const customerHead = layout.boxes.find(
    (box) => box.block === 'table-header' && box.text.includes('Иван Клиент'),
  )
  if (!orgHead || !customerHead || orgHead.x >= customerHead.x) {
    throw new Error('org left customer right')
  }
  if (orgHead.x > 280) {
    throw new Error('org not left half')
  }
  const listed = listReconciliationStatementsForUser(ctx.persistence, ctx.owner, ctx.customerId)
  if (!listed.ok || listed.value.length !== 1) {
    throw new Error('one statement')
  }

  const persistence = createInMemoryPersistence()
  addOrg(persistence, 'org-iso-a', 'Alpha')
  addOrg(persistence, 'org-iso-b', 'Beta')
  persistence.organizations.update('org-iso-a', { legalName: 'ТОО Alpha', taxId: '000000000003' })
  persistence.organizations.update('org-iso-b', { legalName: 'ТОО Beta', taxId: '000000000005' })
  seedEnabledBusinessModules(persistence, 'org-iso-a', 'seed', ['sales', 'warehouse', 'crm'])
  seedEnabledBusinessModules(persistence, 'org-iso-b', 'seed', ['sales', 'warehouse', 'crm'])
  const a = addUser(persistence, 'org-iso-a', 'owner')
  const b = addUser(persistence, 'org-iso-b', 'owner')
  const seeded = seedSale(persistence, 'org-iso-a', a)
  const ownerA = persistence.users.getById(a.id)
  const ownerB = persistence.users.getById(b.id)
  const credited = checkoutOnCreditForUser(persistence, ownerA, 'org-iso-a', seeded.saleId)
  assert(credited.ok, 'credit')
  const statement = createReconciliationStatementForUser(persistence, ownerA, {
    customerId: credited.value.customerId,
    dateFrom: '2020-01-01',
    dateTo: '2030-12-31',
    documentDate: '2026-08-27',
  })
  assert(statement.ok, 'iso create')
  const crossOrg = await generateReconciliationStatementPdfForUser(persistence, ownerB, statement.value.id)
  if (crossOrg.ok) {
    throw new Error('org isolation')
  }
  const crossCustomer = createReconciliationStatementForUser(ctx.persistence, ctx.owner, {
    customerId: credited.value.customerId,
    dateFrom: '2026-08-01',
    dateTo: '2026-08-31',
    documentDate: '2026-08-27',
  })
  if (crossCustomer.ok || crossCustomer.error.code !== 'CUSTOMER_NOT_FOUND') {
    throw new Error('customer isolation')
  }

  const dir = join(process.cwd(), 'tmp-qa-pdf')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'reconciliation-etalon.pdf'), layout.bytes)
  console.log(
    `reconciliation-pdf-etalon.verify: ok ${meta.width}x${meta.height} pages=${meta.pageCount}`,
  )
}

void runReconciliationPdfEtalonChecks()
