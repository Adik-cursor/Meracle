import { checkoutSaleForUser } from './checkout-sale'
import { completeReturnForUser } from './complete-return'
import { createPaymentRefundForUser } from './create-payment-refund'
import {
  createReturnForUser,
  getSaleReturnDetailForUser,
} from './sale-returns'
import { setupSalesOrg, assert } from './sales-debt.fixture'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')

export function runReturnDetailsChecks(): void {
  const page = readFileSync(join(root, 'src/app/routes/pages/SaleReturnsPage.tsx'), 'utf8')
  const form = readFileSync(
    join(root, 'src/modules/sales/components/SaleReturnForm.tsx'),
    'utf8',
  )
  assert(page.includes('SaleReturnDetailModal'), 'detail modal')
  assert(page.includes('onDetails'), 'details action')
  assert(form.includes("t('returnReason')"), 'reason field')
  assert(form.includes("t('returnComment')"), 'comment field')

  const ctx = setupSalesOrg('org-return-detail', 'Org')
  const paid = checkoutSaleForUser(
    ctx.persistence,
    ctx.owner,
    ctx.orgId,
    ctx.saleId,
    { amount: 100, method: 'cash' },
  )
  assert(paid.ok, 'pay')
  const item = ctx.persistence.saleItems.listBySaleId(ctx.saleId)[0]
  assert(item, 'item')
  const created = createReturnForUser(ctx.persistence, ctx.owner, ctx.orgId, {
    saleId: ctx.saleId,
    reason: 'Не подошёл размер',
    note: 'Клиент попросил обмен',
    items: [{ saleItemId: item.id, quantity: 1 }],
  })
  assert(created.ok, 'create return')
  assert(completeReturnForUser(ctx.persistence, ctx.owner, ctx.orgId, created.value.id).ok, 'complete')

  const detail = getSaleReturnDetailForUser(ctx.persistence, ctx.owner, created.value.id)
  assert(detail.ok, 'detail')
  assert(detail.value.sale.id === ctx.saleId, 'original sale')
  assert(detail.value.items.length === 1, 'one line')
  assert(detail.value.items[0]?.quantity === 1, 'qty')
  assert(detail.value.items[0]?.total === created.value.total, 'line sum')
  assert(detail.value.saleReturn.total === item.total, 'return sum')
  assert(detail.value.refundedAmount === 0, 'goods return is not money refund')
  assert(detail.value.saleReturn.reason === 'Не подошёл размер', 'reason')
  assert(detail.value.saleReturn.note === 'Клиент попросил обмен', 'comment')

  const payment = ctx.persistence.payments.listBySaleId(ctx.orgId, ctx.saleId)[0]
  assert(payment, 'payment')
  const refund = createPaymentRefundForUser(ctx.persistence, ctx.owner, {
    organizationId: ctx.orgId,
    createdBy: ctx.owner.id,
    paymentId: payment.id,
    amount: 40,
    returnId: created.value.id,
  })
  assert(refund.ok, 'money refund')
  const after = getSaleReturnDetailForUser(ctx.persistence, ctx.owner, created.value.id)
  assert(after.ok, 'detail after refund')
  assert(after.value.refundedAmount === 40, 'refund amount')
  assert(after.value.saleReturn.total !== after.value.refundedAmount, 'refund != goods return')
  console.log('return-details.verify: ok')
}

runReturnDetailsChecks()
