import { useMemo, useState, type FormEvent } from 'react'
import { useAccess } from '../../context/access-context'
import { usePersistence, usePersistenceVersion } from '../../context/persistence-context'
import { useAnalytics } from '../../context/analytics-context'
import { useBranches } from '../../context/branch-context'
import { useExpenses } from '../../context/expense-context'
import { useLocalization } from '../../context/localization-context'
import { useOrganization } from '../../context/organization-context'
import { useUsers } from '../../context/user-context'
import { useWarehouses } from '../../context/warehouse-context'
import {
  EXPENSE_CATEGORIES,
  type ExpenseCategory,
  type PaymentMethod,
} from '../../../core/types'
import {
  canReadRental,
  getCareOperationsSnapshotForUser,
  resolveAnalyticsOverviewBlocks,
  todayExpenseDateInput,
  type AnalyticsKpiDelta,
  type AnalyticsKpis,
  type AnalyticsPeriod,
  type AnalyticsSeriesPoint,
  type ProductAnalyticsRow,
  type RentalAnalyticsTotals,
  type RevenuePoint,
} from '../../../core/services'
import { RentalAnalyticsPanel } from '../../../modules/rental/RentalAnalyticsPanel'
import { Button, EmptyState } from '../../../shared/ui'
import { WorkbookExportButton } from '../../../shared/components/WorkbookExportButton'
import { formatMoney } from '../../../modules/sales/pos-format'
import type { TranslationKey } from '../../../core/localization/translations'
import { buildAnalyticsExcelSheets } from '../../../core/services'

const EXPENSE_LABEL: Record<ExpenseCategory, TranslationKey> = {
  rent: 'expenseCategory_rent',
  salary: 'expenseCategory_salary',
  marketing: 'expenseCategory_marketing',
  delivery: 'expenseCategory_delivery',
  procurement: 'expenseCategory_procurement',
  utilities: 'expenseCategory_utilities',
  tax: 'expenseCategory_tax',
  bank_commission: 'expenseCategory_bank_commission',
  other: 'expenseCategory_other',
}

const PAYMENT_LABEL: Record<PaymentMethod, TranslationKey> = {
  cash: 'paymentCash',
  card: 'paymentCard',
  bank_transfer: 'paymentBankTransfer',
  invoice: 'paymentInvoice',
  on_credit: 'paymentOnCredit',
  other: 'paymentOther',
}

const PERIODS: { id: AnalyticsPeriod; label: TranslationKey }[] = [
  { id: 'today', label: 'analyticsPeriodToday' },
  { id: 'week', label: 'periodWeek' },
  { id: 'month', label: 'analyticsPeriodThisMonth' },
  { id: 'quarter', label: 'analyticsPeriodThisQuarter' },
  { id: 'year', label: 'analyticsPeriodThisYear' },
  { id: 'custom', label: 'periodCustom' },
]

type AnalyticsTab =
  | 'overview'
  | 'products'
  | 'services'
  | 'employees'
  | 'payments'
  | 'expenses'
  | 'rental'
type ProductSort = 'revenue' | 'quantity' | 'profit' | 'margin'

function formatNumber(value: number, locale: 'ru' | 'kk'): string {
  return value.toLocaleString(locale === 'kk' ? 'kk-KZ' : 'ru-RU')
}

function formatDelta(
  value: number | undefined,
  locale: 'ru' | 'kk',
  noData: string,
  hasPrevious: boolean,
): string | null {
  if (!hasPrevious) {
    return null
  }

  if (value === undefined || !Number.isFinite(value)) {
    return noData
  }

  const sign = value > 0 ? '+' : ''
  return `${sign}${formatNumber(value, locale)}%`
}

function sortProducts(
  rows: ProductAnalyticsRow[],
  sort: ProductSort,
): ProductAnalyticsRow[] {
  return [...rows].sort((left, right) => {
    if (sort === 'quantity') {
      return right.quantity - left.quantity
    }

    if (sort === 'profit') {
      return right.grossProfit - left.grossProfit
    }

    if (sort === 'margin') {
      return right.marginPercent - left.marginPercent
    }

    return right.revenue - left.revenue
  })
}

function toChartPoints(
  points: RevenuePoint[] | AnalyticsSeriesPoint[],
): AnalyticsSeriesPoint[] {
  return points.map((point) =>
    'value' in point
      ? point
      : { bucket: point.bucket, value: point.revenue },
  )
}

function AnalyticsChart({
  points,
  emptyLabel,
}: {
  points: AnalyticsSeriesPoint[]
  emptyLabel: string
}) {
  if (points.length === 0) {
    return <EmptyState title={emptyLabel} />
  }

  if (points.length === 1) {
    const point = points[0]
    return (
      <div className="analytics-chart-point">
        <span className="analytics-chart-point__date">{point.bucket}</span>
        <strong>{point.value.toLocaleString()}</strong>
      </div>
    )
  }

  const max = Math.max(...points.map((point) => point.value), 0)
  const width = Math.max(360, points.length * 48)
  const height = 180
  const pad = 28
  const innerWidth = width - pad * 2
  const innerHeight = height - pad * 2
  const step = points.length > 1 ? innerWidth / (points.length - 1) : 0

  return (
    <div className="analytics-chart-wrap">
      <svg
        className="analytics-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
      >
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          points={points
            .map((point, index) => {
              const x =
                pad + (points.length === 1 ? innerWidth / 2 : index * step)
              const y =
                pad +
                innerHeight -
                (max <= 0 ? 0 : (point.value / max) * innerHeight)
              return `${x},${y}`
            })
            .join(' ')}
        />
        {points.map((point, index) => {
          const x = pad + (points.length === 1 ? innerWidth / 2 : index * step)
          const y =
            pad +
            innerHeight -
            (max <= 0 ? 0 : (point.value / max) * innerHeight)
          return <circle key={point.bucket} cx={x} cy={y} r="3" fill="currentColor" />
        })}
      </svg>
      <div className="analytics-chart-labels">
        {points.map((point) => (
          <span key={point.bucket}>{point.bucket}</span>
        ))}
      </div>
    </div>
  )
}

function KpiCard({
  label,
  value,
  delta,
}: {
  label: string
  value: string
  delta?: string | null
}) {
  return (
    <article className="kpi-card">
      <p className="kpi-card__label">{label}</p>
      <p className="kpi-card__value">{value}</p>
      {delta ? <p className="kpi-card__delta">{delta}</p> : null}
    </article>
  )
}

function KpiGrid({
  kpis,
  deltas,
  hasPrevious,
  locale,
  currency,
  t,
}: {
  kpis: AnalyticsKpis
  deltas: AnalyticsKpiDelta
  hasPrevious: boolean
  locale: 'ru' | 'kk'
  currency: string
  t: (key: TranslationKey) => string
}) {
  const noData = t('analyticsNoComparison')
  return (
    <div className="kpi-grid analytics-kpi-grid analytics-kpi-grid--anchor">
      <KpiCard
        label={t('kpiRevenue')}
        value={formatMoney(kpis.revenue, locale, currency)}
        delta={formatDelta(deltas.revenue, locale, noData, hasPrevious)}
      />
      <KpiCard
        label={t('kpiCogs')}
        value={formatMoney(kpis.cogs, locale, currency)}
        delta={formatDelta(deltas.cogs, locale, noData, hasPrevious)}
      />
      <KpiCard
        label={t('kpiGrossProfit')}
        value={formatMoney(kpis.grossProfit, locale, currency)}
        delta={formatDelta(deltas.grossProfit, locale, noData, hasPrevious)}
      />
      <KpiCard
        label={t('kpiMargin')}
        value={`${formatNumber(kpis.marginPercent, locale)}%`}
        delta={formatDelta(deltas.marginPercent, locale, noData, hasPrevious)}
      />
      <KpiCard
        label={t('kpiExpenses')}
        value={formatMoney(kpis.expenses, locale, currency)}
        delta={formatDelta(deltas.expenses, locale, noData, hasPrevious)}
      />
      <KpiCard
        label={t('kpiNetProfit')}
        value={formatMoney(kpis.netProfit, locale, currency)}
        delta={formatDelta(deltas.netProfit, locale, noData, hasPrevious)}
      />
      <KpiCard
        label={t('kpiAverageCheck')}
        value={formatMoney(kpis.averageCheck, locale, currency)}
        delta={formatDelta(deltas.averageCheck, locale, noData, hasPrevious)}
      />
      <KpiCard
        label={t('kpiSalesCount')}
        value={formatNumber(kpis.salesCount, locale)}
        delta={formatDelta(deltas.salesCount, locale, noData, hasPrevious)}
      />
    </div>
  )
}

function RentalKpiGrid({
  totals,
  locale,
  currency,
  paidLabel,
  expensesAmount,
  t,
}: {
  totals: RentalAnalyticsTotals
  locale: 'ru' | 'kk'
  currency: string
  paidLabel: string
  expensesAmount?: number
  t: (key: TranslationKey) => string
}) {
  return (
    <div className="kpi-grid analytics-kpi-grid">
      <KpiCard
        label={t('rentalKpiBookings')}
        value={formatNumber(totals.bookings, locale)}
      />
      <KpiCard
        label={t('rentalIssued')}
        value={formatNumber(totals.issued, locale)}
      />
      <KpiCard
        label={t('rentalInUse')}
        value={formatNumber(totals.active, locale)}
      />
      <KpiCard
        label={t('rentalOverdue')}
        value={formatNumber(totals.overdue, locale)}
      />
      <KpiCard
        label={t('rentalTotal')}
        value={formatMoney(totals.rentalTotal, locale, currency)}
      />
      {totals.paymentsIncluded ? (
        <KpiCard
          label={paidLabel}
          value={formatMoney(totals.paidAmount, locale, currency)}
        />
      ) : null}
      <KpiCard
        label={t('rentalDue')}
        value={formatMoney(totals.dueAmount, locale, currency)}
      />
      <KpiCard
        label={t('rentalRentedQty')}
        value={`${formatNumber(totals.rentedQuantity, locale)} ${t('rentalPcs')}`}
      />
      <KpiCard
        label={t('rentalPrepayment')}
        value={formatMoney(totals.prepayment, locale, currency)}
      />
      {expensesAmount !== undefined ? (
        <KpiCard
          label={t('kpiExpenses')}
          value={formatMoney(expensesAmount, locale, currency)}
        />
      ) : null}
    </div>
  )
}

export function AnalyticsPage({ embedded = false }: { embedded?: boolean }) {
  const { t, locale } = useLocalization()
  const { currentUser, hasFinancialAccess, hasCareAccess } = useAccess()
  const persistence = usePersistence()
  const persistenceVersion = usePersistenceVersion()
  const { settings, modules } = useOrganization()
  const { branches, getBranch } = useBranches()
  const { warehouses, analyticsWarehouses } = useWarehouses()
  const { users, getUser } = useUsers()
  const { createExpense } = useExpenses()
  const analyticsState = useAnalytics()
  const [tab, setTab] = useState<AnalyticsTab>('overview')
  const [productSort, setProductSort] = useState<ProductSort>('revenue')
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [category, setCategory] = useState<ExpenseCategory>('rent')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayExpenseDateInput)
  const [comment, setComment] = useState('')
  const [expenseBranchId, setExpenseBranchId] = useState('')

  const canSalesPermission = hasFinancialAccess('financial_analytics.read')
  const overview = resolveAnalyticsOverviewBlocks(modules, {
    canSalesAnalytics: canSalesPermission,
    canExpenseAnalytics: hasFinancialAccess('expenses.read'),
    canRentalAnalytics: Boolean(currentUser && canReadRental(currentUser)),
    canCareAnalytics: modules.children === true && hasCareAccess('children.read'),
  })
  const canSales = overview.sales
  const canExpenses = overview.expenses
  const canRental = overview.rental
  const canCare = overview.care
  const canCreateExpense =
    modules.expenses === true && hasFinancialAccess('expenses.create')
  const currency = settings.currency
  const warehouseOptions =
    analyticsWarehouses.length > 0 ? analyticsWarehouses : warehouses
  const canEmployeeAnalytics =
    currentUser?.role === 'sales_manager' ||
    currentUser?.role === 'branch_director' ||
    currentUser?.role === 'commercial_director' ||
    currentUser?.role === 'owner'

  const sortedProducts = useMemo(
    () => sortProducts(analyticsState.analytics?.products ?? [], productSort),
    [analyticsState.analytics?.products, productSort],
  )
  const sortedServices = useMemo(
    () => sortProducts(analyticsState.analytics?.services ?? [], productSort),
    [analyticsState.analytics?.services, productSort],
  )
  const careSnapshot = useMemo(() => {
    void persistenceVersion
    if (!overview.care) {
      return { ok: false as const, error: { code: 'MODULE_NOT_ENABLED' as const } }
    }
    return getCareOperationsSnapshotForUser(
      persistence,
      currentUser,
      todayExpenseDateInput(),
    )
  }, [currentUser, overview.care, persistence, persistenceVersion])

  if (!currentUser || analyticsState.errorCode === 'CURRENT_USER_REQUIRED') {
    return (
      <section className="workspace-page">
        <EmptyState title={t('CURRENT_USER_REQUIRED')} />
      </section>
    )
  }

  if (!canSales && !canExpenses && !canRental && !canCare) {
    return (
      <section className="workspace-page">
        <EmptyState title={t('ACCESS_DENIED')} />
      </section>
    )
  }

  if (analyticsState.errorCode) {
    return (
      <section className="workspace-page">
        <EmptyState
          title={
            analyticsState.errorCode === 'ACCESS_DENIED'
              ? t('ACCESS_DENIED')
              : analyticsState.errorCode
          }
        />
      </section>
    )
  }

  if (analyticsState.loading) {
    return (
      <section className="workspace-page">
        <EmptyState title={t('analyticsLoading')} />
      </section>
    )
  }

  const analytics = analyticsState.analytics
  const kpis = analytics?.kpis
  const hasPrevious = Boolean(analytics?.previousKpis)
  const tabs: { id: AnalyticsTab; label: string; visible: boolean }[] = [
    { id: 'overview', label: t('navAnalyticsOverview'), visible: true },
    { id: 'products', label: t('navAnalyticsProducts'), visible: canSales },
    { id: 'services', label: t('navAnalyticsServices'), visible: canSales },
    {
      id: 'employees',
      label: t('navAnalyticsEmployees'),
      visible: canSales && canEmployeeAnalytics,
    },
    { id: 'payments', label: t('navAnalyticsPayments'), visible: canSales },
    { id: 'expenses', label: t('navAnalyticsExpenses'), visible: canExpenses },
    {
      id: 'rental',
      label: t('platformModuleRental'),
      visible: canRental,
    },
  ]

  const handleExpense = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const parsed = Number(amount)
    const name = description.trim() || comment.trim()
    if (!name || !date || !Number.isFinite(parsed) || parsed <= 0) {
      return
    }

    const created = createExpense({
      category,
      description: name,
      amount: parsed,
      date,
      comment: comment.trim() || undefined,
      branchId: expenseBranchId || undefined,
    })
    if (created.ok) {
      setDescription('')
      setAmount('')
      setComment('')
      setDate(todayExpenseDateInput())
      setShowExpenseForm(false)
    }
  }

  return (
    <section className={embedded ? 'analytics-page' : 'workspace-page analytics-page'}>
      <div className="workspace-toolbar">
        {embedded ? null : (
        <h2 className="workspace-toolbar__title">{t('navAnalyticsSection')}</h2>
        )}
        <select
          className="warehouse-input"
          value={analyticsState.period}
          onChange={(event) =>
            analyticsState.setPeriod(event.target.value as AnalyticsPeriod)
          }
        >
          {PERIODS.map((item) => (
            <option key={item.id} value={item.id}>
              {t(item.label)}
            </option>
          ))}
        </select>
        {analyticsState.period === 'custom' ? (
          <>
            <input
              className="warehouse-input"
              type="date"
              value={analyticsState.customFrom}
              onChange={(event) => analyticsState.setCustomFrom(event.target.value)}
            />
            <input
              className="warehouse-input"
              type="date"
              value={analyticsState.customTo}
              onChange={(event) => analyticsState.setCustomTo(event.target.value)}
            />
          </>
        ) : null}
        <WorkbookExportButton
          filename={`finance-analytics-${analyticsState.period}.xlsx`}
          sheets={buildAnalyticsExcelSheets({
            period: analyticsState.period,
            tab,
            analytics: analyticsState.analytics,
          })}
        />
      </div>

      <div className="analytics-filters filter-bar">
        <label className="warehouse-field">
          <span className="settings-field__label">{t('navBranches')}</span>
          <select
            className="warehouse-input"
            value={analyticsState.query.branchId ?? ''}
            onChange={(event) => analyticsState.setBranchId(event.target.value)}
          >
            <option value="">{t('analyticsAllBranches')}</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </label>
        {modules.warehouses === true ? (
        <label className="warehouse-field">
          <span className="settings-field__label">{t('navWarehouses')}</span>
          <select
            className="warehouse-input"
            value={analyticsState.query.warehouseId ?? ''}
            onChange={(event) => analyticsState.setWarehouseId(event.target.value)}
          >
            <option value="">{t('analyticsAllWarehouses')}</option>
            {warehouseOptions.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.name}
              </option>
            ))}
          </select>
        </label>
        ) : null}
        {canSales && canEmployeeAnalytics ? (
          <label className="warehouse-field">
            <span className="settings-field__label">{t('navUsers')}</span>
            <select
              className="warehouse-input"
              value={analyticsState.query.userId ?? ''}
              onChange={(event) => analyticsState.setUserId(event.target.value)}
            >
              <option value="">{t('analyticsAllEmployees')}</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.firstName} {user.lastName}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {canSales ? (
          <label className="warehouse-field">
            <span className="settings-field__label">{t('analyticsItemType')}</span>
            <select
              className="warehouse-input"
              value={analyticsState.query.itemType ?? 'all'}
              onChange={(event) =>
                analyticsState.setItemType(
                  event.target.value as 'all' | 'product' | 'service',
                )
              }
            >
              <option value="all">{t('analyticsTypeAll')}</option>
              <option value="product">{t('navAnalyticsProducts')}</option>
              <option value="service">{t('navAnalyticsServices')}</option>
            </select>
          </label>
        ) : null}
        {canExpenses ? (
          <label className="warehouse-field">
            <span className="settings-field__label">{t('expenseCategory')}</span>
            <select
              className="warehouse-input"
              value={analyticsState.query.expenseCategory ?? 'all'}
              onChange={(event) =>
                analyticsState.setExpenseCategory(
                  event.target.value as ExpenseCategory | 'all',
                )
              }
            >
              <option value="all">{t('analyticsTypeAll')}</option>
              {EXPENSE_CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {t(EXPENSE_LABEL[item])}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <div className="nomenclature-filters" role="tablist">
        {tabs
          .filter((item) => item.visible)
          .map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              className={
                tab === item.id
                  ? 'nomenclature-filter nomenclature-filter--active'
                  : 'nomenclature-filter'
              }
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
      </div>

      {tab === 'overview' ? (
        <div className="settings-section analytics-overview">
          {canCare && careSnapshot.ok ? (
            <>
              <h3>{t('analyticsCare')}</h3>
              {careSnapshot.value.childrenIncluded || careSnapshot.value.attendanceIncluded ? (
                <>
                  <h4>{t('analyticsCareChildren')}</h4>
                  <div className="care-dashboard__finance-row">
                    {careSnapshot.value.childrenIncluded ? (
                      <div>
                        <p className="care-dashboard__label">{t('navChildren')}</p>
                        <p className="care-dashboard__value care-dashboard__value--sm">
                          {careSnapshot.value.enrolled}
                        </p>
                      </div>
                    ) : null}
                    {careSnapshot.value.attendanceIncluded ? (
                      <>
                        <div>
                          <p className="care-dashboard__label">{t('carePresent')}</p>
                          <p className="care-dashboard__value care-dashboard__value--sm">
                            {careSnapshot.value.present}
                          </p>
                        </div>
                        <div>
                          <p className="care-dashboard__label">{t('careAbsent')}</p>
                          <p className="care-dashboard__value care-dashboard__value--sm">
                            {careSnapshot.value.absent}
                          </p>
                        </div>
                        <div>
                          <p className="care-dashboard__label">{t('careUnmarked')}</p>
                          <p className="care-dashboard__value care-dashboard__value--sm">
                            {careSnapshot.value.unmarked}
                          </p>
                        </div>
                        <div>
                          <p className="care-dashboard__label">{t('careAttendanceRate')}</p>
                          <p className="care-dashboard__value care-dashboard__value--sm">
                            {careSnapshot.value.attendancePercent}%
                          </p>
                        </div>
                      </>
                    ) : null}
                  </div>
                </>
              ) : null}
              {careSnapshot.value.attendanceIncluded ? (
                <>
                  <h4>{t('analyticsCareStaff')}</h4>
                  <div className="care-dashboard__finance-row">
                    <div>
                      <p className="care-dashboard__label">{t('careStaffAttendance')}</p>
                      <p className="care-dashboard__value care-dashboard__value--sm">
                        {careSnapshot.value.staffEnrolled}
                      </p>
                    </div>
                    <div>
                      <p className="care-dashboard__label">{t('carePresent')}</p>
                      <p className="care-dashboard__value care-dashboard__value--sm">
                        {careSnapshot.value.staffPresent}
                      </p>
                    </div>
                    <div>
                      <p className="care-dashboard__label">{t('careAbsent')}</p>
                      <p className="care-dashboard__value care-dashboard__value--sm">
                        {careSnapshot.value.staffAbsent}
                      </p>
                    </div>
                    <div>
                      <p className="care-dashboard__label">{t('careUnmarked')}</p>
                      <p className="care-dashboard__value care-dashboard__value--sm">
                        {careSnapshot.value.staffUnmarked}
                      </p>
                    </div>
                    <div>
                      <p className="care-dashboard__label">{t('careAttendanceRate')}</p>
                      <p className="care-dashboard__value care-dashboard__value--sm">
                        {careSnapshot.value.staffAttendancePercent}%
                      </p>
                    </div>
                  </div>
                </>
              ) : null}
              {careSnapshot.value.groups.length > 0 ? (
                <ul className="care-dashboard__group-list">
                  {careSnapshot.value.groups.map((group) => (
                    <li key={group.id}>
                      {group.name}: {group.childCount} / {group.capacity}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="care-dashboard__empty">{t('careNoData')}</p>
              )}
            </>
          ) : null}
          {canSales && kpis ? (
            <>
              {canRental ? <h3>{t('navSalesSection')}</h3> : null}
              <KpiGrid
                kpis={kpis}
                deltas={analytics?.deltas ?? {}}
                hasPrevious={hasPrevious}
                locale={locale}
                currency={currency}
                t={t}
              />
              <p>
                {t('kpiProductUnits')}: {formatNumber(kpis.productUnits, locale)}
                {' · '}
                {t('kpiServiceUnits')}: {formatNumber(kpis.serviceUnits, locale)}
                {' · '}
                {t('kpiDiscounts')}: {formatMoney(kpis.discounts, locale, currency)}
              </p>
              <h3>{t('analyticsRevenueChart')}</h3>
              {analytics?.hasSales ? (
                <AnalyticsChart
                  points={toChartPoints(analytics.revenueSeries)}
                  emptyLabel={t('analyticsNoSales')}
                />
              ) : (
                <EmptyState title={t('analyticsNoSales')} />
              )}
              <h3>{t('analyticsProfitChart')}</h3>
              {analytics?.hasSales ? (
                <AnalyticsChart
                  points={analytics.profitSeries}
                  emptyLabel={t('analyticsNoSales')}
                />
              ) : (
                <EmptyState title={t('analyticsNoSales')} />
              )}
              <div className="analytics-statement">
                <p>
                  {t('kpiRevenue')} {formatMoney(kpis.revenue, locale, currency)}
                </p>
                <p>
                  − {t('kpiCogs')} {formatMoney(kpis.cogs, locale, currency)}
                </p>
                <p>
                  = {t('kpiGrossProfit')}{' '}
                  {formatMoney(kpis.grossProfit, locale, currency)}
                </p>
                <p>
                  − {t('kpiExpenses')} {formatMoney(kpis.expenses, locale, currency)}
                </p>
                <p>
                  = {t('kpiNetProfit')} {formatMoney(kpis.netProfit, locale, currency)}
                </p>
              </div>
            </>
          ) : null}
          {canRental && analyticsState.rentalAnalytics ? (
            <>
              {canSales ? <h3>{t('platformModuleRental')}</h3> : null}
              <RentalKpiGrid
                totals={analyticsState.rentalAnalytics.totals}
                locale={locale}
                currency={currency}
                paidLabel={
                  canSales ? t('analyticsRentalPaid') : t('rentalPaid')
                }
                expensesAmount={
                  canExpenses && !canSales && kpis ? kpis.expenses : undefined
                }
                t={t}
              />
            </>
          ) : null}
          {canExpenses ? (
            <>
              <h3>{t('analyticsExpenseChart')}</h3>
              {analytics?.hasExpenses ? (
                <AnalyticsChart
                  points={analytics.expenseSeries}
                  emptyLabel={t('analyticsNoExpenses')}
                />
              ) : (
                <EmptyState title={t('analyticsNoExpenses')} />
              )}
            </>
          ) : null}
        </div>
      ) : null}

      {tab === 'rental' && canRental ? <RentalAnalyticsPanel /> : null}

      {tab === 'products' && canSales ? (
        analytics?.hasSales && sortedProducts.length > 0 ? (
          <div className="settings-section">
            <div className="workspace-toolbar">
              <h3>{t('navAnalyticsProducts')}</h3>
              <select
                className="warehouse-input"
                value={productSort}
                onChange={(event) =>
                  setProductSort(event.target.value as ProductSort)
                }
              >
                <option value="revenue">{t('kpiRevenue')}</option>
                <option value="quantity">{t('analyticsSold')}</option>
                <option value="profit">{t('kpiGrossProfit')}</option>
                <option value="margin">{t('kpiMargin')}</option>
              </select>
            </div>
            <div className="inventory-table-wrap">
              <table className="inventory-table">
                <thead>
                  <tr>
                    <th>{t('navProducts')}</th>
                    <th>{t('sku')}</th>
                    <th>{t('analyticsSold')}</th>
                    <th>{t('kpiRevenue')}</th>
                    <th>{t('kpiCogs')}</th>
                    <th>{t('kpiGrossProfit')}</th>
                    <th>{t('kpiMargin')}</th>
                    <th>{t('kpiDiscounts')}</th>
                    <th>{t('analyticsReturns')}</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedProducts.map((row) => (
                    <tr key={row.productId}>
                      <td>{row.name}</td>
                      <td>{row.sku}</td>
                      <td>{formatNumber(row.quantity, locale)}</td>
                      <td>{formatMoney(row.revenue, locale, currency)}</td>
                      <td>{formatMoney(row.cogs, locale, currency)}</td>
                      <td>{formatMoney(row.grossProfit, locale, currency)}</td>
                      <td>{formatNumber(row.marginPercent, locale)}%</td>
                      <td>{formatMoney(row.discounts, locale, currency)}</td>
                      <td>{formatNumber(row.returnedQuantity, locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <EmptyState title={t('analyticsNoSales')} />
        )
      ) : null}

      {tab === 'services' && canSales ? (
        sortedServices.length > 0 ? (
          <div className="settings-section">
            <div className="workspace-toolbar">
              <h3>{t('navAnalyticsServices')}</h3>
              <select
                className="warehouse-input"
                value={productSort}
                onChange={(event) =>
                  setProductSort(event.target.value as ProductSort)
                }
              >
                <option value="revenue">{t('kpiRevenue')}</option>
                <option value="quantity">{t('analyticsSold')}</option>
                <option value="profit">{t('kpiGrossProfit')}</option>
                <option value="margin">{t('kpiMargin')}</option>
              </select>
            </div>
            <div className="inventory-table-wrap">
              <table className="inventory-table">
                <thead>
                  <tr>
                    <th>{t('nomenclatureServices')}</th>
                    <th>{t('sku')}</th>
                    <th>{t('inventoryQuantity')}</th>
                    <th>{t('kpiRevenue')}</th>
                    <th>{t('kpiCogs')}</th>
                    <th>{t('kpiGrossProfit')}</th>
                    <th>{t('kpiMargin')}</th>
                    <th>{t('kpiDiscounts')}</th>
                    <th>{t('analyticsReturns')}</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedServices.map((row) => (
                    <tr key={row.productId}>
                      <td>{row.name}</td>
                      <td>{row.sku}</td>
                      <td>{formatNumber(row.quantity, locale)}</td>
                      <td>{formatMoney(row.revenue, locale, currency)}</td>
                      <td>{formatMoney(row.cogs, locale, currency)}</td>
                      <td>{formatMoney(row.grossProfit, locale, currency)}</td>
                      <td>{formatNumber(row.marginPercent, locale)}%</td>
                      <td>{formatMoney(row.discounts, locale, currency)}</td>
                      <td>{formatNumber(row.returnedQuantity, locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <EmptyState title={t('analyticsNoSales')} />
        )
      ) : null}

      {tab === 'employees' && canSales && canEmployeeAnalytics ? (
        analytics?.hasSales ? (
          <div className="inventory-table-wrap">
            <table className="inventory-table">
              <thead>
                <tr>
                  <th>{t('analyticsEmployee')}</th>
                  <th>{t('kpiSalesCount')}</th>
                  <th>{t('kpiRevenue')}</th>
                  <th>{t('kpiDiscounts')}</th>
                  <th>{t('analyticsReturns')}</th>
                  <th>{t('kpiGrossProfit')}</th>
                </tr>
              </thead>
              <tbody>
                {(analytics?.employees ?? []).map((row) => {
                  const user = getUser(row.userId)
                  return (
                    <tr key={row.userId}>
                      <td>
                        {user ? `${user.firstName} ${user.lastName}` : row.userId}
                      </td>
                      <td>{formatNumber(row.salesCount, locale)}</td>
                      <td>{formatMoney(row.revenue, locale, currency)}</td>
                      <td>{formatMoney(row.discounts, locale, currency)}</td>
                      <td>{formatNumber(row.returnedQuantity, locale)}</td>
                      <td>{formatMoney(row.grossProfit, locale, currency)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title={t('analyticsNoSales')} />
        )
      ) : null}

      {tab === 'payments' && canSales ? (
        analytics?.hasSales ? (
          <div className="inventory-table-wrap">
            <table className="inventory-table">
              <thead>
                <tr>
                  <th>{t('analyticsPaymentMethod')}</th>
                  <th>{t('analyticsPaymentCount')}</th>
                  <th>{t('expenseAmount')}</th>
                </tr>
              </thead>
              <tbody>
                {(analytics?.payments ?? []).map((row) => (
                  <tr key={row.method}>
                    <td>{t(PAYMENT_LABEL[row.method])}</td>
                    <td>{formatNumber(row.count, locale)}</td>
                    <td>{formatMoney(row.amount, locale, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title={t('analyticsNoSales')} />
        )
      ) : null}

      {tab === 'expenses' && canExpenses ? (
        <>
          {canCreateExpense ? (
            <div className="workspace-toolbar">
              <Button
                type="button"
                variant="primary"
                onClick={() => setShowExpenseForm((open) => !open)}
              >
                {t('addExpense')}
              </Button>
            </div>
          ) : null}
          {showExpenseForm && canCreateExpense ? (
            <form className="warehouse-form settings-section" onSubmit={handleExpense}>
              <h2>{t('newExpense')}</h2>
              <label className="warehouse-field">
                <span className="settings-field__label">{t('expenseDate')}</span>
                <input
                  className="warehouse-input"
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                />
              </label>
              <label className="warehouse-field">
                <span className="settings-field__label">{t('expenseName')}</span>
                <input
                  className="warehouse-input"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </label>
              <label className="warehouse-field">
                <span className="settings-field__label">{t('expenseCategory')}</span>
                <select
                  className="warehouse-input"
                  value={category}
                  onChange={(event) =>
                    setCategory(event.target.value as ExpenseCategory)
                  }
                >
                  {EXPENSE_CATEGORIES.map((item) => (
                    <option key={item} value={item}>
                      {t(EXPENSE_LABEL[item])}
                    </option>
                  ))}
                </select>
              </label>
              <label className="warehouse-field">
                <span className="settings-field__label">{t('expenseAmount')}</span>
                <input
                  className="warehouse-input"
                  type="number"
                  min="0"
                  step="any"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
              </label>
              <label className="warehouse-field">
                <span className="settings-field__label">{t('expenseComment')}</span>
                <input
                  className="warehouse-input"
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                />
              </label>
              {branches.length > 0 ? (
                <label className="warehouse-field">
                  <span className="settings-field__label">{t('navBranches')}</span>
                  <select
                    className="warehouse-input"
                    value={expenseBranchId}
                    onChange={(event) => setExpenseBranchId(event.target.value)}
                  >
                    <option value="">{t('analyticsAllBranches')}</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <Button type="submit" variant="primary">
                {t('create')}
              </Button>
            </form>
          ) : null}
          {analytics?.hasExpenses ? (
            <>
              <h3>{t('analyticsExpensesPeriod')}</h3>
              <div className="inventory-table-wrap">
                <table className="inventory-table">
                  <thead>
                    <tr>
                      <th>{t('expenseDate')}</th>
                      <th>{t('expenseCategory')}</th>
                      <th>{t('expenseName')}</th>
                      <th>{t('expenseAmount')}</th>
                      <th>{t('expenseComment')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(analytics.expenseItems ?? []).map((expense) => (
                      <tr key={expense.id}>
                        <td>{expense.date}</td>
                        <td>{t(EXPENSE_LABEL[expense.category])}</td>
                        <td>{expense.description}</td>
                        <td>{formatMoney(expense.amount, locale, currency)}</td>
                        <td>{expense.comment ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p>
                {t('analyticsExpensesTotal')}:{' '}
                {kpis ? formatMoney(kpis.expenses, locale, currency) : ''}
              </p>
              <h3>{t('analyticsExpensesByCategory')}</h3>
              <div className="inventory-table-wrap">
                <table className="inventory-table">
                  <thead>
                    <tr>
                      <th>{t('expenseCategory')}</th>
                      <th>{t('expenseAmount')}</th>
                      <th>%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(analytics.expenses ?? []).map((row) => (
                      <tr key={row.category}>
                        <td>{t(EXPENSE_LABEL[row.category])}</td>
                        <td>{formatMoney(row.amount, locale, currency)}</td>
                        <td>{formatNumber(row.sharePercent, locale)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <h3>{t('analyticsExpensesByBranch')}</h3>
              <div className="inventory-table-wrap">
                <table className="inventory-table">
                  <thead>
                    <tr>
                      <th>{t('navBranches')}</th>
                      <th>{t('expenseAmount')}</th>
                      <th>%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(analytics.expenseBranches ?? []).map((row) => (
                      <tr key={row.branchId || 'none'}>
                        <td>
                          {row.branchId
                            ? (getBranch(row.branchId)?.name ?? row.branchId)
                            : t('analyticsNoBranch')}
                        </td>
                        <td>{formatMoney(row.amount, locale, currency)}</td>
                        <td>{formatNumber(row.sharePercent, locale)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <EmptyState title={t('analyticsNoExpenses')} />
          )}
        </>
      ) : null}
    </section>
  )
}
