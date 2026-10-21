import { useMemo } from 'react'
import { getFinanceOverviewForUser, type FinanceOverviewKpiId } from '../../../core/services'
import { useAccess } from '../../context/access-context'
import { useLocalization } from '../../context/localization-context'
import { useOrganization } from '../../context/organization-context'
import { usePersistence, usePersistenceVersion } from '../../context/persistence-context'
import { formatMoney } from '../../../modules/sales/pos-format'
import { formatYearMonth } from '../../../shared/format-period'
import type { TranslationKey } from '../../../core/localization/translations'

const KPI_LABEL: Record<FinanceOverviewKpiId, TranslationKey> = {
  charged: 'careCharged',
  paid: 'carePaid',
  due: 'careDue',
  prepayment: 'financeKpiPrepayment',
  rentalTotal: 'financeKpiRentalTotal',
  revenue: 'financeKpiRevenue',
  cogs: 'financeKpiCogs',
  grossProfit: 'financeKpiGrossProfit',
  expenses: 'navExpensesSection',
  result: 'financeKpiResult',
  debt: 'financeTabDebts',
  payrollRemaining: 'financeKpiPayroll',
}

export function FinanceOverviewPanel() {
  const { t, locale } = useLocalization()
  const { currentUser } = useAccess()
  const { settings } = useOrganization()
  const persistence = usePersistence()
  const version = usePersistenceVersion()
  const overview = useMemo(() => {
    void version
    return getFinanceOverviewForUser(persistence, currentUser)
  }, [currentUser, persistence, version])

  if (!overview.ok) {
    return <p className="workspace-muted">{t(overview.error.code as TranslationKey)}</p>
  }

  const money = (value: number) => formatMoney(value, locale, settings.currency)
  const lead =
    overview.value.kpis.find((kpi) => kpi.id === 'result') ??
    overview.value.kpis.find((kpi) => kpi.id === 'revenue' || kpi.id === 'charged' || kpi.id === 'rentalTotal') ??
    overview.value.kpis[0]
  const rest = overview.value.kpis.filter((kpi) => kpi.id !== lead?.id)

  return (
    <div className="ds-page finance-overview">
      <header className="ds-context">
        <p className="ds-context__kicker">{t('dashboardFinancialPeriod')}</p>
        <h3 className="ds-context__title">{formatYearMonth(overview.value.period, locale)}</h3>
      </header>
      {lead ? (
        <dl className="ds-summary">
          <div className="ds-summary__lead">
            <dt>{t(KPI_LABEL[lead.id])}</dt>
            <dd>{money(lead.amount)}</dd>
          </div>
          <div className="ds-summary__rest">
            {rest.map((kpi) => (
              <div key={kpi.id} className="ds-metric">
                <dt>{t(KPI_LABEL[kpi.id])}</dt>
                <dd>{money(kpi.amount)}</dd>
              </div>
            ))}
          </div>
        </dl>
      ) : null}
    </div>
  )
}
