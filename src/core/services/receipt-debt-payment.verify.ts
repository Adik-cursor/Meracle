import { checkoutOnCreditForUser } from './checkout-on-credit'
import { createCustomerDebtPaymentForUser } from './customer-debts'
import { createDiscountedSale, setupSalesOrg, assert } from './sales-debt.fixture'

export function runReceiptDebtPaymentChecks(): void {
  const ctx = setupSalesOrg('org-receipt-debt', 'DSK')
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
  assert(credited.ok, 'on credit')
  assert(ctx.persistence.payments.listBySaleId(ctx.orgId, sale.id).length === 0, 'no payment')
  assert(
    ctx.persistence.internalReceipts.listBySaleId(ctx.orgId, sale.id).length === 0,
    'no fake receipt on debt',
  )

  const first = createCustomerDebtPaymentForUser(ctx.persistence, ctx.owner, {
    customerId: ctx.customerId,
    saleId: sale.id,
    amount: 100_000,
    method: 'cash',
  })
  assert(first.ok, 'partial')
  const receipts = ctx.persistence.internalReceipts.listBySaleId(ctx.orgId, sale.id)
  assert(receipts.length === 1, 'receipt for actual payment')
  assert(receipts[0]?.total === 100_000, 'partial amount not full sale')
  assert(receipts[0]?.paymentId, 'linked to payment')

  const close = createCustomerDebtPaymentForUser(ctx.persistence, ctx.owner, {
    customerId: ctx.customerId,
    saleId: sale.id,
    amount: 130_000,
    method: 'bank_transfer',
  })
  assert(close.ok, 'full close')
  const all = ctx.persistence.internalReceipts.listBySaleId(ctx.orgId, sale.id)
  assert(all.length === 2, 'second receipt on remaining')
  assert(all.reduce((sum, item) => sum + item.total, 0) === 230_000, 'receipts sum paid')
  console.log('receipt-debt-payment.verify: ok')
}

runReceiptDebtPaymentChecks()
