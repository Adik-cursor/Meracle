import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

export function runFinanceUiChecks(): void {
  const page = readFileSync(
    join(root, 'src/app/routes/pages/FinanceWorkspacePage.tsx'),
    'utf8',
  )
  const salary = readFileSync(
    join(root, 'src/app/routes/pages/FinanceSalaryPage.tsx'),
    'utf8',
  )
  const css = readFileSync(join(root, 'src/styles/meracle-finance.css'), 'utf8')
  assert(page.includes('resolveFinanceNavGroups'), 'existing nav architecture')
  assert(page.includes("active === 'salary'"), 'salary workspace')
  assert(!page.includes('ds-context__kicker'), 'no duplicate kicker header')
  assert(salary.includes('compensationAccrued'), 'accrued')
  assert(salary.includes('compensationAdvance'), 'advance')
  assert(salary.includes('compensationPaid'), 'paid')
  assert(salary.includes('compensationRemaining'), 'to pay')
  assert(salary.includes('Badge'), 'status badge')
  assert(css.includes('grid-template-columns: 180px'), 'compact rail')
  console.log('finance-ui.verify: ok')
}

runFinanceUiChecks()
