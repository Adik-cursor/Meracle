import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

export function runSalesHistoryResponsiveChecks(): void {
  const history = readFileSync(join(root, 'src/modules/sales/components/PosHistory.tsx'), 'utf8')
  const css = readFileSync(join(root, 'src/app/app.css'), 'utf8')
  assert(history.includes("t('documents')"), 'documents column')
  assert(history.includes('pos-history__docs'), 'docs block')
  assert(history.includes('pos-history__actions'), 'actions block')
  assert(history.includes('data-label'), 'stacked labels')
  assert(history.includes('pos-history__items-row'), 'items row attached to sale')
  assert(css.includes('.pos-history__items-row'), 'items row styles')
  assert(css.includes('table-layout: fixed'), 'fixed table')
  assert(css.includes('@media (max-width: 1024px)'), '1024 compress')
  assert(css.includes('@media (max-width: 720px)'), '390 stacked breakpoint')
  assert(css.includes("content: attr(data-label)"), 'card labels')
  assert(css.includes('overflow-wrap: anywhere'), 'long values wrap')
  console.log('sales-history-responsive.verify: ok')
}

runSalesHistoryResponsiveChecks()
