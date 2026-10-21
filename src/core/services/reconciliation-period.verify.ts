import { calculateReconciliationForCustomer } from './reconciliation-statements'
import { addSaleOnDay, completeSeededSale, setupInvoiceOrg } from './delivery-documents.verify-support'

export function runReconciliationPeriodChecks(): void {
  const ctx = completeSeededSale(setupInvoiceOrg('org-rec-period', 'ТОО Period', '000000000003'))
  addSaleOnDay(
    ctx.persistence,
    ctx.owner,
    ctx.orgId,
    ctx.warehouseId,
    ctx.productId,
    ctx.customerId,
    80000,
    '2026-07-10',
  )
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
  addSaleOnDay(
    ctx.persistence,
    ctx.owner,
    ctx.orgId,
    ctx.warehouseId,
    ctx.productId,
    ctx.customerId,
    10000,
    '2026-09-10',
  )
  const calc = calculateReconciliationForCustomer(
    ctx.persistence,
    ctx.orgId,
    ctx.customerId,
    '2026-08-01',
    '2026-08-31',
  )
  if (calc.openingOrgDebit !== 80000) {
    throw new Error(`opening ${calc.openingOrgDebit}`)
  }
  if (calc.debitTurnover !== 250000) {
    throw new Error('period sales')
  }
  if (calc.closingOrgDebit !== 330000) {
    throw new Error(`closing ${calc.closingOrgDebit}`)
  }
  if (calc.lines.length !== 1) {
    throw new Error('only period ops')
  }
  console.log('reconciliation-period.verify: ok')
}

runReconciliationPeriodChecks()
