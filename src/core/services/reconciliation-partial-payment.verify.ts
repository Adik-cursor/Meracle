import { createCustomerDebtPaymentForUser } from './customer-debts'
import { calculateReconciliationForCustomer } from './reconciliation-statements'
import { addSaleOnDay, completeSeededSale, setupInvoiceOrg, stampDay } from './delivery-documents.verify-support'

export function runReconciliationPartialPaymentChecks(): void {
  const ctx = completeSeededSale(setupInvoiceOrg('org-rec-part', 'ТОО Part', '000000000003'))
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
  const first = createCustomerDebtPaymentForUser(ctx.persistence, ctx.owner, {
    customerId: ctx.customerId,
    saleId,
    amount: 100000,
    method: 'cash',
  })
  const second = createCustomerDebtPaymentForUser(ctx.persistence, ctx.owner, {
    customerId: ctx.customerId,
    saleId,
    amount: 50000,
    method: 'cash',
  })
  if (!first.ok || !second.ok) {
    throw new Error('payments')
  }
  const payments = ctx.persistence.payments.listBySaleId(ctx.orgId, saleId)
  if (payments.length < 2) {
    throw new Error('two payments')
  }
  stampDay(ctx.persistence, payments[0]!.id, 'payments', '2026-08-15')
  stampDay(ctx.persistence, payments[1]!.id, 'payments', '2026-08-20')
  const calc = calculateReconciliationForCustomer(
    ctx.persistence,
    ctx.orgId,
    ctx.customerId,
    '2026-08-01',
    '2026-08-31',
  )
  if (calc.debitTurnover !== 250000 || calc.creditTurnover !== 150000) {
    throw new Error(`turns ${calc.debitTurnover}/${calc.creditTurnover}`)
  }
  if (calc.balanceAmount !== 100000) {
    throw new Error('saldo')
  }
  console.log('reconciliation-partial-payment.verify: ok')
}

runReconciliationPartialPaymentChecks()
