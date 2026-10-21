import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

export function runSaleDetailCartChecks(): void {
  const page = readFileSync(join(root, 'src/app/routes/pages/SaleDetailPage.tsx'), 'utf8')
  const css = readFileSync(join(root, 'src/app/app.css'), 'utf8')
  const receiptPage = readFileSync(
    join(root, 'src/app/routes/pages/InternalReceiptDetailPage.tsx'),
    'utf8',
  )
  assert(page.indexOf("t('saleComposition')") < page.indexOf("t('documentsAndActions')"), 'cart before docs')
  assert(page.includes("t('saleComposition')"), 'composition heading')
  assert(page.includes("t('openReceipt')"), 'open receipt action')
  assert(page.includes("t('posReturn')"), 'return on card')
  assert(page.includes("t('posRefund')"), 'refund on card')
  assert(page.includes('InternalReceiptView'), 'receipt view exists')
  assert(page.includes('showReceipt'), 'receipt not always shown')
  assert(page.includes("search).get('receipt')"), 'receipt via query')
  assert(page.includes('<Modal'), 'receipt preview is modal')
  assert(!page.includes('sale-detail__receipt'), 'no inline giant receipt')
  assert(css.includes('.sale-detail__cart'), 'cart styles')
  assert(css.includes('@media (max-width: 720px)'), 'mobile cart')
  assert(receiptPage.includes('?receipt=1'), 'receipt route reuses sale card')
  console.log('sale-detail-cart.verify: ok')
}

runSaleDetailCartChecks()
