import { checkoutOnCreditForUser } from './checkout-on-credit'
import { createCustomerDebtPaymentForUser } from './customer-debts'
import { createDiscountedSale, setupSalesOrg, assert } from './sales-debt.fixture'

export function runSalesDebtPartialPaymentChecks(): void {
  const ctx = setupSalesOrg('org-dsk-debt-partial', 'DSK')
  const sale = createDiscountedSale(
    ctx.persistence,
    ctx.owner,
    ctx.orgId,
    ctx.warehouseId,
    ctx.productId,
    ctx.customerId,
  )
  const credited = checkoutOnCreditForUser(
    ctx.persistence,
    ctx.owner,
    ctx.orgId,
    sale.id,
  )
  assert(credited.ok && credited.value.remainingAmount === 230_000, 'debt after discount')

  const first = createCustomerDebtPaymentForUser(ctx.persistence, ctx.owner, {
    customerId: ctx.customerId,
    saleId: sale.id,
    amount: 100_000,
    method: 'cash',
  })
  assert(first.ok, 'partial 100000')

  const tooMuch = createCustomerDebtPaymentForUser(ctx.persistence, ctx.owner, {
    customerId: ctx.customerId,
    saleId: sale.id,
    amount: 200_000,
    method: 'card',
  })
  assert(
    !tooMuch.ok && tooMuch.error.code === 'PAYMENT_LIMIT_EXCEEDED',
    'cannot pay more than remaining 130000',
  )

  const close = createCustomerDebtPaymentForUser(ctx.persistence, ctx.owner, {
    customerId: ctx.customerId,
    saleId: sale.id,
    amount: 130_000,
    method: 'bank_transfer',
  })
  assert(close.ok, 'remaining 130000 paid')
  const paid = ctx.persistence.payments
    .listBySaleId(ctx.orgId, sale.id)
    .filter((item) => item.status === 'completed')
    .reduce((sum, item) => sum + item.amount, 0)
  assert(paid === 230_000, 'fully paid')
  const kept = ctx.persistence.sales.getById(sale.id)
  assert(kept?.total === 230_000, 'sale total unchanged')
  console.log('sales-debt-partial-payment.verify: ok')
}

runSalesDebtPartialPaymentChecks()
