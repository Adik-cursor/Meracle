import type { CustomerDebtPayment, Expense, User } from '../types'
import type { ExcelCellValue, ExcelSheet } from '../utils/excel-workbook'
import type { CustomerDebtView, SaleDebtRow } from './customer-debts'
import type { EmployeeCompensationSnapshot } from './employee-compensation'
import type {
  AnalyticsKpis,
  EmployeeAnalyticsRow,
  ExpenseAnalyticsRow,
  FinancialAnalytics,
  PaymentAnalyticsRow,
  ProductAnalyticsRow,
} from './financial-analytics'

export const FINANCE_PAYMENTS_HEADERS = [
  'Дата',
  'Номер операции',
  'Клиент',
  'ИИН/БИН',
  'Основание',
  'Тип',
  'Сумма',
  'Валюта',
  'Статус',
  'Ответственный',
] as const

export const FINANCE_DEBTS_HEADERS = [
  'Клиент',
  'ИИН/БИН',
  'Основание',
  'Дата',
  'Начислено',
  'Оплачено',
  'Задолженность',
  'Срок оплаты',
  'Статус',
  'Ответственный',
] as const

export const FINANCE_SALARY_HEADERS = [
  'Сотрудник',
  'Период',
  'Начислено',
  'Аванс',
  'Другие выплаты',
  'Выплачено',
  'Остаток',
  'Статус',
] as const

export const FINANCE_EXPENSES_HEADERS = [
  'Дата',
  'Категория',
  'Описание',
  'Сумма',
  'Валюта',
  'Ответственный',
  'Связанный объект',
  'Статус',
] as const

function sheet(name: string, headers: readonly string[], rows: ExcelCellValue[][]): ExcelSheet {
  return { name, headers, rows }
}

export type FinancePaymentExportRow = {
  date: string
  operationNumber: string
  customerName: string
  customerTaxId: string
  basis: string
  type: string
  amount: number
  currency: string
  status: string
  responsible: string
}

export type FinanceDebtExportRow = {
  customerName: string
  customerTaxId: string
  basis: string
  date: string
  charged: number
  paid: number
  debt: number
  dueDate: string
  status: string
  responsible: string
}

export function filterExpensesForFinanceExport(
  expenses: readonly Expense[],
  filters: { monthKey: string; category: string; query: string },
): Expense[] {
  const needle = filters.query.trim().toLowerCase()
  return expenses.filter((expense) => {
    if (expense.date.slice(0, 7) !== filters.monthKey) {
      return false
    }
    if (filters.category && expense.category !== filters.category) {
      return false
    }
    if (needle && !expense.description.toLowerCase().includes(needle)) {
      return false
    }
    return true
  })
}

export function mapDebtPaymentsToExportRows(
  payments: readonly CustomerDebtPayment[],
  names: {
    customerName: (customerId: string) => string
    customerTaxId?: (customerId: string) => string
    responsibleName: (userId: string) => string
    currency: string
  },
): FinancePaymentExportRow[] {
  return payments.map((payment) => ({
    date: payment.createdAt,
    operationNumber: payment.paymentReference || payment.id.slice(-8).toUpperCase(),
    customerName: names.customerName(payment.customerId),
    customerTaxId: names.customerTaxId?.(payment.customerId) ?? '',
    basis: payment.comment || payment.accountReference || '',
    type: payment.method,
    amount: payment.amount,
    currency: names.currency,
    status: 'completed',
    responsible: names.responsibleName(payment.actorUserId),
  }))
}

function debtPaymentStatusLabel(status: SaleDebtRow['status']): string {
  if (status === 'paid') {
    return 'Оплачено'
  }
  if (status === 'partially_paid') {
    return 'Частично оплачено'
  }
  return 'Не оплачено'
}

export function mapSaleDebtsToExportRows(
  debts: readonly SaleDebtRow[],
  names: {
    customerName: (customerId: string) => string
    customerTaxId?: (customerId: string) => string
    responsible: (saleId: string) => string
  },
): FinanceDebtExportRow[] {
  return debts.map((debt) => ({
    customerName: names.customerName(debt.customerId),
    customerTaxId: names.customerTaxId?.(debt.customerId) ?? '',
    basis: `Продажа №${debt.saleNumber}`,
    date: debt.createdAt,
    charged: debt.charged,
    paid: debt.paidAmount,
    debt: debt.remainingAmount,
    dueDate: debt.dueDate ?? '',
    status: debtPaymentStatusLabel(debt.status),
    responsible: names.responsible(debt.saleId),
  }))
}

export function mapCustomerDebtsToExportRows(
  debts: readonly CustomerDebtView[],
  names: {
    customerName: (customerId: string) => string
    customerTaxId?: (customerId: string) => string
    basis: (customerId: string) => string
    date: (customerId: string) => string
    dueDate: (customerId: string) => string
    responsible: (customerId: string) => string
  },
): FinanceDebtExportRow[] {
  return debts.map((debt) => ({
    customerName: names.customerName(debt.customerId),
    customerTaxId: names.customerTaxId?.(debt.customerId) ?? '',
    basis: names.basis(debt.customerId),
    date: names.date(debt.customerId),
    charged: debt.totalDebt,
    paid: debt.paidAmount,
    debt: debt.remainingDebt,
    dueDate: names.dueDate(debt.customerId),
    status: debt.status,
    responsible: names.responsible(debt.customerId),
  }))
}

export function buildFinancePaymentsSheet(rows: readonly FinancePaymentExportRow[]): ExcelSheet {
  return sheet(
    'Оплаты',
    FINANCE_PAYMENTS_HEADERS,
    rows.map((row) => [
      row.date,
      row.operationNumber,
      row.customerName,
      row.customerTaxId,
      row.basis,
      row.type,
      row.amount,
      row.currency,
      row.status,
      row.responsible,
    ]),
  )
}

export function buildFinanceDebtsSheet(rows: readonly FinanceDebtExportRow[]): ExcelSheet {
  return sheet(
    'Задолженности',
    FINANCE_DEBTS_HEADERS,
    rows.map((row) => [
      row.customerName,
      row.customerTaxId,
      row.basis,
      row.date,
      row.charged,
      row.paid,
      row.debt,
      row.dueDate,
      row.status,
      row.responsible,
    ]),
  )
}

export function buildFinanceSalarySheet(
  rows: readonly EmployeeCompensationSnapshot[],
  employeeName: (userId: string) => string,
): ExcelSheet {
  return sheet(
    'Зарплата',
    FINANCE_SALARY_HEADERS,
    rows.map((row) => [
      employeeName(row.employeeUserId),
      row.period,
      row.accruedAmount,
      row.advanceAmount,
      row.bonusAmount,
      row.paidAmount,
      row.remainingAmount,
      row.status,
    ]),
  )
}

export function buildFinanceExpensesSheet(
  expenses: readonly Expense[],
  names: { currency: string; responsible: (user: User | undefined, createdByUserId: string) => string },
  usersById: (id: string) => User | undefined,
): ExcelSheet {
  return sheet(
    'Расходы',
    FINANCE_EXPENSES_HEADERS,
    expenses.map((expense) => [
      expense.date,
      expense.category,
      expense.description,
      expense.amount,
      names.currency,
      names.responsible(usersById(expense.createdByUserId), expense.createdByUserId),
      expense.branchId ?? expense.compensationId ?? expense.employeeUserId ?? '',
      'posted',
    ]),
  )
}

export function buildAnalyticsExcelSheets(input: {
  period: string
  tab: string
  analytics: FinancialAnalytics | null
}): ExcelSheet[] {
  const sheets: ExcelSheet[] = []
  const kpis = input.analytics?.kpis
  sheets.push(
    sheet('Показатели', ['Показатель', 'Значение', 'Период', 'Вкладка'], kpiRows(kpis, input)),
  )

  if (input.tab === 'products') {
    sheets.push(productSheet('Товары', input.analytics?.products ?? []))
  }
  if (input.tab === 'services') {
    sheets.push(productSheet('Услуги', input.analytics?.services ?? []))
  }
  if (input.tab === 'employees') {
    sheets.push(employeeSheet(input.analytics?.employees ?? []))
  }
  if (input.tab === 'payments') {
    sheets.push(paymentMethodSheet(input.analytics?.payments ?? []))
  }
  if (input.tab === 'expenses') {
    sheets.push(expenseCategorySheet(input.analytics?.expenses ?? []))
  }
  if (input.tab === 'overview' && input.analytics) {
    sheets.push(productSheet('Товары', input.analytics.products))
    sheets.push(expenseCategorySheet(input.analytics.expenses))
  }

  return sheets
}

function kpiRows(
  kpis: AnalyticsKpis | undefined,
  input: { period: string; tab: string },
): ExcelCellValue[][] {
  if (!kpis) {
    return [['Нет данных', '', input.period, input.tab]]
  }
  return [
    ['Выручка', kpis.revenue, input.period, input.tab],
    ['Себестоимость', kpis.cogs, input.period, input.tab],
    ['Валовая прибыль', kpis.grossProfit, input.period, input.tab],
    ['Маржа %', kpis.marginPercent, input.period, input.tab],
    ['Расходы', kpis.expenses, input.period, input.tab],
    ['Чистая прибыль', kpis.netProfit, input.period, input.tab],
    ['Средний чек', kpis.averageCheck, input.period, input.tab],
    ['Количество продаж', kpis.salesCount, input.period, input.tab],
    ['Скидки', kpis.discounts, input.period, input.tab],
    ['Единицы товаров', kpis.productUnits, input.period, input.tab],
    ['Единицы услуг', kpis.serviceUnits, input.period, input.tab],
  ]
}

function productSheet(name: string, rows: readonly ProductAnalyticsRow[]): ExcelSheet {
  return sheet(
    name,
    ['Наименование', 'Артикул', 'Тип', 'Количество', 'Выручка', 'Прибыль', 'Маржа %'],
    rows.map((row) => [
      row.name,
      row.sku,
      row.itemType,
      row.quantity,
      row.revenue,
      row.grossProfit,
      row.marginPercent,
    ]),
  )
}

function employeeSheet(rows: readonly EmployeeAnalyticsRow[]): ExcelSheet {
  return sheet(
    'Сотрудники',
    ['Сотрудник', 'Продажи', 'Выручка', 'Прибыль', 'Средний чек'],
    rows.map((row) => [row.userId, row.salesCount, row.revenue, row.grossProfit, row.averageCheck]),
  )
}

function paymentMethodSheet(rows: readonly PaymentAnalyticsRow[]): ExcelSheet {
  return sheet(
    'Оплаты аналитики',
    ['Метод', 'Количество', 'Сумма'],
    rows.map((row) => [row.method, row.count, row.amount]),
  )
}

function expenseCategorySheet(rows: readonly ExpenseAnalyticsRow[]): ExcelSheet {
  return sheet(
    'Расходы аналитики',
    ['Категория', 'Количество', 'Сумма', 'Доля %'],
    rows.map((row) => [row.category, row.count, row.amount, row.sharePercent]),
  )
}
