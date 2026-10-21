import { checkoutOnCreditForUser } from './checkout-on-credit'
import { issueInternalSaleReceiptForUser } from './internal-receipts'
import { setupSalesOrg, assert } from './sales-debt.fixture'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')

export function runReceiptCreateOnDemandChecks(): void {
  const page = readFileSync(join(root, 'src/app/routes/pages/SaleDetailPage.tsx'), 'utf8')
  assert(page.includes("t('issueInternalReceipt')"), 'issue action in UI')
  assert(page.includes("t('receiptNotIssued')"), 'not issued copy')
  assert(page.includes('issueInternalSaleReceiptForUser'), 'uses existing service')

  const ctx = setupSalesOrg('org-receipt-demand', 'Org')
  const credited = checkoutOnCreditForUser(
    ctx.persistence,
    ctx.owner,
    ctx.orgId,
    ctx.saleId,
  )
  assert(credited.ok, 'complete on credit')
  assert(
    ctx.persistence.internalReceipts.listBySaleId(ctx.orgId, ctx.saleId).length === 0,
    'opening sale does not create receipt',
  )

  const first = issueInternalSaleReceiptForUser(ctx.persistence, ctx.owner, ctx.saleId)
  assert(first.ok, 'issue receipt')
  const receipts = ctx.persistence.internalReceipts.listBySaleId(ctx.orgId, ctx.saleId)
  assert(receipts.length === 1, 'one InternalReceipt')
  const sale = ctx.persistence.sales.getById(ctx.saleId)
  assert(sale, 'sale exists')
  assert(first.value.total === sale.total, 'receipt matches sale total')
  assert(first.value.saleId === ctx.saleId, 'receipt linked to sale')
  assert(first.value.items.length === 1, 'receipt items from sale')

  const second = issueInternalSaleReceiptForUser(ctx.persistence, ctx.owner, ctx.saleId)
  assert(second.ok, 'reissue returns existing')
  assert(second.value.id === first.value.id, 'same receipt id')
  assert(
    ctx.persistence.internalReceipts.listBySaleId(ctx.orgId, ctx.saleId).length === 1,
    'no second receipt',
  )
  console.log('receipt-create-on-demand.verify: ok')
}

runReceiptCreateOnDemandChecks()
