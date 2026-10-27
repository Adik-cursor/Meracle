import { useMemo, useState } from 'react'
import {
  canAccessMotivationPlans,
  currentMotivationPeriodKey,
  listCompanyMotivationPlansForUser,
} from '../../../core/services'
import { useAccess } from '../../context/access-context'
import { useLocalization } from '../../context/localization-context'
import { useOrganization } from '../../context/organization-context'
import { usePersistence, usePersistenceVersion } from '../../context/persistence-context'
import { useUsers } from '../../context/user-context'
import { AuthRequiredState } from '../../components/AuthRequiredState'
import { Button, EmptyState, Table } from '../../../shared/ui'
import { formatMoney } from '../../../modules/sales/pos-format'
import { userDisplayName } from '../../../modules/crm/users/user-name'
import { useAppPath } from '../useAppPath'

function periodLabel(periodKey: string, locale: string): string {
  const [year, month] = periodKey.split('-').map(Number)
  if (!year || !month) {
    return periodKey
  }

  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(
    locale === 'kk' ? 'kk-KZ' : 'ru-RU',
    { month: 'long', year: 'numeric', timeZone: 'UTC' },
  )
}

function formatPercent(value: number, locale: string): string {
  if (!Number.isFinite(value)) {
    return '0%'
  }

  return `${value.toLocaleString(locale === 'kk' ? 'kk-KZ' : 'ru-RU', {
    maximumFractionDigits: 1,
  })}%`
}

function completionBand(value: number): 'zero' | 'low' | 'mid' | 'high' {
  if (!Number.isFinite(value) || value <= 0) {
    return 'zero'
  }
  if (value < 50) {
    return 'low'
  }
  if (value < 90) {
    return 'mid'
  }
  return 'high'
}

export function CompanyPlansPage() {
  const { t, locale } = useLocalization()
  const { settings, modules } = useOrganization()
  const { currentUser } = useAccess()
  const { getUser } = useUsers()
  const { navigate } = useAppPath()
  const persistence = usePersistence()
  const version = usePersistenceVersion()
  const [periodKey, setPeriodKey] = useState(currentMotivationPeriodKey())

  const listed = useMemo(() => {
    void version
    if (modules.plans !== true) {
      return { ok: false as const, error: { code: 'MODULE_NOT_ENABLED' as const } }
    }
    return listCompanyMotivationPlansForUser(persistence, currentUser, periodKey)
  }, [currentUser, modules.plans, periodKey, persistence, version])

  if (!currentUser) {
    return <AuthRequiredState />
  }

  if (!canAccessMotivationPlans(currentUser) || !listed.ok) {
    return <p className="workspace-muted">{t('ACCESS_DENIED')}</p>
  }

  const board = listed.value

  return (
    <section className="workspace-page company-plans-page">
      <div className="workspace-toolbar">
        <h2 className="workspace-toolbar__title">{t('dashboardPlans')}</h2>
        <label className="warehouse-field">
          <span className="settings-field__label">{t('motivationPeriod')}</span>
          <select
            className="warehouse-input"
            value={periodKey}
            onChange={(event) => setPeriodKey(event.target.value)}
          >
            {board.periodKeys.map((key) => (
              <option key={key} value={key}>
                {periodLabel(key, locale)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="kpi-grid plans-kpi">
        <div className="kpi-card">
          <p className="kpi-card__label">{t('companyPlanAmount')}</p>
          <p className="kpi-card__value">
            {formatMoney(board.companyPlan, locale, settings.currency)}
          </p>
          <p className="kpi-card__hint">{periodLabel(board.periodKey, locale)}</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-card__label">{t('companyActualAmount')}</p>
          <p className="kpi-card__value">
            {formatMoney(board.companyActual, locale, settings.currency)}
          </p>
          <p className="kpi-card__hint">
            {formatPercent(board.companyCompletion, locale)}
          </p>
        </div>
        <div className="kpi-card">
          <p className="kpi-card__label">{t('motivationCompletion')}</p>
          <p className="kpi-card__value">
            {formatPercent(board.companyCompletion, locale)}
          </p>
          <div
            className={`plans-progress plans-progress--${completionBand(board.companyCompletion)}`}
          >
            <span style={{ width: `${Math.min(100, Math.max(0, board.companyCompletion))}%` }} />
          </div>
        </div>
        <div className="kpi-card">
          <p className="kpi-card__label">{t('companyBonusTotal')}</p>
          <p className="kpi-card__value">
            {formatMoney(board.companyBonus, locale, settings.currency)}
          </p>
          <p className="kpi-card__hint">
            {board.employeesWithPlan} {t('employeePlans')}
          </p>
        </div>
      </div>

      <section className="plans-employees-section">
        <h3>{t('employeePlans')}</h3>
        {board.rows.length === 0 ? (
          <EmptyState title={t('employeePlansEmpty')} />
        ) : (
          <Table className="employee-plans-table" mobileLayout="cards">
            <thead>
              <tr>
                <th>{t('navEmployees')}</th>
                <th className="is-num">{t('motivationPlan')}</th>
                <th className="is-num">{t('motivationActual')}</th>
                <th className="is-num">{t('motivationCompletion')}</th>
                <th className="is-num">{t('employeeBonus')}</th>
                <th>{t('transferActions')}</th>
              </tr>
            </thead>
            <tbody>
              {board.rows.map((row) => {
                const person = getUser(row.userId)
                return (
                  <tr key={row.userId}>
                    <td>
                      <span className="plans-employee-name">
                        {person ? userDisplayName(person) : row.userId.slice(-6)}
                      </span>
                    </td>
                    <td className="is-num">{formatMoney(row.planAmount, locale, settings.currency)}</td>
                    <td className="is-num">{formatMoney(row.actualAmount, locale, settings.currency)}</td>
                    <td className="is-num">
                      <span className={`plans-completion plans-completion--${completionBand(row.completionPercent)}`}>
                        {formatPercent(row.completionPercent, locale)}
                      </span>
                      <div className={`plans-progress plans-progress--${completionBand(row.completionPercent)}`}>
                        <span
                          style={{
                            width: `${Math.min(100, Math.max(0, row.completionPercent))}%`,
                          }}
                        />
                      </div>
                    </td>
                    <td className="is-num">{formatMoney(row.bonusAmount, locale, settings.currency)}</td>
                    <td>
                      <Button
                        variant="ghost"
                        onClick={() =>
                          navigate(`/company/employees/${row.userId}?tab=motivation`)
                        }
                      >
                        {t('open')}
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </Table>
        )}
      </section>
    </section>
  )
}
