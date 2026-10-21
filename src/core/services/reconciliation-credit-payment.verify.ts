import { createCustomerDebtPaymentForUser } from './customer-debts'
import { calculateReconciliationForCustomer } from './reconciliation-statements'
import { addSaleOnDay, completeSeededSale, setupInvoiceOrg, stampDay } from './delivery-documents.verify-support'

export function runReconciliationCreditPaymentChecks(): void {
  const ctx = completeSeededSale(setupInvoiceOrg('org-rec-pay', 'ТОО Pay', '000000000003'))
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
  const payment = ctx.persistence.payments.listBySaleId(ctx.orgId, saleId).at(-1)
  if (!payment) {
    throw new Error('payment row')
  }
  stampDay(ctx.persistence, payment.id, 'payments', '2026-08-15')
  const calc = calculateReconciliationForCustomer(
    ctx.persistence,
    ctx.orgId,
    ctx.customerId,
    '2026-08-01',
    '2026-08-31',
  )
  if (calc.debitTurnover !== 250000 || calc.creditTurnover !== 100000) {
    throw new Error(`turns ${calc.debitTurnover}/${calc.creditTurnover}`)
  }
  if (calc.balanceAmount !== 150000 || calc.balanceSide !== 'organization') {
    throw new Error('saldo')
  }
  const saleLine = calc.lines.find((line) => line.orgDebit === 250000)
  const payLine = calc.lines.find((line) => line.orgCredit === 100000)
  if (!saleLine || saleLine.customerCredit !== 250000) {
    throw new Error('mirror sale')
  }
  if (!payLine || payLine.customerDebit !== 100000) {
    throw new Error('mirror pay')
  }
  console.log('reconciliation-credit-payment.verify: ok')
}

runReconciliationCreditPaymentChecks()
