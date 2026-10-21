import { calculateReconciliationForCustomer } from './reconciliation-statements'
import { addSaleOnDay, completeSeededSale, setupInvoiceOrg } from './delivery-documents.verify-support'

export function runReconciliationCalculationChecks(): void {
  const ctx = completeSeededSale(setupInvoiceOrg('org-rec-calc', 'ТОО Calc', '000000000003'))
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
  if (calc.debitTurnover !== 250000) {
    throw new Error(`debit ${calc.debitTurnover}`)
  }
  if (calc.creditTurnover !== 0) {
    throw new Error('credit')
  }
  if (calc.balanceAmount !== 250000 || calc.balanceSide !== 'organization') {
    throw new Error('balance')
  }
  console.log('reconciliation-calculation.verify: ok')
}

runReconciliationCalculationChecks()
