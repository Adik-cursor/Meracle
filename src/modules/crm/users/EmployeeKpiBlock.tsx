import { useMemo, useState } from 'react'
import {
  customRangeFromDateInputs,
  getFinancialAnalyticsForUser,
  resolveAnalyticsRange,
  type AnalyticsPeriod,
} from '../../../core/services'
import type { User } from '../../../core/types'
import { useAccess } from '../../../app/context/access-context'
import { useLocalization } from '../../../app/context/localization-context'
import { usePersistence, usePersistenceVersion } from '../../../app/context/persistence-context'
import { formatMoney } from '../../sales/pos-format'

type EmployeeKpiBlockProps = {
  user: User
}

const PERIODS: readonly Extract<AnalyticsPeriod, 'today' | '7d' | 'month' | 'custom'>[] =
  ['today', '7d', 'month', 'custom']

export function EmployeeKpiBlock({ user }: EmployeeKpiBlockProps) {
  const { t, locale } = useLocalization()
  const { currentUser } = useAccess()
  const persistence = usePersistence()
  const version = usePersistenceVersion()
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>('month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  const report = useMemo(() => {
    void version
    if (!currentUser) {
      return null
    }

    const customReady = Boolean(customFrom && customTo)
    if (period === 'custom' && !customReady) {
      return null
    }

    const range = resolveAnalyticsRange(
      period,
      new Date().toISOString(),
      period === 'custom' && customReady
        ? customRangeFromDateInputs(customFrom, customTo)
        : undefined,
    )

    return getFinancialAnalyticsForUser(persistence, currentUser, range, {
      userId: user.id,
    })
  }, [currentUser, customFrom, customTo, period, persistence, user.id, version])

  const currency = 'KZT'
  const kpis = report?.ok ? report.value.kpis : null
  const employeeRow = report?.ok
    ? report.value.employees.find((row) => row.userId === user.id)
    : undefined

  return (
    <div className="employee-kpi-block">
      <div className="warehouse-card__actions employee-period">
        {PERIODS.map((item) => (
          <button
            key={item}
            type="button"
            className={
              period === item ? 'workspace-tab workspace-tab--active' : 'workspace-tab'
            }
            onClick={() => setPeriod(item)}
          >
            {item === 'today'
              ? t('employeePeriodToday')
              : item === '7d'
                ? t('employeePeriod7d')
                : item === 'month'
                  ? t('employeePeriodMonth')
                  : t('employeePeriodCustom')}
          </button>
        ))}
      </div>
      {period === 'custom' ? (
        <div className="warehouse-card__actions">
          <input
            className="warehouse-input"
            type="date"
            value={customFrom}
            onChange={(event) => setCustomFrom(event.target.value)}
            aria-label={t('employeePeriodCustom')}
          />
          <input
            className="warehouse-input"
            type="date"
            value={customTo}
            onChange={(event) => setCustomTo(event.target.value)}
            aria-label={t('employeePeriodCustom')}
          />
        </div>
      ) : null}

      {report && !report.ok ? (
        <p className="workspace-muted">{t('employeeAnalyticsUnavailable')}</p>
      ) : null}

      {kpis ? (
        <dl className="employee-kpi-grid">
          <div>
            <dt>{t('employeeKpiSalesCount')}</dt>
            <dd>{employeeRow?.salesCount ?? kpis.salesCount}</dd>
          </div>
          <div>
            <dt>{t('employeeKpiRevenue')}</dt>
            <dd>{formatMoney(employeeRow?.revenue ?? kpis.revenue, locale, currency)}</dd>
          </div>
          <div>
            <dt>{t('employeeKpiAverageCheck')}</dt>
            <dd>
              {formatMoney(employeeRow?.averageCheck ?? kpis.averageCheck, locale, currency)}
            </dd>
          </div>
          <div>
            <dt>{t('employeeKpiReturns')}</dt>
            <dd>{employeeRow?.returnedQuantity ?? '—'}</dd>
          </div>
          <div>
            <dt>{t('employeeKpiDiscounts')}</dt>
            <dd>{formatMoney(employeeRow?.discounts ?? kpis.discounts, locale, currency)}</dd>
          </div>
        </dl>
      ) : null}
    </div>
  )
}
