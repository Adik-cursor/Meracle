import { checkoutSaleForUser } from './checkout-sale'
import { createInternalSaleReceipt } from './internal-receipts'
import { setupSalesOrg, assert } from './sales-debt.fixture'

export function runReceiptAfterPaymentChecks(): void {
  const ctx = setupSalesOrg('org-receipt-pay', 'DSK')
  assert(
    ctx.persistence.internalReceipts.listBySaleId(ctx.orgId, ctx.saleId).length === 0,
    'no receipt before payment',
  )
  const paid = checkoutSaleForUser(
    ctx.persistence,
    ctx.owner,
    ctx.orgId,
    ctx.saleId,
    { amount: 100, method: 'cash' },
  )
  assert(paid.ok, 'checkout')
  const receipts = ctx.persistence.internalReceipts.listBySaleId(ctx.orgId, ctx.saleId)
  assert(receipts.length === 1, 'receipt after payment')
  assert(receipts[0]?.id === paid.value.receiptId, 'checkout returns receipt')
  assert(receipts[0]?.total === 100, 'receipt amount is paid')
  assert(ctx.persistence.payments.listBySaleId(ctx.orgId, ctx.saleId).length === 1, 'payment exists')

  const zero = createInternalSaleReceipt(
    ctx.persistence,
    ctx.orgId,
    ctx.owner.id,
    ctx.saleId,
    { method: 'cash', tenderedAmount: 0, changeAmount: 0 },
  )
  assert(!zero.ok && zero.error.code === 'INVALID_INPUT', 'no receipt for 0')
  console.log('receipt-after-payment.verify: ok')
}

runReceiptAfterPaymentChecks()
