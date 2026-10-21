import { useMemo, useState } from 'react'
import {
  canWriteMotivation,
  computeMotivationBonus,
  currentMotivationPeriodKey,
  getEmployeeMotivationForUser,
  isMotivationPeriodLocked,
  listEmployeeMotivationPeriodsForUser,
  listProductCategoriesForUser,
  saveEmployeeMotivationForUser,
} from '../../../core/services'
import type { Id, User } from '../../../core/types'
import { useAccess } from '../../../app/context/access-context'
import { useLocalization } from '../../../app/context/localization-context'
import { useOrganization } from '../../../app/context/organization-context'
import { usePersistence, usePersistenceVersion } from '../../../app/context/persistence-context'
import { Button } from '../../../shared/ui'
import { formatMoney } from '../../sales/pos-format'

type EmployeeMotivationPanelProps = {
  user: User
}

type DraftLine = {
  categoryId: Id
  planAmount: string
  bonusPercent: string
  reducedBonusCoefficient: string
  fullBonusCompletionPercent: string
}

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

function parseDecimal(value: string): number {
  return Number(value.trim().replace(',', '.'))
}

function formatPercentValue(value: number): string {
  if (!Number.isFinite(value)) {
    return '0%'
  }
  const digits = Number.isInteger(value) ? 0 : 2
  return `${value.toFixed(digits)}%`
}

export function EmployeeMotivationPanel({ user }: EmployeeMotivationPanelProps) {
  const { t, locale } = useLocalization()
  const { settings } = useOrganization()
  const { currentUser } = useAccess()
  const persistence = usePersistence()
  const version = usePersistenceVersion()
  const [periodKey, setPeriodKey] = useState(currentMotivationPeriodKey())
  const [draft, setDraft] = useState<DraftLine[] | null>(null)
  const [error, setError] = useState(false)

  const view = useMemo(() => {
    void version
    return getEmployeeMotivationForUser(persistence, currentUser, user.id, periodKey)
  }, [currentUser, periodKey, persistence, user.id, version])

  const periods = useMemo(() => {
    void version
    const listed = listEmployeeMotivationPeriodsForUser(persistence, currentUser, user.id)
    return listed.ok ? listed.value : [periodKey]
  }, [currentUser, periodKey, persistence, user.id, version])

  const categories = useMemo(() => {
    void version
    const listed = listProductCategoriesForUser(persistence, currentUser, {
      activeOnly: true,
    })
    return listed.ok ? listed.value : []
  }, [currentUser, persistence, version])

  if (!view.ok) {
    return (
      <div className="settings-section">
        <h3>{t('employeeTabMotivation')}</h3>
        <p className="workspace-muted">{t('ACCESS_DENIED')}</p>
      </div>
    )
  }

  const data = view.value
  const lines = draft ??
    data?.lines.map((line) => ({
      categoryId: line.categoryId,
      planAmount: String(line.planAmount),
      bonusPercent: String(line.bonusPercent),
      reducedBonusCoefficient: String(line.reducedBonusCoefficient),
      fullBonusCompletionPercent: String(line.fullBonusCompletionPercent),
    })) ??
    []
  const used = new Set(lines.map((line) => line.categoryId))
  const available = categories.filter((category) => !used.has(category.id))
  const writable =
    canWriteMotivation(currentUser) && !isMotivationPeriodLocked(periodKey)

  const addLine = () => {
    const next = available[0]
    if (!next) {
      return
    }
    setDraft([
      ...lines,
      {
        categoryId: next.id,
        planAmount: '',
        bonusPercent: '1',
        reducedBonusCoefficient: '0.7',
        fullBonusCompletionPercent: '100',
      },
    ])
  }

  const save = () => {
    const payload = lines.map((line) => ({
      categoryId: line.categoryId,
      planAmount: parseDecimal(line.planAmount),
      bonusPercent: parseDecimal(line.bonusPercent),
      reducedBonusCoefficient: parseDecimal(line.reducedBonusCoefficient),
      fullBonusCompletionPercent: parseDecimal(line.fullBonusCompletionPercent),
    }))
    const saved = saveEmployeeMotivationForUser(
      persistence,
      currentUser,
      user.id,
      periodKey,
      payload,
    )
    setError(!saved.ok)
    if (saved.ok) {
      setDraft(null)
    }
  }

  return (
    <div className="settings-section">
      <h3>{t('employeeTabMotivation')}</h3>
      <label className="warehouse-field">
        <span className="settings-field__label">{t('motivationPeriod')}</span>
        <select
          className="warehouse-input"
          value={periodKey}
          onChange={(event) => {
            setPeriodKey(event.target.value)
            setDraft(null)
            setError(false)
          }}
        >
          {periods.map((key) => (
            <option key={key} value={key}>
              {periodLabel(key, locale)}
            </option>
          ))}
        </select>
      </label>

      {data ? (
        <>
          <dl className="employee-kpi-grid">
            <div>
              <dt>{t('employeeSalary')}</dt>
              <dd>{formatMoney(data.salaryAmount, locale, settings.currency)}</dd>
            </div>
            <div>
              <dt>{t('employeeBonus')}</dt>
              <dd>{formatMoney(data.bonusAmount, locale, settings.currency)}</dd>
            </div>
            <div>
              <dt>{t('employeeTotalPay')}</dt>
              <dd>{formatMoney(data.totalAmount, locale, settings.currency)}</dd>
            </div>
          </dl>
          {data.lines.length > 0 ? (
            <div className="employee-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('productCategory')}</th>
                    <th>{t('motivationPlan')}</th>
                    <th>{t('motivationActual')}</th>
                    <th>{t('motivationCompletion')}</th>
                    <th>{t('motivationBonusPercent')}</th>
                    <th>{t('motivationEffectiveBonusPercent')}</th>
                    <th>{t('employeeBonus')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.lines.map((line) => (
                    <tr key={line.categoryId}>
                      <td>{line.categoryName}</td>
                      <td>{formatMoney(line.planAmount, locale, settings.currency)}</td>
                      <td>{formatMoney(line.actualAmount, locale, settings.currency)}</td>
                      <td>
                        {Number.isFinite(line.completionPercent)
                          ? `${line.completionPercent.toFixed(1)}%`
                          : '0%'}
                      </td>
                      <td>{formatPercentValue(line.bonusPercent)}</td>
                      <td>{formatPercentValue(line.effectiveBonusPercent)}</td>
                      <td>{formatMoney(line.bonusAmount, locale, settings.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      ) : (
        <p className="workspace-muted">{t('motivationEmpty')}</p>
      )}

      {lines.map((line, index) => {
        const viewLine = data?.lines.find((item) => item.categoryId === line.categoryId)
        const preview = computeMotivationBonus({
          planAmount: parseDecimal(line.planAmount),
          actualAmount: viewLine?.actualAmount ?? 0,
          bonusPercent: parseDecimal(line.bonusPercent),
          reducedBonusCoefficient: parseDecimal(line.reducedBonusCoefficient),
          fullBonusCompletionPercent: parseDecimal(line.fullBonusCompletionPercent),
        })
        return (
          <div key={`${line.categoryId}-${index}`} className="settings-section">
            <label className="warehouse-field">
              <span className="settings-field__label">{t('productCategory')}</span>
              <select
                className="warehouse-input"
                value={line.categoryId}
                disabled={!writable}
                onChange={(event) => {
                  const next = [...lines]
                  next[index] = { ...line, categoryId: event.target.value }
                  setDraft(next)
                }}
              >
                <option value={line.categoryId}>
                  {categories.find((item) => item.id === line.categoryId)?.name ??
                    viewLine?.categoryName ??
                    line.categoryId}
                </option>
                {available.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="warehouse-field">
              <span className="settings-field__label">{t('motivationPlan')}</span>
              <input
                className="warehouse-input"
                value={line.planAmount}
                disabled={!writable}
                onChange={(event) => {
                  const next = [...lines]
                  next[index] = { ...line, planAmount: event.target.value }
                  setDraft(next)
                }}
              />
            </label>
            <label className="warehouse-field">
              <span className="settings-field__label">{t('motivationBonusPercent')}</span>
              <input
                className="warehouse-input"
                value={line.bonusPercent}
                disabled={!writable}
                onChange={(event) => {
                  const next = [...lines]
                  next[index] = { ...line, bonusPercent: event.target.value }
                  setDraft(next)
                }}
              />
            </label>
            <label className="warehouse-field">
              <span className="settings-field__label">{t('motivationReducedCoefficient')}</span>
              <input
                className="warehouse-input"
                value={line.reducedBonusCoefficient}
                disabled={!writable}
                onChange={(event) => {
                  const next = [...lines]
                  next[index] = { ...line, reducedBonusCoefficient: event.target.value }
                  setDraft(next)
                }}
              />
            </label>
            <label className="warehouse-field">
              <span className="settings-field__label">{t('motivationFullBonusFrom')}</span>
              <input
                className="warehouse-input"
                value={line.fullBonusCompletionPercent}
                disabled={!writable}
                onChange={(event) => {
                  const next = [...lines]
                  next[index] = { ...line, fullBonusCompletionPercent: event.target.value }
                  setDraft(next)
                }}
              />
            </label>
            <p className="workspace-muted">
              {t('motivationActual')}:{' '}
              {formatMoney(viewLine?.actualAmount ?? 0, locale, settings.currency)}
              {' · '}
              {t('motivationCompletion')}: {formatPercentValue(preview.completionPercent)}
              {' · '}
              {t('motivationEffectiveBonusPercent')}:{' '}
              {formatPercentValue(preview.effectiveBonusPercent)}
              {' · '}
              {t('motivationCalculatedBonus')}:{' '}
              {formatMoney(preview.bonusAmount, locale, settings.currency)}
            </p>
          </div>
        )
      })}

      {writable ? (
        <div className="warehouse-card__actions">
          <Button onClick={addLine} disabled={available.length === 0}>
            {t('motivationAddCategory')}
          </Button>
          <Button variant="primary" onClick={save} disabled={lines.length === 0}>
            {t('save')}
          </Button>
        </div>
      ) : null}
      {writable && categories.length === 0 ? (
        <p className="workspace-muted">{t('motivationNoCategories')}</p>
      ) : null}
      {writable && categories.length > 0 && available.length === 0 ? (
        <p className="workspace-muted">{t('motivationAllCategoriesAdded')}</p>
      ) : null}
      {error ? <p className="workspace-muted">{t('INVALID_INPUT')}</p> : null}
    </div>
  )
}
