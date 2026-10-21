import { checkoutOnCreditForUser } from './checkout-on-credit'
import { createCustomerDebtPaymentForUser, listSaleDebtRowsForUser } from './customer-debts'
import { assert, setupSalesOrg } from './sales-debt.fixture'

export function runSalesDebtFinanceChecks(): void {
  const ctx = setupSalesOrg('org-dsk-debt-fin', 'DSK')
  const credited = checkoutOnCreditForUser(
    ctx.persistence,
    ctx.owner,
    ctx.orgId,
    ctx.saleId,
  )
  assert(credited.ok, 'credit')
  const open = listSaleDebtRowsForUser(ctx.persistence, ctx.owner)
  assert(open.ok, 'list')
  const row = open.value.find((item) => item.saleId === ctx.saleId)
  assert(row?.status === 'unpaid' && row.remainingAmount === 100, 'finance unpaid')
  const total = open.value.reduce((sum, item) => sum + item.remainingAmount, 0)
  assert(total === 100, 'grand remaining from live rows')

  const pay = createCustomerDebtPaymentForUser(ctx.persistence, ctx.owner, {
    customerId: ctx.customerId,
    saleId: ctx.saleId,
    amount: 40,
    method: 'cash',
  })
  assert(pay.ok, 'partial')
  const after = listSaleDebtRowsForUser(ctx.persistence, ctx.owner)
  const next = after.ok
    ? after.value.find((item) => item.saleId === ctx.saleId)
    : undefined
  assert(next?.status === 'partially_paid' && next.remainingAmount === 60, 'partial status')

  const close = createCustomerDebtPaymentForUser(ctx.persistence, ctx.owner, {
    customerId: ctx.customerId,
    saleId: ctx.saleId,
    amount: 60,
    method: 'other',
  })
  assert(close.ok, 'close')
  const done = listSaleDebtRowsForUser(ctx.persistence, ctx.owner)
  const paid = done.ok
    ? done.value.find((item) => item.saleId === ctx.saleId)
    : undefined
  assert(paid?.status === 'paid' && paid.remainingAmount === 0, 'paid status kept for on_credit')
  console.log('sales-debt-finance.verify: ok')
}

runSalesDebtFinanceChecks()
