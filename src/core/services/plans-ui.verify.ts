import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

export function runPlansUiChecks(): void {
  const page = readFileSync(join(root, 'src/app/routes/pages/CompanyPlansPage.tsx'), 'utf8')
  assert(page.includes('plans-kpi'), 'kpi group')
  assert(page.includes('employeePlans'), 'employee plans heading')
  assert(page.includes('transferActions'), 'actions column')
  assert(page.includes('is-num'), 'numeric alignment')
  assert(page.includes('plans-progress'), 'compact progress')
  assert(!page.includes('new Metric'), 'no new metrics component')
  console.log('plans-ui.verify: ok')
}

runPlansUiChecks()
