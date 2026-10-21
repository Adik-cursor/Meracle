import type {
  Expense,
  ExpenseCategory,
  Id,
  PaymentMethod,
  Product,
  Sale,
  SaleItem,
  User,
} from '../types'
import { fail, ok, type ServiceResult } from '../types/domain-error'
import type { Persistence } from '../repositories/persistence'
import { listSalesForAnalytics } from './sales'
import { listExpensesForUser } from './expenses'
import { getReturnedQuantity } from './sale-returns'
import { lineCost } from './weighted-average'
import { canAccessUser, hasEffectiveFinancialPermission, requireCurrentUser } from './access'
import { requireAccessibleWarehouse } from './warehouse-access'
import { requireModuleEnabledForUser } from './organization-modules'

export type AnalyticsPeriod =
  | 'today'
  | 'yesterday'
  | '7d'
  | '30d'
  | 'week'
  | 'month'
  | 'last_month'
  | 'quarter'
  | 'year'
  | 'custom'

export type AnalyticsRange = {
  from: string
  to: string
}

export type AnalyticsItemTypeFilter = 'all' | 'product' | 'service'

export type AnalyticsQuery = {
  branchId?: Id
  warehouseId?: Id
  userId?: Id
  itemType?: AnalyticsItemTypeFilter
  paymentMethod?: PaymentMethod | 'all'
  expenseCategory?: ExpenseCategory | 'all'
}

export type AnalyticsKpis = {
  revenue: number
  cogs: number
  grossProfit: number
  expenses: number
  netProfit: number
  marginPercent: number
  salesCount: number
  averageCheck: number
  discounts: number
  averageDiscount: number
  productUnits: number
  serviceUnits: number
}

export type AnalyticsKpiDelta = {
  revenue?: number
  cogs?: number
  grossProfit?: number
  expenses?: number
  netProfit?: number
  marginPercent?: number
  salesCount?: number
  averageCheck?: number
}

export type ProductAnalyticsRow = {
  productId: Id
  name: string
  sku: string
  itemType: Product['itemType']
  quantity: number
  returnedQuantity: number
  revenue: number
  discounts: number
  cogs: number
  grossProfit: number
  marginPercent: number
}

export type ExpenseAnalyticsRow = {
  category: ExpenseCategory
  count: number
  amount: number
  sharePercent: number
}

export type ExpenseBranchRow = {
  branchId: Id | ''
  amount: number
  sharePercent: number
}

export type PaymentAnalyticsRow = {
  method: PaymentMethod
  count: number
  amount: number
}

export type EmployeeAnalyticsRow = {
  userId: Id
  salesCount: number
  revenue: number
  discounts: number
  returnedQuantity: number
  grossProfit: number
  averageCheck: number
}

export type RevenuePoint = {
  bucket: string
  revenue: number
}

export type AnalyticsSeriesPoint = {
  bucket: string
  value: number
}

export type ChartGranularity = 'day' | 'week' | 'month'

export type FinancialAnalytics = {
  kpis: AnalyticsKpis
  previousKpis: AnalyticsKpis | null
  deltas: AnalyticsKpiDelta
  products: ProductAnalyticsRow[]
  services: ProductAnalyticsRow[]
  expenses: ExpenseAnalyticsRow[]
  expenseItems: Expense[]
  payments: PaymentAnalyticsRow[]
  employees: EmployeeAnalyticsRow[]
  expenseBranches: ExpenseBranchRow[]
  revenueSeries: RevenuePoint[]
  profitSeries: AnalyticsSeriesPoint[]
  expenseSeries: AnalyticsSeriesPoint[]
  chartGranularity: ChartGranularity
  hasSales: boolean
  hasExpenses: boolean
}

const PAYMENT_METHODS: readonly PaymentMethod[] = [
  'cash',
  'card',
  'bank_transfer',
  'invoice',
  'on_credit',
  'other',
]

function utcDate(year: number, month: number, day: number, endOfDay = false): Date {
  if (endOfDay) {
    return new Date(Date.UTC(year, month, day, 23, 59, 59, 999))
  }

  return new Date(Date.UTC(year, month, day, 0, 0, 0, 0))
}

function startOfUtcDay(date: Date): Date {
  return utcDate(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

function endOfUtcDay(date: Date): Date {
  return utcDate(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), true)
}

export function customRangeFromDateInputs(fromDate: string, toDate: string): AnalyticsRange {
  const from = new Date(`${fromDate}T00:00:00.000Z`)
  const to = new Date(`${toDate}T23:59:59.999Z`)
  return {
    from: from.toISOString(),
    to: to.toISOString(),
  }
}

export function resolveAnalyticsRange(
  period: AnalyticsPeriod,
  nowIso: string,
  custom?: AnalyticsRange,
): AnalyticsRange {
  if (period === 'custom' && custom) {
    return custom
  }

  const now = new Date(nowIso)
  const todayStart = startOfUtcDay(now)

  if (period === 'yesterday') {
    const day = new Date(todayStart)
    day.setUTCDate(day.getUTCDate() - 1)
    return {
      from: startOfUtcDay(day).toISOString(),
      to: endOfUtcDay(day).toISOString(),
    }
  }

  if (period === 'last_month') {
    const firstThisMonth = utcDate(now.getUTCFullYear(), now.getUTCMonth(), 1)
    const lastPrev = new Date(firstThisMonth.getTime() - 1)
    const firstPrev = utcDate(lastPrev.getUTCFullYear(), lastPrev.getUTCMonth(), 1)
    return {
      from: firstPrev.toISOString(),
      to: endOfUtcDay(lastPrev).toISOString(),
    }
  }

  const start = startOfUtcDay(now)

  if (period === 'week') {
    const day = start.getUTCDay() || 7
    start.setUTCDate(start.getUTCDate() - day + 1)
  } else if (period === '7d') {
    start.setUTCDate(start.getUTCDate() - 6)
  } else if (period === '30d') {
    start.setUTCDate(start.getUTCDate() - 29)
  } else if (period === 'month') {
    start.setUTCDate(1)
  } else if (period === 'quarter') {
    const month = start.getUTCMonth()
    start.setUTCMonth(month - (month % 3), 1)
  } else if (period === 'year') {
    start.setUTCMonth(0, 1)
  }

  return {
    from: start.toISOString(),
    to: now.toISOString(),
  }
}

export function resolvePreviousAnalyticsRange(
  period: AnalyticsPeriod,
  current: AnalyticsRange,
  nowIso: string,
): AnalyticsRange {
  const now = new Date(nowIso)

  if (period === 'today') {
    return resolveAnalyticsRange('yesterday', nowIso)
  }

  if (period === 'yesterday') {
    const from = new Date(current.from)
    from.setUTCDate(from.getUTCDate() - 1)
    return {
      from: startOfUtcDay(from).toISOString(),
      to: endOfUtcDay(from).toISOString(),
    }
  }

  if (period === 'month') {
    return resolveAnalyticsRange('last_month', nowIso)
  }

  if (period === 'last_month') {
    const from = new Date(current.from)
    from.setUTCMonth(from.getUTCMonth() - 1)
    const to = new Date(current.from)
    to.setUTCDate(0)
    return {
      from: utcDate(from.getUTCFullYear(), from.getUTCMonth(), 1).toISOString(),
      to: endOfUtcDay(to).toISOString(),
    }
  }

  if (period === 'quarter') {
    const start = new Date(current.from)
    start.setUTCMonth(start.getUTCMonth() - 3, 1)
    const end = new Date(current.from)
    end.setUTCDate(0)
    return {
      from: startOfUtcDay(start).toISOString(),
      to: endOfUtcDay(end).toISOString(),
    }
  }

  if (period === 'year') {
    const year = now.getUTCFullYear() - 1
    return {
      from: utcDate(year, 0, 1).toISOString(),
      to: endOfUtcDay(utcDate(year, 11, 31)).toISOString(),
    }
  }

  const fromMs = new Date(current.from).getTime()
  const toMs = new Date(current.to).getTime()
  const length = Math.max(0, toMs - fromMs)
  const previousTo = fromMs - 1
  return {
    from: new Date(previousTo - length).toISOString(),
    to: new Date(previousTo).toISOString(),
  }
}

export function analyticsStampInRange(iso: string, range: AnalyticsRange): boolean {
  return iso >= range.from && iso <= range.to
}

function inRange(iso: string, range: AnalyticsRange): boolean {
  return analyticsStampInRange(iso, range)
}

function expenseInRange(expense: Expense, range: AnalyticsRange): boolean {
  const stamp = expense.date.includes('T')
    ? expense.date
    : `${expense.date}T00:00:00.000Z`
  return inRange(stamp, range)
}

function marginPercent(grossProfit: number, revenue: number): number {
  if (revenue <= 0) {
    return 0
  }

  return (grossProfit / revenue) * 100
}

function netLine(item: SaleItem, returnedQty: number) {
  const remaining = Math.max(0, item.quantity - returnedQty)
  const ratio = item.quantity === 0 ? 0 : remaining / item.quantity
  const revenue = item.total * ratio
  const discounts = item.discount * ratio
  const cogs = lineCost(remaining, item.costPrice ?? 0)

  return { remaining, revenue, discounts, cogs }
}

function emptyKpis(): AnalyticsKpis {
  return {
    revenue: 0,
    cogs: 0,
    grossProfit: 0,
    expenses: 0,
    netProfit: 0,
    marginPercent: 0,
    salesCount: 0,
    averageCheck: 0,
    discounts: 0,
    averageDiscount: 0,
    productUnits: 0,
    serviceUnits: 0,
  }
}

function finalizeKpis(kpis: AnalyticsKpis): AnalyticsKpis {
  kpis.grossProfit = kpis.revenue - kpis.cogs
  kpis.netProfit = kpis.grossProfit - kpis.expenses
  kpis.marginPercent = marginPercent(kpis.grossProfit, kpis.revenue)
  kpis.averageCheck =
    kpis.salesCount > 0 ? kpis.revenue / kpis.salesCount : 0
  kpis.averageDiscount =
    kpis.salesCount > 0 ? kpis.discounts / kpis.salesCount : 0
  return kpis
}

function percentChange(current: number, previous: number): number | undefined {
  if (previous === 0) {
    return undefined
  }

  return ((current - previous) / Math.abs(previous)) * 100
}

function buildDeltas(
  current: AnalyticsKpis,
  previous: AnalyticsKpis | null,
): AnalyticsKpiDelta {
  if (!previous) {
    return {}
  }

  const previousHasData =
    previous.revenue !== 0 ||
    previous.expenses !== 0 ||
    previous.salesCount !== 0

  if (!previousHasData) {
    return {}
  }

  return {
    revenue: percentChange(current.revenue, previous.revenue),
    cogs: percentChange(current.cogs, previous.cogs),
    grossProfit: percentChange(current.grossProfit, previous.grossProfit),
    expenses: percentChange(current.expenses, previous.expenses),
    netProfit: percentChange(current.netProfit, previous.netProfit),
    marginPercent: percentChange(current.marginPercent, previous.marginPercent),
    salesCount: percentChange(current.salesCount, previous.salesCount),
    averageCheck: percentChange(current.averageCheck, previous.averageCheck),
  }
}

export function resolveChartGranularity(range: AnalyticsRange): ChartGranularity {
  const ms = new Date(range.to).getTime() - new Date(range.from).getTime()
  const days = ms / 86_400_000
  if (days > 366) {
    return 'month'
  }

  if (days > 92) {
    return 'week'
  }

  return 'day'
}

function isoWeekBucket(iso: string): string {
  const date = new Date(iso)
  const utc = startOfUtcDay(date)
  const day = utc.getUTCDay() || 7
  utc.setUTCDate(utc.getUTCDate() - day + 1)
  return utc.toISOString().slice(0, 10)
}

function bucketKey(iso: string, granularity: ChartGranularity): string {
  if (granularity === 'month') {
    return iso.slice(0, 7)
  }

  if (granularity === 'week') {
    return isoWeekBucket(iso)
  }

  return iso.slice(0, 10)
}

function salePayments(persistence: Persistence, sale: Sale) {
  return persistence.payments
    .listBySaleId(sale.organizationId, sale.id)
    .filter((payment) => payment.status === 'completed')
}

function saleCashierId(persistence: Persistence, sale: Sale): Id | undefined {
  return salePayments(persistence, sale)[0]?.createdBy
}

function itemIsService(
  persistence: Persistence,
  item: SaleItem,
): boolean {
  return persistence.products.getById(item.productId)?.itemType === 'service'
}

function lineMatchesQuery(
  persistence: Persistence,
  sale: Sale,
  item: SaleItem,
  query: AnalyticsQuery,
): boolean {
  const service = itemIsService(persistence, item)
  const itemType = query.itemType ?? 'all'

  if (itemType === 'product' && service) {
    return false
  }

  if (itemType === 'service' && !service) {
    return false
  }

  if (query.warehouseId) {
    if (service) {
      return false
    }

    const warehouseId = item.warehouseId ?? sale.warehouseId
    if (warehouseId !== query.warehouseId) {
      return false
    }
  }

  if (query.branchId) {
    if (service) {
      const warehouseId = item.warehouseId ?? sale.warehouseId
      if (warehouseId) {
        const warehouse = persistence.warehouses.getById(warehouseId)
        return warehouse?.branchId === query.branchId
      }

      const cashierId = saleCashierId(persistence, sale)
      const cashier = cashierId
        ? persistence.users.getById(cashierId)
        : undefined
      return cashier?.branchId === query.branchId
    }

    const warehouseId = item.warehouseId ?? sale.warehouseId
    if (!warehouseId) {
      return false
    }

    const warehouse = persistence.warehouses.getById(warehouseId)
    return warehouse?.branchId === query.branchId
  }

  return true
}

function saleMatchesSaleFilters(
  persistence: Persistence,
  sale: Sale,
  query: AnalyticsQuery,
): boolean {
  if (query.userId) {
    if (saleCashierId(persistence, sale) !== query.userId) {
      return false
    }
  }

  if (query.paymentMethod && query.paymentMethod !== 'all') {
    const methods = salePayments(persistence, sale).map((payment) => payment.method)
    if (!methods.includes(query.paymentMethod)) {
      return false
    }
  }

  return true
}

function validateQuery(
  persistence: Persistence,
  actor: User,
  query: AnalyticsQuery,
): ServiceResult<void> {
  if (query.warehouseId) {
    const warehouse = requireAccessibleWarehouse(
      persistence,
      actor,
      query.warehouseId,
    )
    if (!warehouse.ok) {
      return warehouse
    }
  }

  if (query.branchId) {
    const branch = persistence.branches.getById(query.branchId)
    if (!branch || branch.organizationId !== actor.organizationId) {
      return fail({ code: 'ACCESS_DENIED' })
    }

    if (actor.role === 'branch_director' && actor.branchId !== query.branchId) {
      return fail({ code: 'ACCESS_DENIED' })
    }

    if (actor.role === 'sales_manager' && actor.branchId !== query.branchId) {
      return fail({ code: 'ACCESS_DENIED' })
    }
  }

  if (query.userId) {
    const user = persistence.users.getById(query.userId)
    if (!user || !canAccessUser(actor, user)) {
      return fail({ code: 'ACCESS_DENIED' })
    }
  }

  return ok(undefined)
}

function buildReport(
  persistence: Persistence,
  actor: User,
  range: AnalyticsRange,
  query: AnalyticsQuery,
  canSales: boolean,
  canExpenses: boolean,
): FinancialAnalytics {
  const kpis = emptyKpis()
  const productRows = new Map<Id, ProductAnalyticsRow>()
  const employeeRows = new Map<Id, EmployeeAnalyticsRow>()
  const paymentRows = new Map<PaymentMethod, PaymentAnalyticsRow>(
    PAYMENT_METHODS.map((method) => [
      method,
      { method, count: 0, amount: 0 },
    ]),
  )
  const granularity = resolveChartGranularity(range)
  const revenueBuckets = new Map<string, number>()
  const profitBuckets = new Map<string, number>()
  const expenseBuckets = new Map<string, number>()
  let hasSales = false

  const sales: Sale[] = canSales
    ? (() => {
        const listed = listSalesForAnalytics(persistence, actor)
        return listed.ok
          ? listed.value.filter(
              (sale) =>
                sale.status === 'completed' &&
                inRange(sale.createdAt, range) &&
                saleMatchesSaleFilters(persistence, sale, query),
            )
          : []
      })()
    : []

  for (const sale of sales) {
    const items = persistence.saleItems.listBySaleId(sale.id)
    let saleNet = 0
    let saleDiscount = 0
    let saleCogs = 0
    let saleReturned = 0
    let matchedLines = 0

    for (const item of items) {
      if (!lineMatchesQuery(persistence, sale, item, query)) {
        continue
      }

      matchedLines += 1
      const returned = getReturnedQuantity(
        persistence,
        actor.organizationId,
        item.id,
      )
      const net = netLine(item, returned)
      saleNet += net.revenue
      saleDiscount += net.discounts
      saleCogs += net.cogs
      saleReturned += returned

      const product = persistence.products.getById(item.productId)
      const name = product?.name ?? item.productId
      const sku = product?.sku ?? ''
      const itemType = product?.itemType ?? 'product'
      if (itemType === 'service') {
        kpis.serviceUnits += net.remaining
      } else {
        kpis.productUnits += net.remaining
      }
      const existing = productRows.get(item.productId)
      const next: ProductAnalyticsRow = existing ?? {
        productId: item.productId,
        name,
        sku,
        itemType,
        quantity: 0,
        returnedQuantity: 0,
        revenue: 0,
        discounts: 0,
        cogs: 0,
        grossProfit: 0,
        marginPercent: 0,
      }

      next.quantity += net.remaining
      next.returnedQuantity += returned
      next.revenue += net.revenue
      next.discounts += net.discounts
      next.cogs += net.cogs
      next.grossProfit = next.revenue - next.cogs
      next.marginPercent = marginPercent(next.grossProfit, next.revenue)
      productRows.set(item.productId, next)
    }

    if (matchedLines === 0) {
      continue
    }

    if (sale.subtotal > 0 && sale.discount > 0) {
      const remainingShare = saleNet / sale.subtotal
      saleDiscount += sale.discount * remainingShare
      saleNet *= sale.total / sale.subtotal
    }

    hasSales = true
    kpis.revenue += saleNet
    kpis.discounts += saleDiscount
    kpis.cogs += saleCogs
    kpis.salesCount += 1

    const bucket = bucketKey(sale.createdAt, granularity)
    revenueBuckets.set(bucket, (revenueBuckets.get(bucket) ?? 0) + saleNet)
    profitBuckets.set(
      bucket,
      (profitBuckets.get(bucket) ?? 0) + (saleNet - saleCogs),
    )

    const cashierId = saleCashierId(persistence, sale)
    if (cashierId) {
      const employee = employeeRows.get(cashierId) ?? {
        userId: cashierId,
        salesCount: 0,
        revenue: 0,
        discounts: 0,
        returnedQuantity: 0,
        grossProfit: 0,
        averageCheck: 0,
      }
      employee.salesCount += 1
      employee.revenue += saleNet
      employee.discounts += saleDiscount
      employee.returnedQuantity += saleReturned
      employee.grossProfit += saleNet - saleCogs
      employee.averageCheck =
        employee.salesCount > 0 ? employee.revenue / employee.salesCount : 0
      employeeRows.set(cashierId, employee)
    }

    for (const payment of salePayments(persistence, sale)) {
      const row = paymentRows.get(payment.method)
      if (!row) {
        continue
      }
      row.count += 1
      row.amount += payment.amount
    }
  }

  const expenseList = canExpenses
    ? (() => {
        const listed = listExpensesForUser(persistence, actor)
        return listed.ok
          ? listed.value.filter((expense) => {
              if (!expenseInRange(expense, range)) {
                return false
              }

              if (query.branchId && expense.branchId !== query.branchId) {
                return false
              }

              if (query.expenseCategory && query.expenseCategory !== 'all') {
                return expense.category === query.expenseCategory
              }

              return true
            })
          : []
      })()
    : []

  const expenseRows = new Map<ExpenseCategory, ExpenseAnalyticsRow>()
  const expenseBranchRows = new Map<string, ExpenseBranchRow>()
  for (const expense of expenseList) {
    const current = expenseRows.get(expense.category) ?? {
      category: expense.category,
      count: 0,
      amount: 0,
      sharePercent: 0,
    }
    current.count += 1
    current.amount += expense.amount
    expenseRows.set(expense.category, current)
    kpis.expenses += expense.amount

    const branchKey = expense.branchId ?? ''
    const branchRow = expenseBranchRows.get(branchKey) ?? {
      branchId: branchKey,
      amount: 0,
      sharePercent: 0,
    }
    branchRow.amount += expense.amount
    expenseBranchRows.set(branchKey, branchRow)

    const stamp = expense.date.includes('T')
      ? expense.date
      : `${expense.date}T00:00:00.000Z`
    const bucket = bucketKey(stamp, granularity)
    expenseBuckets.set(bucket, (expenseBuckets.get(bucket) ?? 0) + expense.amount)
  }

  finalizeKpis(kpis)

  for (const row of expenseRows.values()) {
    row.sharePercent =
      kpis.expenses > 0 ? (row.amount / kpis.expenses) * 100 : 0
  }

  for (const row of expenseBranchRows.values()) {
    row.sharePercent =
      kpis.expenses > 0 ? (row.amount / kpis.expenses) * 100 : 0
  }

  const toSeries = (buckets: Map<string, number>): AnalyticsSeriesPoint[] =>
    [...buckets.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([bucket, value]) => ({ bucket, value }))

  const rows = [...productRows.values()].sort((a, b) => b.revenue - a.revenue)
  const canEmployees =
    canSales &&
    (actor.role === 'sales_manager' ||
      actor.role === 'branch_director' ||
      actor.role === 'commercial_director' ||
      actor.role === 'owner')

  return {
    kpis,
    previousKpis: null,
    deltas: {},
    products: rows.filter((row) => row.itemType !== 'service'),
    services: rows.filter((row) => row.itemType === 'service'),
    expenses: [...expenseRows.values()].sort((a, b) => b.amount - a.amount),
    expenseItems: [...expenseList].sort((a, b) => b.date.localeCompare(a.date)),
    expenseBranches: [...expenseBranchRows.values()].sort(
      (a, b) => b.amount - a.amount,
    ),
    payments: PAYMENT_METHODS.map(
      (method) => paymentRows.get(method) ?? { method, count: 0, amount: 0 },
    ),
    employees: canEmployees
      ? [...employeeRows.values()].sort((a, b) => b.revenue - a.revenue)
      : [],
    revenueSeries: toSeries(revenueBuckets).map((point) => ({
      bucket: point.bucket,
      revenue: point.value,
    })),
    profitSeries: toSeries(profitBuckets),
    expenseSeries: toSeries(expenseBuckets),
    chartGranularity: granularity,
    hasSales,
    hasExpenses: expenseList.length > 0,
  }
}

export function getFinancialAnalyticsForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  range: AnalyticsRange,
  query: AnalyticsQuery = {},
  previousRange?: AnalyticsRange,
): ServiceResult<FinancialAnalytics> {
  const gated = requireModuleEnabledForUser(persistence, currentUser, 'analytics')
  if (!gated.ok) {
    return gated
  }

  const actor = requireCurrentUser(currentUser)
  if (!actor.ok) {
    return actor
  }

  const canSales = hasEffectiveFinancialPermission(
    actor.value,
    'financial_analytics.read',
  )
  const canExpenses = hasEffectiveFinancialPermission(actor.value, 'expenses.read')

  if (!canSales && !canExpenses) {
    return fail({ code: 'ACCESS_DENIED' })
  }

  const allowedQuery = validateQuery(persistence, actor.value, query)
  if (!allowedQuery.ok) {
    return allowedQuery
  }

  const current = buildReport(
    persistence,
    actor.value,
    range,
    query,
    canSales,
    canExpenses,
  )

  if (previousRange) {
    const previous = buildReport(
      persistence,
      actor.value,
      previousRange,
      query,
      canSales,
      canExpenses,
    )
    current.previousKpis = previous.kpis
    current.deltas = buildDeltas(current.kpis, previous.kpis)
  }

  return ok(current)
}
