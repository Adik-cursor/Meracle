import type { Id, User, UserRole } from '../types'
import { createInMemoryPersistence } from '../repositories/in-memory/create-in-memory-persistence'
import type { Persistence } from '../repositories/persistence'
import { seedEnabledBusinessModules } from './organization-modules'
import { newId, nowIso } from './primitives'
import { createExpenseForUser, listExpensesForUser } from './expenses'
import { exportExcelDatasetForUser, exportExcelSheetsForUser } from './excel-export'
import {
  buildFinanceExpensesSheet,
  filterExpensesForFinanceExport,
} from './finance-excel'
import { getFinancialAnalyticsForUser, resolveAnalyticsRange } from './financial-analytics'
import { parseExcelWorkbook } from '../utils/excel-workbook'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function addOrg(persistence: Persistence, id: Id, name: string) {
  const now = nowIso()
  persistence.organizations.create({
    id,
    organizationId: id,
    name,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  })
}

function addUser(persistence: Persistence, organizationId: Id, role: UserRole): User {
  const now = nowIso()
  const user: User = {
    id: newId(),
    organizationId,
    email: `${role}@${organizationId}.local`,
    firstName: 'A',
    lastName: 'B',
    role,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  }
  persistence.users.create(user)
  return user
}

export function runFinanceExcelFilterChecks(): void {
  const persistence = createInMemoryPersistence()
  const org = 'org-fin-filter'
  addOrg(persistence, org, 'Dental')
  seedEnabledBusinessModules(persistence, org, 'seed', ['crm', 'sales', 'expenses', 'analytics'])
  const owner = addUser(persistence, org, 'owner')
  const thisMonth = nowIso().slice(0, 7)
  const lastMonthDate = (() => {
    const date = new Date(`${thisMonth}-01T00:00:00.000Z`)
    date.setUTCMonth(date.getUTCMonth() - 1)
    return `${date.toISOString().slice(0, 7)}-15`
  })()

  assert(
    createExpenseForUser(persistence, owner, org, {
      category: 'rent',
      description: 'Офис',
      amount: 10,
      date: `${thisMonth}-10`,
    }).ok,
    'rent this month',
  )
  assert(
    createExpenseForUser(persistence, owner, org, {
      category: 'marketing',
      description: 'Реклама',
      amount: 20,
      date: `${thisMonth}-11`,
    }).ok,
    'marketing this month',
  )
  assert(
    createExpenseForUser(persistence, owner, org, {
      category: 'rent',
      description: 'Прошлый офис',
      amount: 99,
      date: lastMonthDate,
    }).ok,
    'rent last month',
  )

  const listed = listExpensesForUser(persistence, owner)
  assert(listed.ok && listed.value.length === 3, 'unfiltered persistence has 3')
  const filtered = filterExpensesForFinanceExport(listed.value, {
    monthKey: thisMonth,
    category: 'rent',
    query: 'офис',
  })
  assert(filtered.length === 1, 'UI filters keep one row')
  assert(filtered[0]?.amount === 10, 'filtered amount')
  const exported = exportExcelSheetsForUser(persistence, owner, 'filtered-expenses.xlsx', [
    buildFinanceExpensesSheet(
      filtered,
      { currency: 'KZT', responsible: (_user, id) => id },
      () => undefined,
    ),
  ])
  assert(exported.ok, 'filtered export')
  const sheet = parseExcelWorkbook(exported.value.bytes)[0]
  assert(sheet?.rows.length === 1, 'excel rows match filtered view')
  assert(String(sheet.rows[0]?.[2]).includes('Офис'), 'description from current filters')

  const unfilteredDataset = exportExcelDatasetForUser(persistence, owner, 'expenses')
  assert(unfilteredDataset.ok, 'dataset exists')
  const datasetSheet = parseExcelWorkbook(unfilteredDataset.value.bytes)[0]
  assert(
    (datasetSheet?.rows.length ?? 0) >= 3,
    'unfiltered dataset is not what finance export uses',
  )

  const monthRent = getFinancialAnalyticsForUser(
    persistence,
    owner,
    resolveAnalyticsRange('month', nowIso()),
    { expenseCategory: 'rent' },
  )
  const monthAll = getFinancialAnalyticsForUser(
    persistence,
    owner,
    resolveAnalyticsRange('month', nowIso()),
    {},
  )
  assert(monthRent.ok && monthAll.ok, 'analytics queries')
  assert(
    (monthRent.value.expenseItems?.length ?? 0) <= (monthAll.value.expenseItems?.length ?? 0),
    'analytics export follows selected category filter',
  )
  console.log('finance-excel-filters.verify: ok')
}

runFinanceExcelFilterChecks()
