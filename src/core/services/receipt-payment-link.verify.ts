import { checkoutSaleForUser } from './checkout-sale'
import { setupSalesOrg, assert } from './sales-debt.fixture'

export function runReceiptPaymentLinkChecks(): void {
  const ctx = setupSalesOrg('org-receipt-link', 'DSK')
  const paid = checkoutSaleForUser(
    ctx.persistence,
    ctx.owner,
    ctx.orgId,
    ctx.saleId,
    { amount: 100, method: 'card' },
  )
  assert(paid.ok, 'checkout')
  const payment = ctx.persistence.payments.listBySaleId(ctx.orgId, ctx.saleId)[0]
  assert(payment, 'payment')
  const receipt = ctx.persistence.internalReceipts.getByPaymentId(ctx.orgId, payment.id)
  assert(receipt, 'receipt by payment')
  assert(receipt.saleId === ctx.saleId, 'receipt linked to sale')
  assert(receipt.paymentId === payment.id, 'receipt linked to payment')
  assert(receipt.total === payment.amount, 'receipt uses payment amount')
  assert(
    ctx.persistence.payments.getById(receipt.id) === undefined,
    'receipt does not create payment',
  )
  console.log('receipt-payment-link.verify: ok')
}

runReceiptPaymentLinkChecks()
