import type { Id, ReconciliationBalanceSide, ReconciliationStatement, User } from '../types'
import { fail, ok, type ServiceResult } from '../types/domain-error'
import type { Persistence } from '../repositories/persistence'
import { isSalePayment } from '../types/payment'
import { newId, nowIso } from './primitives'
import { amountInWordsInvoiceRu } from '../utils/amount-in-words'
import { formatInvoiceDateFile, formatInvoiceDateLong } from '../pdf/invoice-format'
import {
  dayKey,
  nextDocumentNumber,
  requireSalesDocumentManage,
  requireSalesDocumentRead,
  snapshotCustomer,
  snapshotOrganization,
} from './sales-documents'

export type ReconciliationWrite = {
  customerId: Id
  dateFrom: string
  dateTo: string
  documentDate?: string
}

function validDay(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function money(value: number): number {
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : 0
}

export function calculateReconciliationForCustomer(
  persistence: Persistence,
  organizationId: Id,
  customerId: Id,
  dateFrom: string,
  dateTo: string,
): {
  lines: ReconciliationStatement['lines']
  openingOrgDebit: number
  openingOrgCredit: number
  debitTurnover: number
  creditTurnover: number
  closingOrgDebit: number
  closingOrgCredit: number
  balanceSide: ReconciliationBalanceSide
  balanceAmount: number
} {
  const sales = persistence.sales
    .list(organizationId)
    .filter(
      (sale) =>
        sale.customerId === customerId &&
        sale.status === 'completed' &&
        sale.organizationId === organizationId,
    )
  const payments = persistence.payments
    .list(organizationId)
    .filter((payment) => {
      if (!isSalePayment(payment) || payment.status !== 'completed') {
        return false
      }
      const sale = persistence.sales.getById(payment.saleId)
      return Boolean(
        sale &&
          sale.organizationId === organizationId &&
          sale.customerId === customerId,
      )
    })
  const returns = persistence.saleReturns.list(organizationId).filter((item) => {
    if (item.status !== 'completed' || item.organizationId !== organizationId) {
      return false
    }
    const sale = persistence.sales.getById(item.saleId)
    return Boolean(
      sale &&
        sale.organizationId === organizationId &&
        sale.customerId === customerId,
    )
  })
  const refunds = persistence.paymentRefunds.list(organizationId).filter((item) => {
    if (item.status !== 'completed' || item.organizationId !== organizationId) {
      return false
    }
    const sale = persistence.sales.getById(item.saleId)
    return Boolean(
      sale &&
        sale.organizationId === organizationId &&
        sale.customerId === customerId,
    )
  })

  let opening = 0
  const periodSales: { date: string; amount: number; id: string }[] = []
  const periodPayments: { date: string; amount: number; id: string }[] = []
  const periodReturns: { date: string; amount: number; id: string }[] = []
  const periodRefunds: { date: string; amount: number; id: string }[] = []

  for (const sale of sales) {
    const day = dayKey(sale.createdAt)
    if (day < dateFrom) {
      opening += money(sale.total)
    } else if (day <= dateTo) {
      periodSales.push({ date: day, amount: money(sale.total), id: sale.id })
    }
  }
  for (const payment of payments) {
    const day = dayKey(payment.createdAt)
    if (day < dateFrom) {
      opening -= money(payment.amount)
    } else if (day <= dateTo) {
      periodPayments.push({ date: day, amount: money(payment.amount), id: payment.id })
    }
  }
  for (const item of returns) {
    const day = dayKey(item.updatedAt || item.createdAt)
    if (day < dateFrom) {
      opening -= money(item.total)
    } else if (day <= dateTo) {
      periodReturns.push({ date: day, amount: money(item.total), id: item.id })
    }
  }
  for (const item of refunds) {
    const day = dayKey(item.createdAt)
    if (day < dateFrom) {
      opening += money(item.amount)
    } else if (day <= dateTo) {
      periodRefunds.push({ date: day, amount: money(item.amount), id: item.id })
    }
  }

  const kindOrder = { sale: 0, return: 1, payment: 2, refund: 3 } as const
  const events = [
    ...periodSales.map((item) => ({
      date: item.date,
      kind: 'sale' as const,
      amount: item.amount,
      id: item.id,
    })),
    ...periodReturns.map((item) => ({
      date: item.date,
      kind: 'return' as const,
      amount: item.amount,
      id: item.id,
    })),
    ...periodPayments.map((item) => ({
      date: item.date,
      kind: 'payment' as const,
      amount: item.amount,
      id: item.id,
    })),
    ...periodRefunds.map((item) => ({
      date: item.date,
      kind: 'refund' as const,
      amount: item.amount,
      id: item.id,
    })),
  ].sort((left, right) => {
    const byDate = left.date.localeCompare(right.date)
    if (byDate !== 0) {
      return byDate
    }
    if (left.kind === right.kind) {
      return left.id.localeCompare(right.id)
    }
    return kindOrder[left.kind] - kindOrder[right.kind]
  })

  const lines = events.map((event) => {
    if (event.kind === 'sale' || event.kind === 'refund') {
      const document =
        event.kind === 'sale'
          ? `Реализация от ${formatInvoiceDateFile(event.date)}`
          : `Возврат денег от ${formatInvoiceDateFile(event.date)}`
      return {
        date: event.date,
        document,
        orgDebit: event.amount,
        orgCredit: 0,
        customerDebit: 0,
        customerCredit: event.amount,
      }
    }
    const document =
      event.kind === 'return'
        ? `Возврат от ${formatInvoiceDateFile(event.date)}`
        : `Оплата от ${formatInvoiceDateFile(event.date)}`
    return {
      date: event.date,
      document,
      orgDebit: 0,
      orgCredit: event.amount,
      customerDebit: event.amount,
      customerCredit: 0,
    }
  })

  const debitTurnover = money(lines.reduce((sum, line) => sum + line.orgDebit, 0))
  const creditTurnover = money(lines.reduce((sum, line) => sum + line.orgCredit, 0))
  const closing = money(opening + debitTurnover - creditTurnover)
  const openingOrgDebit = opening > 0 ? money(opening) : 0
  const openingOrgCredit = opening < 0 ? money(-opening) : 0
  const closingOrgDebit = closing > 0 ? money(closing) : 0
  const closingOrgCredit = closing < 0 ? money(-closing) : 0
  const balanceSide: ReconciliationBalanceSide =
    closing > 0 ? 'organization' : closing < 0 ? 'customer' : 'none'
  const balanceAmount = money(Math.abs(closing))

  return {
    lines,
    openingOrgDebit,
    openingOrgCredit,
    debitTurnover,
    creditTurnover,
    closingOrgDebit,
    closingOrgCredit,
    balanceSide,
    balanceAmount,
  }
}

export function createReconciliationStatementForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  draft: ReconciliationWrite,
): ServiceResult<ReconciliationStatement> {
  const actor = requireSalesDocumentManage(persistence, currentUser)
  if (!actor.ok) {
    return actor
  }
  if (!validDay(draft.dateFrom) || !validDay(draft.dateTo) || draft.dateFrom > draft.dateTo) {
    return fail({ code: 'RECONCILIATION_PERIOD_INVALID' })
  }
  const documentDate = draft.documentDate?.trim() || nowIso().slice(0, 10)
  if (!validDay(documentDate)) {
    return fail({ code: 'RECONCILIATION_PERIOD_INVALID' })
  }
  const existing = persistence.reconciliationStatements
    .list(actor.value.organizationId)
    .find(
      (item) =>
        item.customerId === draft.customerId &&
        item.dateFrom === draft.dateFrom &&
        item.dateTo === draft.dateTo,
    )
  if (existing) {
    return ok(existing)
  }
  const counterparty = snapshotCustomer(
    persistence,
    actor.value.organizationId,
    draft.customerId,
  )
  if (!counterparty.ok) {
    return counterparty
  }
  const organization = snapshotOrganization(persistence, actor.value.organizationId)
  const calc = calculateReconciliationForCustomer(
    persistence,
    actor.value.organizationId,
    draft.customerId,
    draft.dateFrom,
    draft.dateTo,
  )
  const now = nowIso()
  const statement: ReconciliationStatement = {
    id: newId(),
    organizationId: actor.value.organizationId,
    customerId: draft.customerId,
    documentNumber: nextDocumentNumber(
      persistence.reconciliationStatements
        .list(actor.value.organizationId)
        .map((item) => item.documentNumber),
    ),
    documentDate,
    dateFrom: draft.dateFrom,
    dateTo: draft.dateTo,
    currency: persistence.organizations.getById(actor.value.organizationId)?.currency || 'KZT',
    organization,
    counterparty: counterparty.value,
    contractLabel: 'Без договора',
    ...calc,
    balanceWords: amountInWordsInvoiceRu(calc.balanceAmount, 'KZT'),
    createdBy: actor.value.id,
    createdAt: now,
    updatedAt: now,
  }
  return ok(persistence.reconciliationStatements.create(statement))
}

export function listReconciliationStatementsForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  customerId?: Id,
): ServiceResult<ReconciliationStatement[]> {
  const actor = requireSalesDocumentRead(persistence, currentUser)
  if (!actor.ok) {
    return actor
  }
  return ok(
    persistence.reconciliationStatements
      .list(actor.value.organizationId)
      .filter((item) => (customerId ? item.customerId === customerId : true)),
  )
}

export function getReconciliationStatementForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  statementId: Id,
): ServiceResult<ReconciliationStatement> {
  const actor = requireSalesDocumentRead(persistence, currentUser)
  if (!actor.ok) {
    return actor
  }
  const statement = persistence.reconciliationStatements.getById(statementId)
  if (!statement || statement.organizationId !== actor.value.organizationId) {
    return fail({ code: 'RECONCILIATION_NOT_FOUND' })
  }
  return ok(statement)
}

export function buildReconciliationDocumentForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  statementId: Id,
) {
  const loaded = getReconciliationStatementForUser(persistence, currentUser, statementId)
  if (!loaded.ok) {
    return loaded
  }
  const statement = loaded.value
  return ok({
    statement,
    filename: `Акт сверки № ${statement.documentNumber} от ${formatInvoiceDateFile(statement.documentDate)}.pdf`,
    periodFromFile: formatInvoiceDateFile(statement.dateFrom),
    periodToFile: formatInvoiceDateFile(statement.dateTo),
    periodFromLong: formatInvoiceDateLong(statement.dateFrom),
    periodToLong: formatInvoiceDateLong(statement.dateTo),
    documentDateLong: formatInvoiceDateLong(statement.documentDate),
    documentDateFile: formatInvoiceDateFile(statement.documentDate),
  })
}

export async function generateReconciliationStatementPdfForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  statementId: Id,
): Promise<ServiceResult<{ bytes: Uint8Array; filename: string; mimeType: 'application/pdf' }>> {
  const document = buildReconciliationDocumentForUser(persistence, currentUser, statementId)
  if (!document.ok) {
    return document
  }
  try {
    const { renderReconciliationStatementPdfBytes } = await import(
      '../pdf/reconciliation-statement-pdf'
    )
    const bytes = await renderReconciliationStatementPdfBytes(document.value)
    if (bytes.byteLength === 0 || bytes[0] !== 0x25 || bytes[1] !== 0x50) {
      throw new Error('RECONCILIATION_PDF_INVALID')
    }
    return ok({
      bytes,
      filename: document.value.filename,
      mimeType: 'application/pdf',
    })
  } catch {
    return fail({ code: 'RECONCILIATION_PDF_FAILED' })
  }
}
