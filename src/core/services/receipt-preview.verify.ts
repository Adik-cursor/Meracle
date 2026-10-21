import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkoutOnCreditForUser } from './checkout-on-credit'
import {
  getInternalReceiptForUser,
  issueInternalSaleReceiptForUser,
} from './internal-receipts'
import { setupSalesOrg, assert } from './sales-debt.fixture'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')

export function runReceiptPreviewChecks(): void {
  const page = readFileSync(join(root, 'src/app/routes/pages/SaleDetailPage.tsx'), 'utf8')
  assert(page.includes('<Modal'), 'open receipt uses modal')
  assert(page.includes('receipt-preview'), 'preview container')
  assert(page.includes('InternalReceiptView'), 'receipt body reused')
  assert(page.includes('printInternalReceipt'), 'existing print')
  assert(page.includes("t('openReceipt')"), 'open action')
  assert(page.includes("t('printReceipt')"), 'print action')
  assert(!page.includes('sale-detail__receipt'), 'not inline in sale layout')
  assert(page.includes("search).get('receipt')"), 'query still opens preview')

  const ctx = setupSalesOrg('org-receipt-preview', 'Org')
  const credited = checkoutOnCreditForUser(
    ctx.persistence,
    ctx.owner,
    ctx.orgId,
    ctx.saleId,
  )
  assert(credited.ok, 'complete without auto receipt')
  assert(
    ctx.persistence.internalReceipts.listBySaleId(ctx.orgId, ctx.saleId).length === 0,
    'opening sale does not create receipt',
  )

  const first = issueInternalSaleReceiptForUser(ctx.persistence, ctx.owner, ctx.saleId)
  assert(first.ok, 'issue')
  assert(
    ctx.persistence.internalReceipts.listBySaleId(ctx.orgId, ctx.saleId).length === 1,
    'one receipt',
  )
  const again = issueInternalSaleReceiptForUser(ctx.persistence, ctx.owner, ctx.saleId)
  assert(again.ok && again.value.id === first.value.id, 'same receipt on retry')

  const readable = getInternalReceiptForUser(ctx.persistence, ctx.owner, first.value.id)
  assert(readable.ok, 'owner can read receipt')

  const other = setupSalesOrg('org-receipt-preview-b', 'Other')
  const isolated = getInternalReceiptForUser(other.persistence, other.owner, first.value.id)
  assert(!isolated.ok, 'other org cannot read receipt')
  const issuedCross = issueInternalSaleReceiptForUser(other.persistence, other.owner, ctx.saleId)
  assert(!issuedCross.ok, 'other org cannot issue for this sale')
  console.log('receipt-preview.verify: ok')
}

runReceiptPreviewChecks()
