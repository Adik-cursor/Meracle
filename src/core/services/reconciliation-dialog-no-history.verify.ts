import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

export function runReconciliationDialogNoHistoryChecks(): void {
  const source = readFileSync(
    join(root, 'src/modules/crm/customers/ReconciliationStatementDialog.tsx'),
    'utf8',
  )
  assert(source.includes("t('reconciliationStatement')"), 'title')
  assert(source.includes('customerName'), 'counterparty')
  assert(source.includes("t('reconciliationPeriodFrom')"), 'period from')
  assert(source.includes("t('reconciliationPeriodTo')"), 'period to')
  assert(source.includes("t('reconciliationDocumentDate')"), 'document date')
  assert(source.includes("t('createReconciliation')"), 'create')
  assert(source.includes("t('openReconciliationPdf')"), 'open pdf')
  assert(source.includes("t('downloadReconciliationPdf')"), 'download pdf')
  assert(source.includes('setCreated(result.value)'), 'only created statement')
  assert(!source.includes('listReconciliationStatementsForUser'), 'no history list')
  assert(!source.includes('listed.map'), 'no listed map')
  console.log('reconciliation-dialog-no-history.verify: ok')
}

runReconciliationDialogNoHistoryChecks()
