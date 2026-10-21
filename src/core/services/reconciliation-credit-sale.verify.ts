import { calculateReconciliationForCustomer } from './reconciliation-statements'
import { addSaleOnDay, completeSeededSale, setupInvoiceOrg } from './delivery-documents.verify-support'

export function runReconciliationCreditSaleChecks(): void {
  const ctx = completeSeededSale(setupInvoiceOrg('org-rec-credit', 'ТОО Credit', '000000000003'))
  addSaleOnDay(
    ctx.persistence,
    ctx.owner,
    ctx.orgId,
    ctx.warehouseId,
    ctx.productId,
    ctx.customerId,
    250000,
    '2026-08-10',
  )
  const calc = calculateReconciliationForCustomer(
    ctx.persistence,
    ctx.orgId,
    ctx.customerId,
    '2026-08-01',
    '2026-08-31',
  )
  if (calc.lines.some((line) => line.orgCredit !== 0 && line.orgDebit === 0) === false && calc.creditTurnover !== 0) {
    throw new Error('unexpected credit')
  }
  if (calc.creditTurnover !== 0 || calc.debitTurnover !== 250000) {
    throw new Error('unpaid sale')
  }
  console.log('reconciliation-credit-sale.verify: ok')
}

runReconciliationCreditSaleChecks()
