import {
  assert,
  creditSale,
  financeSnapshot,
  setupInvoiceOrg,
} from './supply-contract.verify-support'
import { createSupplyContractForUser } from './supply-contracts'

export function runSupplyContractNoFinancialSideEffectsChecks(): void {
  const ctx = setupInvoiceOrg('org-sc-fx', 'ТОО Без эффектов', '000000000003')
  creditSale(ctx)
  const before = financeSnapshot(ctx.persistence, ctx.orgId, ctx.saleId)
  const created = createSupplyContractForUser(ctx.persistence, ctx.owner, {
    saleId: ctx.saleId,
    advanceAmount: 10,
    fxRate: '450$',
    correctionCoefficient: '1.05',
    schedule: [{ dueDate: '2026-10-21', plannedAmount: 90 }],
  })
  assert(created.ok, 'contract created')
  assert(created.value.advanceAmount === 10, 'informational advance stored')
  const after = financeSnapshot(ctx.persistence, ctx.orgId, ctx.saleId)
  assert(JSON.stringify(after.sale) === JSON.stringify(before.sale), 'Sale unchanged')
  assert(JSON.stringify(after.payments) === JSON.stringify(before.payments), 'Payment unchanged')
  assert(
    JSON.stringify(after.debtPayments) === JSON.stringify(before.debtPayments),
    'Debt payments unchanged',
  )
  assert(JSON.stringify(after.expenses) === JSON.stringify(before.expenses), 'no expense')
  assert(JSON.stringify(after.movements) === JSON.stringify(before.movements), 'no stock movement')
  assert(
    JSON.stringify(after.packageMoves) === JSON.stringify(before.packageMoves),
    'no package movement',
  )
  assert(
    JSON.stringify(after.packageContracts) === JSON.stringify(before.packageContracts),
    'no package contract',
  )
  assert(JSON.stringify(after.inventory) === JSON.stringify(before.inventory), 'stock unchanged')
  assert(after.settlement?.remainingAmount === before.settlement?.remainingAmount, 'Debt unchanged')
  assert(after.settlement?.netPaid === before.settlement?.netPaid, 'net paid unchanged')
  console.log('supply-contract-no-financial-side-effects.verify: ok')
}

runSupplyContractNoFinancialSideEffectsChecks()
