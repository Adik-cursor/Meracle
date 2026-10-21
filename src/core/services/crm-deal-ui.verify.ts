import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

export function runCrmDealUiChecks(): void {
  const page = readFileSync(join(root, 'src/app/routes/pages/DealDetailPage.tsx'), 'utf8')
  assert(page.includes('deal-detail__grid'), 'two column layout')
  assert(page.includes("t('dealMainInfo')"), 'main info')
  assert(page.includes("t('dealActivity')"), 'activity')
  assert(page.includes('deal-detail__id'), 'id is secondary')
  assert(!page.includes('workspace-muted">{deal.id}'), 'uuid not primary')
  assert(page.includes("t('edit')"), 'edit action')
  assert(page.includes('danger: true'), 'delete is danger')
  console.log('crm-deal-ui.verify: ok')
}

runCrmDealUiChecks()
