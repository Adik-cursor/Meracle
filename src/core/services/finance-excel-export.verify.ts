import type { Id, User, UserRole } from '../types'
import { createInMemoryPersistence } from '../repositories/in-memory/create-in-memory-persistence'
import type { Persistence } from '../repositories/persistence'
import { seedEnabledBusinessModules } from './organization-modules'
import { newId, nowIso } from './primitives'
import { createExpenseForUser, listExpensesForUser } from './expenses'
import { listCustomerDebtPaymentsForUser, listCustomerDebtsForUser } from './customer-debts'
import { listOrganizationCompensationForUser } from './employee-compensation'
import { currentMotivationPeriodKey } from './employee-motivation'
import { exportExcelDatasetForUser, exportExcelSheetsForUser } from './excel-export'
import {
  FINANCE_DEBTS_HEADERS,
  FINANCE_EXPENSES_HEADERS,
  FINANCE_PAYMENTS_HEADERS,
  FINANCE_SALARY_HEADERS,
  buildAnalyticsExcelSheets,
  buildFinanceDebtsSheet,
  buildFinanceExpensesSheet,
  buildFinancePaymentsSheet,
  buildFinanceSalarySheet,
  mapCustomerDebtsToExportRows,
  mapDebtPaymentsToExportRows,
} from './finance-excel'
import { getFinancialAnalyticsForUser, resolveAnalyticsRange } from './financial-analytics'
import { parseExcelWorkbook } from '../utils/excel-workbook'
import { userDisplayName } from '../../modules/crm/users/user-name'

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

function setupFinanceOrg() {
  const persistence = createInMemoryPersistence()
  const org = 'org-fin-xlsx'
  addOrg(persistence, org, 'Dental')
  seedEnabledBusinessModules(persistence, org, 'seed', [
    'crm',
    'sales',
    'expenses',
    'analytics',
  ])
  const owner = addUser(persistence, org, 'owner')
  return { persistence, org, owner }
}

export function runFinanceExcelExportChecks(): void {
  const { persistence, org, owner } = setupFinanceOrg()
  const created = createExpenseForUser(persistence, owner, org, {
    category: 'rent',
    description: 'Аренда',
    amount: 100,
    date: nowIso().slice(0, 10),
  })
  assert(created.ok, 'expense')
  const expenses = listExpensesForUser(persistence, owner)
  assert(expenses.ok, 'list expenses')
  const expenseSheet = buildFinanceExpensesSheet(
    expenses.value,
    {
      currency: 'KZT',
      responsible: (user, id) => (user ? userDisplayName(user) : id),
    },
    (id) => persistence.users.getById(id),
  )
  assert(
    expenseSheet.headers.join() === FINANCE_EXPENSES_HEADERS.join(),
    'expense columns',
  )
  const expenseExport = exportExcelSheetsForUser(
    persistence,
    owner,
    'finance-expenses.xlsx',
    [expenseSheet],
  )
  assert(expenseExport.ok, 'expense workbook uses excel-workbook')
  const parsedExpenses = parseExcelWorkbook(expenseExport.value.bytes)[0]
  assert(parsedExpenses?.headers.includes('Категория'), 'expense xlsx')

  const payments = listCustomerDebtPaymentsForUser(persistence, owner)
  assert(payments.ok, 'payments service')
  const paymentSheet = buildFinancePaymentsSheet(
    mapDebtPaymentsToExportRows(payments.value, {
      customerName: (id) => id,
      responsibleName: (id) => id,
      currency: 'KZT',
    }),
  )
  assert(paymentSheet.headers.join() === FINANCE_PAYMENTS_HEADERS.join(), 'payment columns')
  assert(
    exportExcelSheetsForUser(persistence, owner, 'finance-payments.xlsx', [paymentSheet]).ok,
    'payments excel',
  )

  const debts = listCustomerDebtsForUser(persistence, owner)
  assert(debts.ok, 'debts service')
  const debtSheet = buildFinanceDebtsSheet(
    mapCustomerDebtsToExportRows(debts.value, {
      customerName: (id) => id,
      basis: () => '',
      date: () => '',
      dueDate: () => '',
      responsible: () => '',
    }),
  )
  assert(debtSheet.headers.join() === FINANCE_DEBTS_HEADERS.join(), 'debt columns')
  assert(
    exportExcelSheetsForUser(persistence, owner, 'finance-debts.xlsx', [debtSheet]).ok,
    'debts excel',
  )

  const period = currentMotivationPeriodKey()
  const salary = listOrganizationCompensationForUser(persistence, owner, period)
  assert(salary.ok, 'salary service')
  const salarySheet = buildFinanceSalarySheet(salary.value, (id) => id)
  assert(salarySheet.headers.join() === FINANCE_SALARY_HEADERS.join(), 'salary columns')
  assert(
    exportExcelSheetsForUser(persistence, owner, 'finance-salary.xlsx', [salarySheet]).ok,
    'salary excel',
  )

  const range = resolveAnalyticsRange('month', nowIso())
  const analytics = getFinancialAnalyticsForUser(persistence, owner, range, {})
  assert(analytics.ok, 'analytics service')
  const analyticsSheets = buildAnalyticsExcelSheets({
    period: 'month',
    tab: 'overview',
    analytics: analytics.value,
  })
  assert(analyticsSheets[0]?.headers[0] === 'Показатель', 'analytics is values not html')
  assert(
    exportExcelSheetsForUser(persistence, owner, 'finance-analytics.xlsx', analyticsSheets).ok,
    'analytics excel',
  )

  const dataset = exportExcelDatasetForUser(persistence, owner, 'expenses')
  assert(dataset.ok, 'universal engine still works')
  console.log('finance-excel-export.verify: ok')
}

runFinanceExcelExportChecks()
