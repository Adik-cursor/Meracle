import type { DealStatus, Expense, Id, IsoDateTime, User } from '../types'
import { ok, fail, type ServiceResult } from '../types/domain-error'
import type { Persistence } from '../repositories/persistence'
import {
  canAccessDeal,
  canAccessMotivationPlans,
  getAccessScope,
  hasEffectiveCarePermission,
  hasEffectiveFinancialPermission,
  hasEffectiveWarehousePermission,
  requireCurrentUser,
} from './access'
import {
  debtDashboardTotalsForUser,
  listCustomerDebtsForUser,
} from './customer-debts'
import { listDealsForUser } from './deals'
import {
  currentMotivationPeriodKey,
  getEmployeeMotivationForUser,
  listCompanyMotivationPlansForUser,
  type CompanyMotivationPlansView,
  type MotivationView,
} from './employee-motivation'
import { listExpensesForUser, todayExpenseDateInput } from './expenses'
import { getCareOperationsSnapshotForUser } from './care-analytics'
import { sumCompletedCarePaymentsForPeriod } from './care-finance'
import {
  analyticsStampInRange,
  getFinancialAnalyticsForUser,
  type AnalyticsRange,
} from './financial-analytics'
import { listAccessibleInventoryForUser } from './inventory'
import { isModuleEnabledForUser } from './organization-modules'
import { isUserAccountEnabled } from './user-account'
import { rentalItemQuantity } from './rental-availability'
import { getRentalAnalyticsForUser } from './rental-analytics'
import {
  listRentalBookingsForUser,
  rentalBookingBalance,
  rentalBookingPrepayment,
  type RentalBookingRead,
} from './rental-bookings'
import { listRentalRemindersForUser } from './rental-reminders'
import { listProductsForUser } from './products'
import { nowIso } from './primitives'
import { listSalesForUser } from './sales'
import { canReadPayment } from './financial-access'
import { getDueAmount, roundMoney, sumCompletedPayments } from '../../modules/sales/sale-payment'

export type DashboardQuickActions = {
  newSale: boolean
  newDeal: boolean
  receiveStock: boolean
  newExpense: boolean
  addChild: boolean
  createGroup: boolean
  markAttendance: boolean
  acceptPayment: boolean
}

export type CareDashboardApplication = {
  id: Id
  title: string
  status: DealStatus
  createdAt: IsoDateTime
  phone?: string
}

export type CareDashboardDebtRow = {
  customerId: Id
  remaining: number
}

export type CareDashboardGroup = {
  id: Id
  name: string
  childCount: number
  capacity: number
  freePlaces: number
  occupancyPercent: number
  full: boolean
}

export type CareDashboardView = {
  newApplications: number
  newApplicationsToday: number
  applicationsIncluded: boolean
  applications: CareDashboardApplication[]
  groups: CareDashboardGroup[]
  childrenIncluded: boolean
  attendanceIncluded: boolean
  enrolled: number
  present: number
  absent: number
  unmarked: number
  freePlaces: number
  attendancePercent: number
  staffEnrolled: number
  staffPresent: number
  staffAbsent: number
  staffUnmarked: number
  staffAttendancePercent: number
  paymentsIncluded: boolean
  paidAmount: number
  expensesIncluded: boolean
  expenses: number
  netResult: number
  debtsIncluded: boolean
  debtRemaining: number
  debtors: number
  overdueAmount: number
  topDebts: CareDashboardDebtRow[]
}

export type CompanyDashboardView = {
  sales?: {
    revenue: number
    count: number
    averageCheck: number
    canReadAmount: boolean
    overdueInvoices: number
    personal: boolean
  }
  companyPlans?: CompanyMotivationPlansView
  ownMotivation?: MotivationView
  debts?: {
    remaining: number
    overdue: number
    paidInPeriod: number
    debtors: number
  }
  analytics?: {
    netProfit: number
    expenses: number
    marginPercent: number
    revenueChangePercent?: number
    revenueSeries: { bucket: string; revenue: number }[]
  }
  expenses?: {
    total: number
  }
  warehouse?: {
    products: number
    stock: number
    zeroStock: number
  }
  crm?: {
    deals: number
    newDeals: number
    inProgress: number
  }
  rental?: {
    bookings: number
    active: number
    overdue: number
    dueAmount: number
    issuedToday: number
    returnsToday: number
    newBookingsToday: number
    rentalTotal: number
    paidAmount: number
    prepayment: number
    expenses: number
    netResult: number
    paymentsIncluded: boolean
    expensesIncluded: boolean
    planTarget: number
    planPaid: number
    planCompletion: number
    planRemaining: number
    upcomingIssues: RentalDashboardBookingRow[]
    dueReturns: RentalDashboardBookingRow[]
    popularProducts: RentalDashboardProductRow[]
    cashflow: RentalDashboardCashflowPoint[]
  }
  care?: CareDashboardView
  quickActions: DashboardQuickActions
}

export type DashboardSectionFlags = {
  sales: boolean
  rental: boolean
  children: boolean
  attendance: boolean
  expenses: boolean
  warehouse: boolean
  crm: boolean
  plans: boolean
  analytics: boolean
}

export function resolveDashboardSections(modules: {
  sales?: boolean
  rental?: boolean
  children?: boolean
  attendance?: boolean
  expenses?: boolean
  warehouses?: boolean
  crm?: boolean
  plans?: boolean
  analytics?: boolean
}): DashboardSectionFlags {
  return {
    sales: modules.sales === true,
    rental: modules.rental === true,
    children: modules.children === true,
    attendance: modules.attendance === true,
    expenses: modules.expenses === true,
    warehouse: modules.warehouses === true,
    crm: modules.crm === true,
    plans: modules.plans === true,
    analytics: modules.analytics === true,
  }
}

export function isCareOperationsDashboard(modules: {
  sales?: boolean
  rental?: boolean
  children?: boolean
  attendance?: boolean
}): boolean {
  return modules.children === true || modules.attendance === true
}

export type CompanyDashboardQuery = {
  range?: AnalyticsRange
  timeZone?: string
}

export type RentalDashboardBookingRow = {
  bookingId: Id
  customerId: Id
  startAt: IsoDateTime
  endAt: IsoDateTime
  productId?: Id
  quantity: number
  prepayment: number
  dueAmount: number
  status: RentalBookingRead['status']
  viewStatus: RentalBookingRead['viewStatus']
}

export type RentalDashboardProductRow = {
  productId: Id
  count: number
  quantity: number
  total: number
}

export type RentalDashboardCashflowPoint = {
  bucket: string
  paid: number
  expenses: number
}

function isCompanyWideScope(user: User): boolean {
  const scope = getAccessScope(user)
  return scope !== 'own' && scope !== 'warehouse'
}

function monthRange(periodKey: string): { from: string; to: string } {
  const [yearText, monthText] = periodKey.split('-')
  const year = Number(yearText)
  const month = Number(monthText)
  if (!year || !month) {
    return { from: `${periodKey}-01T00:00:00.000Z`, to: `${periodKey}-31T23:59:59.999Z` }
  }

  const from = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0))
  const to = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999))
  return { from: from.toISOString(), to: to.toISOString() }
}

function dashboardDayKey(iso: IsoDateTime, timeZone?: string): string {
  if (!timeZone) {
    return iso.slice(0, 10)
  }

  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(iso))
  } catch {
    return iso.slice(0, 10)
  }
}

function expenseStamp(expense: Expense): string {
  return expense.date.includes('T') ? expense.date : `${expense.date}T00:00:00.000Z`
}

function utcDayKeys(range: AnalyticsRange): string[] {
  const keys: string[] = []
  const cursor = new Date(`${range.from.slice(0, 10)}T00:00:00.000Z`)
  const last = new Date(`${range.to.slice(0, 10)}T00:00:00.000Z`)
  if (Number.isNaN(cursor.getTime()) || Number.isNaN(last.getTime())) {
    return keys
  }

  while (cursor.getTime() <= last.getTime()) {
    keys.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  return keys
}

function toRentalDashboardRow(booking: RentalBookingRead): RentalDashboardBookingRow {
  const first = booking.items[0]
  return {
    bookingId: booking.id,
    customerId: booking.customerId,
    startAt: booking.startAt,
    endAt: booking.endAt,
    productId: first?.productId,
    quantity: booking.items.reduce((sum, item) => sum + rentalItemQuantity(item), 0),
    prepayment: rentalBookingPrepayment(booking),
    dueAmount: rentalBookingBalance(booking),
    status: booking.status,
    viewStatus: booking.viewStatus,
  }
}

export function getCompanyDashboardForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  periodKey = currentMotivationPeriodKey(nowIso()),
  query: CompanyDashboardQuery = {},
): ServiceResult<CompanyDashboardView> {
  const actor = requireCurrentUser(currentUser)
  if (!actor.ok) {
    return actor
  }

  if (!isUserAccountEnabled(actor.value)) {
    return fail({ code: 'ACCESS_DENIED' })
  }

  const user = actor.value
  const view: CompanyDashboardView = {
    quickActions: {
      newSale: false,
      newDeal: false,
      receiveStock: false,
      newExpense: false,
      addChild: false,
      createGroup: false,
      markAttendance: false,
      acceptPayment: false,
    },
  }

  const salesModule = isModuleEnabledForUser(persistence, user, 'sales')
  const analyticsModule = isModuleEnabledForUser(persistence, user, 'analytics')
  const expensesModule = isModuleEnabledForUser(persistence, user, 'expenses')
  const warehouseModule = isModuleEnabledForUser(persistence, user, 'warehouse')
  const rentalModule = isModuleEnabledForUser(persistence, user, 'rental')
  const crmModule = isModuleEnabledForUser(persistence, user, 'crm')
  const childrenModule = isModuleEnabledForUser(persistence, user, 'children')
  const attendanceModule = isModuleEnabledForUser(persistence, user, 'attendance')
  const plansModule = isModuleEnabledForUser(persistence, user, 'plans')
  const canReadSales =
    salesModule && hasEffectiveFinancialPermission(user, 'sales.read')
  if (canReadSales) {
    const listed = listSalesForUser(persistence, user)
    if (listed.ok) {
      const scoped =
        getAccessScope(user) === 'own'
          ? listed.value.filter((sale) => {
              const cashier = persistence.payments
                .listBySaleId(sale.organizationId, sale.id)
                .find((payment) => payment.status === 'completed')?.createdBy
              return cashier === user.id
            })
          : listed.value
      const completed = scoped.filter((sale) => sale.status === 'completed')
      const canReadAmount = hasEffectiveFinancialPermission(user, 'sales.read_amount')
      const revenue = canReadAmount
        ? roundMoney(completed.reduce((sum, sale) => sum + sale.total, 0))
        : 0
      const count = completed.length
      const today = nowIso().slice(0, 10)
      const overdueInvoices = completed.filter((sale) => {
        const due = sale.invoiceDueDate
        if (!due || due >= today) {
          return false
        }
        const paid = sumCompletedPayments(
          persistence.payments.listBySaleId(sale.organizationId, sale.id),
        )
        const dueAmount = getDueAmount(sale.total, paid)
        return dueAmount > 0
      }).length
      view.sales = {
        revenue,
        count,
        averageCheck: count > 0 && canReadAmount ? roundMoney(revenue / count) : 0,
        canReadAmount,
        overdueInvoices,
        personal: getAccessScope(user) === 'own',
      }
    }

    view.quickActions.newSale = hasEffectiveFinancialPermission(user, 'sales.create')
  }

  if (plansModule && canAccessMotivationPlans(user)) {
    const plans = listCompanyMotivationPlansForUser(persistence, user, periodKey)
    if (plans.ok) {
      view.companyPlans = plans.value
    }
  } else if (plansModule) {
    const own = getEmployeeMotivationForUser(persistence, user, user.id, periodKey)
    if (own.ok && own.value) {
      view.ownMotivation = own.value
    }
  }

  const canReadDebts =
    salesModule &&
    isCompanyWideScope(user) &&
    hasEffectiveFinancialPermission(user, 'sales.read') &&
    hasEffectiveFinancialPermission(user, 'payments.read')
  if (canReadDebts) {
    const debts = debtDashboardTotalsForUser(persistence, user, periodKey)
    if (debts.ok) {
      view.debts = debts.value
    }
  }

  if (
    analyticsModule &&
    salesModule &&
    hasEffectiveFinancialPermission(user, 'financial_analytics.read')
  ) {
    const range = monthRange(periodKey)
    const analytics = getFinancialAnalyticsForUser(persistence, user, range)
    if (analytics.ok) {
      const previousRevenue = analytics.value.previousKpis?.revenue
      const currentRevenue = analytics.value.kpis.revenue
      const revenueChangePercent =
        previousRevenue && previousRevenue !== 0
          ? ((currentRevenue - previousRevenue) / previousRevenue) * 100
          : undefined
      view.analytics = {
        netProfit: analytics.value.kpis.netProfit,
        expenses: analytics.value.kpis.expenses,
        marginPercent: analytics.value.kpis.marginPercent,
        revenueChangePercent,
        revenueSeries: analytics.value.revenueSeries,
      }
    }
  }

  if (
    expensesModule &&
    hasEffectiveFinancialPermission(user, 'expenses.read') &&
    !view.analytics
  ) {
    const expenses = listExpensesForUser(persistence, user)
    if (expenses.ok) {
      view.expenses = {
        total: roundMoney(expenses.value.reduce((sum, item) => sum + item.amount, 0)),
      }
    }
  }
  if (expensesModule && hasEffectiveFinancialPermission(user, 'expenses.create')) {
    view.quickActions.newExpense = true
  }

  const canReadWarehouseKpi =
    warehouseModule &&
    hasEffectiveWarehousePermission(user, 'inventory.read') &&
    (hasEffectiveWarehousePermission(user, 'analytics.read') ||
      getAccessScope(user) === 'warehouse')
  if (canReadWarehouseKpi) {
    const inventory = listAccessibleInventoryForUser(persistence, user)
    const products = listProductsForUser(persistence, user)
    if (inventory.ok && products.ok) {
      view.warehouse = {
        products: products.value.filter((product) => product.itemType === 'product').length,
        stock: inventory.value.reduce((sum, item) => sum + item.quantity, 0),
        zeroStock: inventory.value.filter((item) => item.quantity === 0).length,
      }
    }
  }
  if (warehouseModule && hasEffectiveWarehousePermission(user, 'receipt.create')) {
    view.quickActions.receiveStock = true
  }

  if (crmModule && isCompanyWideScope(user)) {
    const deals = listDealsForUser(persistence, user)
    if (deals.ok) {
      view.crm = {
        deals: deals.value.length,
        newDeals: deals.value.filter((deal) => deal.status === 'new').length,
        inProgress: deals.value.filter((deal) => deal.status === 'in_progress').length,
      }
    }
  }
  if (
    crmModule &&
    canAccessDeal(persistence, user, {
      organizationId: user.organizationId,
      assignedUserId: user.id,
    })
  ) {
    view.quickActions.newDeal = true
  }

  if (childrenModule || attendanceModule) {
    const range = query.range ?? monthRange(periodKey)
    const today = todayExpenseDateInput()
    const snapshot = getCareOperationsSnapshotForUser(persistence, user, today)

    let applications: CareDashboardApplication[] = []
    let newApplications = 0
    let newApplicationsToday = 0
    if (crmModule) {
      const deals = listDealsForUser(persistence, user)
      if (deals.ok) {
        newApplications = deals.value.filter((deal) => deal.status === 'new').length
        newApplicationsToday = deals.value.filter(
          (deal) =>
            deal.status === 'new' &&
            dashboardDayKey(deal.createdAt, query.timeZone) ===
              dashboardDayKey(nowIso(), query.timeZone),
        ).length
        applications = [...deals.value]
          .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
          .slice(0, 6)
          .map((deal) => {
            const contact = deal.contactId
              ? persistence.contacts.getById(deal.contactId)
              : undefined
            return {
              id: deal.id,
              title: deal.title,
              status: deal.status,
              createdAt: deal.createdAt,
              phone: contact?.phone || undefined,
            }
          })
      }
    }

    const salePaymentsReadable = Boolean(
      salesModule && hasEffectiveFinancialPermission(user, 'payments.read'),
    )
    const carePaymentsReadable = Boolean(
      childrenModule && hasEffectiveCarePermission(user, 'children.read'),
    )
    let paidAmount = 0
    if (salePaymentsReadable) {
      for (const payment of persistence.payments.list(user.organizationId)) {
        if (
          payment.status !== 'completed' ||
          payment.rentalBookingId ||
          payment.careChargeId
        ) {
          continue
        }
        if (!analyticsStampInRange(payment.createdAt, range)) {
          continue
        }
        if (!canReadPayment(persistence, user, payment).ok) {
          continue
        }
        paidAmount += payment.amount
      }
    }
    if (carePaymentsReadable) {
      paidAmount += sumCompletedCarePaymentsForPeriod(
        persistence,
        user.organizationId,
        periodKey,
      )
    }
    paidAmount = roundMoney(paidAmount)
    const paymentsReadable = salePaymentsReadable || carePaymentsReadable

    const expensesReadable =
      expensesModule && hasEffectiveFinancialPermission(user, 'expenses.read')
    const expensesListed = expensesReadable
      ? listExpensesForUser(persistence, user)
      : undefined
    const periodExpenses = expensesListed?.ok
      ? roundMoney(
          expensesListed.value
            .filter((expense) => analyticsStampInRange(expenseStamp(expense), range))
            .reduce((sum, item) => sum + item.amount, 0),
        )
      : 0

    let topDebts: CareDashboardDebtRow[] = []
    if (canReadDebts) {
      const rows = listCustomerDebtsForUser(persistence, user)
      if (rows.ok) {
        topDebts = rows.value
          .filter((row) => row.remainingDebt > 0)
          .slice(0, 5)
          .map((row) => ({
            customerId: row.customerId,
            remaining: row.remainingDebt,
          }))
      }
    }

    const operations = snapshot.ok
      ? snapshot.value
      : {
          enrolled: 0,
          present: 0,
          absent: 0,
          unmarked: 0,
          freePlaces: 0,
          attendancePercent: 0,
          staffEnrolled: 0,
          staffPresent: 0,
          staffAbsent: 0,
          staffUnmarked: 0,
          staffAttendancePercent: 0,
          groups: [],
          childrenIncluded: false,
          attendanceIncluded: false,
        }

    view.quickActions.addChild = Boolean(
      childrenModule && hasEffectiveCarePermission(user, 'children.manage'),
    )
    view.quickActions.createGroup = Boolean(
      childrenModule && hasEffectiveCarePermission(user, 'children.manage'),
    )
    view.quickActions.markAttendance = Boolean(
      attendanceModule && hasEffectiveCarePermission(user, 'attendance.manage'),
    )
    view.quickActions.acceptPayment = Boolean(
      salesModule && hasEffectiveFinancialPermission(user, 'payments.create'),
    )
    view.care = {
      newApplications,
      newApplicationsToday,
      applicationsIncluded: crmModule,
      applications,
      groups: operations.groups,
      childrenIncluded: operations.childrenIncluded,
      attendanceIncluded: operations.attendanceIncluded,
      enrolled: operations.enrolled,
      present: operations.present,
      absent: operations.absent,
      unmarked: operations.unmarked,
      freePlaces: operations.freePlaces,
      attendancePercent: operations.attendancePercent,
      staffEnrolled: operations.staffEnrolled,
      staffPresent: operations.staffPresent,
      staffAbsent: operations.staffAbsent,
      staffUnmarked: operations.staffUnmarked,
      staffAttendancePercent: operations.staffAttendancePercent,
      paymentsIncluded: paymentsReadable,
      paidAmount,
      expensesIncluded: Boolean(expensesListed?.ok),
      expenses: periodExpenses,
      netResult: paymentsReadable ? roundMoney(paidAmount - periodExpenses) : 0,
      debtsIncluded: Boolean(view.debts),
      debtRemaining: view.debts?.remaining ?? 0,
      debtors: view.debts?.debtors ?? 0,
      overdueAmount: view.debts?.overdue ?? 0,
      topDebts,
    }
  }

  if (rentalModule) {
    const now = nowIso()
    const range = query.range ?? monthRange(periodKey)
    const live = getRentalAnalyticsForUser(persistence, user, user.organizationId, {
      at: now,
    })
    const period = getRentalAnalyticsForUser(persistence, user, user.organizationId, {
      at: now,
      range,
    })
    const listed = listRentalBookingsForUser(
      persistence,
      user,
      user.organizationId,
      now,
    )
    const reminders = listRentalRemindersForUser(
      persistence,
      user,
      user.organizationId,
      now,
      query.timeZone,
    )
    if (live.ok && period.ok && listed.ok && reminders.ok) {
      const today = dashboardDayKey(now, query.timeZone)
      const issueToday = reminders.value.filter((item) => item.kind === 'issue_today').length
      const returnToday = reminders.value.filter((item) => item.kind === 'return_today').length
      const newBookingsToday = listed.value.filter(
        (booking) =>
          booking.status !== 'cancelled' &&
          dashboardDayKey(booking.createdAt, query.timeZone) === today,
      ).length
      const expensesIncluded = hasEffectiveFinancialPermission(user, 'expenses.read')
      const expensesListed = expensesIncluded ? listExpensesForUser(persistence, user) : undefined
      const periodExpenses = expensesListed?.ok
        ? roundMoney(
            expensesListed.value
              .filter((expense) => analyticsStampInRange(expenseStamp(expense), range))
              .reduce((sum, expense) => sum + expense.amount, 0),
          )
        : 0
      const paidAmount = period.value.totals.paidAmount
      const paymentsIncluded = period.value.totals.paymentsIncluded
      const planTarget = view.companyPlans
        ? view.companyPlans.companyPlan
        : view.ownMotivation
          ? roundMoney(
              view.ownMotivation.lines.reduce((sum, line) => sum + line.planAmount, 0),
            )
          : 0
      const planPaid = paymentsIncluded ? paidAmount : 0
      const bookingIds = new Set(listed.value.map((booking) => booking.id))
      const paidBuckets = new Map<string, number>()
      if (paymentsIncluded) {
        for (const payment of persistence.payments.list(user.organizationId)) {
          if (
            payment.status !== 'completed' ||
            !payment.rentalBookingId ||
            !bookingIds.has(payment.rentalBookingId) ||
            !analyticsStampInRange(payment.createdAt, range)
          ) {
            continue
          }
          const bucket = payment.createdAt.slice(0, 10)
          paidBuckets.set(bucket, (paidBuckets.get(bucket) ?? 0) + payment.amount)
        }
        for (const booking of listed.value) {
          if (
            booking.status === 'draft' ||
            booking.prepayment <= 0 ||
            !analyticsStampInRange(booking.createdAt, range)
          ) {
            continue
          }
          const bucket = booking.createdAt.slice(0, 10)
          paidBuckets.set(bucket, (paidBuckets.get(bucket) ?? 0) + booking.prepayment)
        }
      }
      const expenseBuckets = new Map<string, number>()
      if (expensesListed?.ok) {
        for (const expense of expensesListed.value) {
          const stamp = expenseStamp(expense)
          if (!analyticsStampInRange(stamp, range)) {
            continue
          }
          const bucket = stamp.slice(0, 10)
          expenseBuckets.set(bucket, (expenseBuckets.get(bucket) ?? 0) + expense.amount)
        }
      }
      view.rental = {
        bookings: period.value.totals.bookings,
        active: live.value.totals.active,
        overdue: live.value.totals.overdue,
        dueAmount: live.value.totals.dueAmount,
        issuedToday: issueToday,
        returnsToday: returnToday,
        newBookingsToday,
        rentalTotal: period.value.totals.rentalTotal,
        paidAmount,
        prepayment: period.value.totals.prepayment,
        expenses: periodExpenses,
        netResult: paymentsIncluded ? roundMoney(paidAmount - periodExpenses) : 0,
        paymentsIncluded,
        expensesIncluded: Boolean(expensesListed?.ok),
        planTarget,
        planPaid,
        planCompletion: planTarget > 0 ? (planPaid / planTarget) * 100 : 0,
        planRemaining: roundMoney(Math.max(0, planTarget - planPaid)),
        upcomingIssues: listed.value
          .filter((booking) => booking.status === 'reserved')
          .sort((left, right) => left.startAt.localeCompare(right.startAt))
          .slice(0, 8)
          .map(toRentalDashboardRow),
        dueReturns: listed.value
          .filter((booking) => booking.status === 'issued')
          .sort((left, right) => left.endAt.localeCompare(right.endAt))
          .slice(0, 8)
          .map(toRentalDashboardRow),
        popularProducts: [...period.value.byProduct]
          .sort((left, right) => right.quantity - left.quantity || right.total - left.total)
          .slice(0, 6)
          .map((row) => ({
            productId: row.key,
            count: row.count,
            quantity: row.quantity,
            total: row.total,
          })),
        cashflow: utcDayKeys(range).map((bucket) => ({
          bucket,
          paid: roundMoney(paidBuckets.get(bucket) ?? 0),
          expenses: roundMoney(expenseBuckets.get(bucket) ?? 0),
        })),
      }
    }
  }

  return ok(view)
}
