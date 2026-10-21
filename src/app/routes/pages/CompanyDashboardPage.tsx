import { useMemo, useState } from 'react'
import { useAuth } from '../../context/auth-context'
import { useLocalization } from '../../context/localization-context'
import { useOrganization } from '../../context/organization-context'
import { usePersistence, usePersistenceVersion } from '../../context/persistence-context'
import { AuthRequiredState } from '../../components/AuthRequiredState'
import { Button, PageHeader, Select } from '../../../shared/ui'
import { formatMoney } from '../../../modules/sales/pos-format'
import { useAppPath } from '../useAppPath'
import { getDefaultCrmPath, getDefaultExpensesPath } from '../app.routes'
import {
  currentMotivationPeriodKey,
  FINANCE_ANALYTICS_HREF,
  getCompanyDashboardForUser,
  resolveDashboardSections,
} from '../../../core/services'
import { KindergartenDashboardSections } from '../../../modules/company/KindergartenCompanyDashboard'
import { RentalDashboardSections } from '../../../modules/rental/RentalCompanyDashboard'
import { formatYearMonth } from '../../../shared/format-period'

function recentPeriodKeys(current: string): string[] {
  const [yearText, monthText] = current.split('-').map(Number)
  if (!yearText || !monthText) {
    return [current]
  }
  const keys: string[] = []
  for (let offset = 0; offset < 12; offset += 1) {
    const date = new Date(Date.UTC(yearText, monthText - 1 - offset, 1))
    keys.push(
      `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`,
    )
  }
  return keys
}

export function CompanyDashboardPage() {
  const { t, locale } = useLocalization()
  const { navigate } = useAppPath()
  const { currentUser } = useAuth()
  const { settings, modules } = useOrganization()
  const persistence = usePersistence()
  const version = usePersistenceVersion()
  const [periodKey, setPeriodKey] = useState(currentMotivationPeriodKey)

  const crmPath = getDefaultCrmPath(modules) ?? '/deals'
  const salesPath = '/sales'
  const warehousePath = '/warehouse'
  const expensesPath = getDefaultExpensesPath(modules) ?? '/finance'
  const periodOptions = useMemo(
    () => recentPeriodKeys(currentMotivationPeriodKey()),
    [],
  )

  const sections = resolveDashboardSections(modules)

  const dashboard = useMemo(() => {
    void version
    return getCompanyDashboardForUser(persistence, currentUser, periodKey)
  }, [currentUser, periodKey, persistence, version])

  if (!currentUser) {
    return <AuthRequiredState />
  }

  if (!dashboard.ok) {
    return <AuthRequiredState />
  }

  const view = dashboard.value
  const attention: string[] = []
  if (view.sales && view.sales.overdueInvoices > 0) {
    attention.push(`${t('attentionOverdueInvoice')}: ${view.sales.overdueInvoices}`)
  }
  if (view.warehouse && view.warehouse.zeroStock > 0) {
    attention.push(`${t('attentionZeroStock')}: ${view.warehouse.zeroStock}`)
  }

  const money = (value: number) => formatMoney(value, locale, settings.currency)
  const percent = (value: number) =>
    `${(Number.isFinite(value) ? value : 0).toLocaleString(locale === 'kk' ? 'kk-KZ' : 'ru-RU', {
      maximumFractionDigits: 1,
    })}%`

  const ownPlan =
    view.ownMotivation && view.ownMotivation.lines.length > 0
      ? view.ownMotivation.lines.reduce((sum, line) => sum + line.planAmount, 0)
      : 0
  const ownFact =
    view.ownMotivation && view.ownMotivation.lines.length > 0
      ? view.ownMotivation.lines.reduce((sum, line) => sum + line.actualAmount, 0)
      : 0
  const ownCompletion = ownPlan > 0 ? (ownFact / ownPlan) * 100 : 0

  const showRentalSections = sections.rental && Boolean(view.rental)
  const showCareSections = Boolean(view.care) && sections.children === true
  const showStaffAttendance =
    Boolean(view.care) && sections.attendance === true && sections.children !== true
  const showCareFinance = Boolean(
    view.care?.childrenIncluded && (view.care.expensesIncluded || view.care.paymentsIncluded),
  )
  const showCompactCrm = Boolean(view.crm) && !view.care?.applicationsIncluded
  const showCompactRental = Boolean(view.rental) && !showRentalSections

  return (
    <section
      className={[
        'workspace-page',
        'ds-page',
        'company-dashboard',
      ]
        .join(' ')}
    >
      <PageHeader
        title={t('navDashboard')}
        actions={
          <>
            <label className="dash-period">
              <span className="visually-hidden">{t('dashboardFinancialPeriod')}</span>
              <Select
                value={periodKey}
                aria-label={t('dashboardFinancialPeriod')}
                onChange={(event) => setPeriodKey(event.target.value)}
              >
                {periodOptions.map((key) => (
                  <option key={key} value={key}>
                    {formatYearMonth(key, locale)}
                  </option>
                ))}
              </Select>
            </label>
            {view.quickActions.newSale ? (
              <Button variant="primary" onClick={() => navigate('/sales')}>
                {t('quickNewSale')}
              </Button>
            ) : null}
          </>
        }
      />

      {view.sales && sections.sales ? (
        <section className="dash-hero">
          <div className="ds-section__head">
            <h3 className="ds-section__title">
              {view.sales.personal ? t('dashboardMySales') : t('dashboardOverview')}
            </h3>
            <Button variant="ghost" onClick={() => navigate(salesPath)}>
              {t('dashboardOpenSales')}
            </Button>
          </div>
          <dl className="dash-kpi-strip">
            {view.sales.canReadAmount ? (
              <div className="dash-hero__primary">
                <dt>{t('dashboardKpiRevenue')}</dt>
                <dd>{money(view.sales.revenue)}</dd>
              </div>
            ) : (
              <div className="dash-hero__primary">
                <dt>{t('dashboardKpiSalesCount')}</dt>
                <dd>{view.sales.count}</dd>
              </div>
            )}
          </dl>
        </section>
      ) : null}

      {view.sales && sections.sales && (view.sales.canReadAmount || view.analytics) ? (
        <dl className="dash-kpi-rest dash-kpi-rest--premium">
            {view.sales.canReadAmount ? (
            <div>
              <dt>{t('dashboardKpiSalesCount')}</dt>
              <dd>{view.sales.count}</dd>
            </div>
            ) : null}
            {view.sales.canReadAmount ? (
              <div>
                <dt>{t('dashboardKpiAverageCheck')}</dt>
                <dd>{money(view.sales.averageCheck)}</dd>
              </div>
            ) : null}
            {view.analytics ? (
              <>
                <div>
                  <dt>{t('dashboardKpiExpenses')}</dt>
                  <dd>{money(view.analytics.expenses)}</dd>
                </div>
                <div>
                  <dt>{t('dashboardKpiProfit')}</dt>
                  <dd>{money(view.analytics.netProfit)}</dd>
                </div>
              </>
            ) : null}
        </dl>
      ) : null}

      {showRentalSections ? <RentalDashboardSections /> : null}

      {(view.companyPlans && sections.plans) ||
      (view.ownMotivation && sections.plans) ||
      view.debts ? (
        <div className="dash-work-row">
      {view.companyPlans && sections.plans ? (
        <article className="dash-card">
          <div className="dash-card__head">
            <h3 className="dash-card__title">{t('dashboardPlans')}</h3>
            <Button variant="ghost" onClick={() => navigate('/company/plans')}>
              {t('dashboardOpenAction')}
            </Button>
          </div>
          <p className="dash-metric__label">{t('companyPlanAmount')}</p>
          <p className="dash-metric__value dash-metric__value--featured">
            {money(view.companyPlans.companyPlan)}
          </p>
          <p className="dash-metric__hint">
            {t('dashboardPlanFactHint').replace(
              '{amount}',
              money(view.companyPlans.companyActual),
            )}
          </p>
          <p className="dash-progress__value">
            {percent(view.companyPlans.companyCompletion)}
          </p>
          <div
            className="dash-progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.max(
              0,
              Math.min(100, Number.isFinite(view.companyPlans.companyCompletion)
                ? view.companyPlans.companyCompletion
                : 0),
            )}
          >
            <span
              style={{
                width: `${Math.max(
                  0,
                  Math.min(
                    100,
                    Number.isFinite(view.companyPlans.companyCompletion)
                      ? view.companyPlans.companyCompletion
                      : 0,
                  ),
                )}%`,
              }}
            />
          </div>
          <div className="dash-metric-row dash-metric-row--compact">
            <div className="dash-metric">
              <p className="dash-metric__label">{t('employeeBonus')}</p>
              <p className="dash-metric__value dash-metric__value--sm">
                {money(view.companyPlans.companyBonus)}
              </p>
            </div>
            <div className="dash-metric">
              <p className="dash-metric__label">{t('dashboardEmployeesWithPlan')}</p>
              <p className="dash-metric__value dash-metric__value--sm">
                {view.companyPlans.employeesWithPlan}
              </p>
            </div>
          </div>
        </article>
      ) : view.ownMotivation && sections.plans ? (
        <article className="dash-card">
          <div className="dash-card__head">
            <h3 className="dash-card__title">{t('dashboardMyPlan')}</h3>
            <Button
              variant="ghost"
              onClick={() => navigate(`/company/employees/${currentUser.id}?tab=motivation`)}
            >
              {t('dashboardOpenAction')}
            </Button>
          </div>
          <p className="dash-metric__label">{t('dashboardMyPlan')}</p>
          <p className="dash-metric__value dash-metric__value--featured">{money(ownPlan)}</p>
          <p className="dash-metric__hint">
            {t('dashboardPlanFactHint').replace('{amount}', money(ownFact))}
          </p>
          <p className="dash-progress__value">{percent(ownCompletion)}</p>
          <div
            className="dash-progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.max(0, Math.min(100, ownCompletion))}
          >
            <span style={{ width: `${Math.max(0, Math.min(100, ownCompletion))}%` }} />
          </div>
          <div className="dash-metric">
            <p className="dash-metric__label">{t('employeeBonus')}</p>
            <p className="dash-metric__value dash-metric__value--sm">
              {money(view.ownMotivation.bonusAmount)}
            </p>
          </div>
        </article>
      ) : null}

          {view.debts ? (
            <article className="dash-card">
              <div className="dash-card__head">
                <h3 className="dash-card__title">{t('navCounterpartyDebts')}</h3>
                <Button variant="ghost" onClick={() => navigate('/company/debts')}>
                  {t('dashboardOpenAction')}
                </Button>
              </div>
              <div className="dash-metric dash-metric--lead">
                <p className="dash-metric__label">{t('debtRemaining')}</p>
                <p className="dash-metric__value dash-metric__value--featured">
                  {money(view.debts.remaining)}
                </p>
              </div>
              <div className="dash-metric-row dash-metric-row--2">
                <div className="dash-metric">
                  <p className="dash-metric__label">{t('debtOverdue')}</p>
                  <p className="dash-metric__value dash-metric__value--sm">
                    {money(view.debts.overdue)}
                  </p>
                </div>
                <div className="dash-metric">
                  <p className="dash-metric__label">{t('debtorsCount')}</p>
                  <p className="dash-metric__value dash-metric__value--sm">
                    {view.debts.debtors}
                  </p>
                </div>
              </div>
            </article>
          ) : null}
        </div>
      ) : null}

      {(view.warehouse || view.analytics || (view.expenses && !showCareFinance)) ? (
        <div className="dash-work-row">
          {view.warehouse ? (
            <article className="dash-card">
              <div className="dash-card__head">
                <h3 className="dash-card__title">{t('navWarehouseSection')}</h3>
                <Button variant="ghost" onClick={() => navigate(warehousePath)}>
                  {t('dashboardOpenAction')}
                </Button>
              </div>
              <div className="dash-metric-row dash-metric-row--compact">
                <div className="dash-metric dash-metric--lead">
                  <p className="dash-metric__label">{t('dashboardKpiProducts')}</p>
                  <p className="dash-metric__value dash-metric__value--sm">
                    {view.warehouse.products}
                  </p>
                </div>
                <div className="dash-metric">
                  <p className="dash-metric__label">{t('dashboardKpiStock')}</p>
                  <p className="dash-metric__value dash-metric__value--sm">
                    {view.warehouse.stock}
                  </p>
                </div>
                <div className="dash-metric">
                  <p className="dash-metric__label">{t('dashboardKpiZeroStock')}</p>
                  <p className="dash-metric__value dash-metric__value--sm">
                    {view.warehouse.zeroStock}
                  </p>
                </div>
              </div>
            </article>
          ) : null}

          {view.analytics ? (
            <article className="dash-card">
          <div className="dash-card__head">
            <h3 className="dash-card__title">{t('navAnalyticsSection')}</h3>
            <Button variant="ghost" onClick={() => navigate(FINANCE_ANALYTICS_HREF)}>
              {t('dashboardOpenAction')}
            </Button>
          </div>
          <div className="dash-metric-row dash-metric-row--compact">
            <div className="dash-metric dash-metric--lead">
              <p className="dash-metric__label">{t('dashboardKpiProfit')}</p>
              <p className="dash-metric__value dash-metric__value--sm">
                {money(view.analytics.netProfit)}
              </p>
            </div>
            <div className="dash-metric">
              <p className="dash-metric__label">{t('dashboardKpiExpenses')}</p>
              <p className="dash-metric__value dash-metric__value--sm">
                {money(view.analytics.expenses)}
              </p>
            </div>
            <div className="dash-metric">
              <p className="dash-metric__label">{t('dashboardKpiMargin')}</p>
              <p className="dash-metric__value dash-metric__value--sm">
                {percent(view.analytics.marginPercent)}
              </p>
            </div>
          </div>
        </article>
      ) : view.expenses && !showCareFinance ? (
        <article className="dash-card">
          <div className="dash-card__head">
            <h3 className="dash-card__title">{t('navExpensesSection')}</h3>
            <Button variant="ghost" onClick={() => navigate(expensesPath)}>
              {t('dashboardOpenAction')}
            </Button>
          </div>
          <div className="dash-metric">
            <p className="dash-metric__label">{t('dashboardKpiExpenses')}</p>
            <p className="dash-metric__value dash-metric__value--sm">
              {money(view.expenses.total)}
            </p>
          </div>
        </article>
      ) : null}
        </div>
      ) : null}

      {showCompactCrm && view.crm ? (
        <article className="dash-card dash-card--compact">
          <div className="dash-card__head">
            <h3 className="dash-card__title">{t('navCrmSection')}</h3>
            <Button variant="ghost" onClick={() => navigate(crmPath)}>
              {t('dashboardOpenAction')}
            </Button>
          </div>
          <div className="dash-metric-row dash-metric-row--compact">
            <div className="dash-metric dash-metric--lead">
              <p className="dash-metric__label">{t('dashboardKpiDeals')}</p>
              <p className="dash-metric__value dash-metric__value--sm">{view.crm.deals}</p>
            </div>
            <div className="dash-metric">
              <p className="dash-metric__label">{t('dashboardKpiNewDeals')}</p>
              <p className="dash-metric__value dash-metric__value--sm">{view.crm.newDeals}</p>
            </div>
            <div className="dash-metric">
              <p className="dash-metric__label">{t('dashboardKpiDealsInProgress')}</p>
              <p className="dash-metric__value dash-metric__value--sm">{view.crm.inProgress}</p>
            </div>
          </div>
        </article>
      ) : null}

      {showCompactRental && view.rental ? (
        <article className="dash-card dash-card--compact">
          <div className="dash-card__head">
            <h3 className="dash-card__title">{t('platformModuleRental')}</h3>
            <Button variant="ghost" onClick={() => navigate('/rental')}>
              {t('dashboardOpenAction')}
            </Button>
          </div>
          <div className="dash-metric-row dash-metric-row--compact dash-metric-row--4">
            <div className="dash-metric">
              <p className="dash-metric__label">{t('rentalKpiBookings')}</p>
              <p className="dash-metric__value dash-metric__value--sm">{view.rental.bookings}</p>
            </div>
            <div className="dash-metric">
              <p className="dash-metric__label">{t('rentalInUse')}</p>
              <p className="dash-metric__value dash-metric__value--sm">{view.rental.active}</p>
            </div>
            <div className="dash-metric">
              <p className="dash-metric__label">{t('rentalOverdue')}</p>
              <p className="dash-metric__value dash-metric__value--sm">{view.rental.overdue}</p>
            </div>
            <div className="dash-metric">
              <p className="dash-metric__label">{t('rentalDue')}</p>
              <p className="dash-metric__value dash-metric__value--sm">{money(view.rental.dueAmount)}</p>
            </div>
          </div>
        </article>
      ) : null}

      {showStaffAttendance && view.care ? (
        <article className="dash-card dash-card--compact">
          <div className="dash-card__head">
            <h3 className="dash-card__title">{t('dashboardStaffAttendance')}</h3>
            <Button variant="ghost" onClick={() => navigate('/attendance')}>
              {t('dashboardOpenAction')}
            </Button>
          </div>
          <div className="dash-metric-row dash-metric-row--compact">
            <div className="dash-metric">
              <p className="dash-metric__label">{t('careStaffOnWork')}</p>
              <p className="dash-metric__value dash-metric__value--sm">{view.care.staffPresent}</p>
            </div>
            <div className="dash-metric">
              <p className="dash-metric__label">{t('careStaffAbsent')}</p>
              <p className="dash-metric__value dash-metric__value--sm">{view.care.staffAbsent}</p>
            </div>
            <div className="dash-metric">
              <p className="dash-metric__label">{t('careStaffUnmarked')}</p>
              <p className="dash-metric__value dash-metric__value--sm">{view.care.staffUnmarked}</p>
            </div>
          </div>
        </article>
      ) : null}

      {showCareSections && view.care ? (
        <KindergartenDashboardSections care={view.care} />
      ) : null}

      {attention.length > 0 ? (
        <article className="dash-card dash-attention">
          <h3 className="dash-card__title">{t('dashboardAttention')}</h3>
          <ul className="employee-activity-list">
            {attention.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
      ) : null}
    </section>
  )
}
