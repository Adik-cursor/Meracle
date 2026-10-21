import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

export function runEmployeesUiChecks(): void {
  const page = readFileSync(join(root, 'src/app/routes/pages/UsersPage.tsx'), 'utf8')
  assert(page.includes('employee-filter-bar'), 'compact filter bar')
  assert(!page.includes('settings-section employee-filters'), 'no huge filter card')
  assert(page.includes('employeeUnit'), 'unit column')
  assert(page.includes('isUserAccountEnabled'), 'employee != account')
  assert(page.includes('employeeDisable'), 'disable action kept')
  assert(page.includes('table-actions'), 'compact actions')
  console.log('employees-ui.verify: ok')
}

runEmployeesUiChecks()
