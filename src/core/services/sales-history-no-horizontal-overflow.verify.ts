import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

export function runSalesHistoryNoHorizontalOverflowChecks(): void {
  const css = readFileSync(join(root, 'src/app/app.css'), 'utf8')
  const historyBlock = css.slice(css.indexOf('.pos-history {'))
  assert(historyBlock.includes('overflow-x: visible'), 'history does not hide overflow')
  assert(!/\.pos-history[^{]*\{[^}]*overflow-x:\s*hidden/.test(css), 'not overflow-x hidden')
  assert(css.includes('.pos-history .table-wrap'), 'override table wrap')
  assert(css.includes('.pos-history__table'), 'dedicated table class')
  console.log('sales-history-no-horizontal-overflow.verify: ok')
}

runSalesHistoryNoHorizontalOverflowChecks()
