import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

export function runSalesHistoryDocumentsChecks(): void {
  const history = readFileSync(join(root, 'src/modules/sales/components/PosHistory.tsx'), 'utf8')
  assert(history.includes("t('documents')"), 'one documents column')
  assert(!history.includes("<th>{t('invoice')}</th>"), 'no separate invoice column')
  assert(!history.includes("<th>{t('deliveryNote')}</th>"), 'no separate delivery note column')
  assert(!history.includes("<th>{t('internalReceipt')}</th>"), 'no separate receipt column')
  assert(history.includes('onOpenSale'), 'open sale card')
  assert(history.includes("t('createInvoice')"), 'invoice action in history')
  assert(history.includes("t('createDeliveryNote')"), 'delivery note action in history')
  assert(history.includes("t('issueInternalReceipt')"), 'receipt action in history')
  assert(!history.includes('onReturn'), 'return not in history')
  assert(!history.includes('onRefund'), 'refund not in history')
  assert(!history.includes('useEffect'), 'history does not auto-create documents')
  assert(history.includes("t('saleItems')"), 'items toggle')
  assert(history.includes('expandedSaleIds'), 'collapsed by default')
  assert(history.includes('pos-history__items'), 'items panel')
  assert(history.includes('expandedSaleIds[sale.id]'), 'items gated by sale')
  console.log('sales-history-documents.verify: ok')
}

runSalesHistoryDocumentsChecks()
