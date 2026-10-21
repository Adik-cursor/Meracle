import { useMemo, useState, type FormEvent } from 'react'
import type { User } from '../../../core/types'
import {
  accrueEmployeeCompensationForUser,
  canManageEmployees,
  createEmployeeAdvanceForUser,
  currentMotivationPeriodKey,
  getEmployeeCompensationForUser,
  payEmployeeCompensationRemainingForUser,
} from '../../../core/services'
import { useAccess } from '../../../app/context/access-context'
import { useLocalization } from '../../../app/context/localization-context'
import { useOrganization } from '../../../app/context/organization-context'
import { usePersistence, usePersistenceVersion } from '../../../app/context/persistence-context'
import { formatMoney } from '../../sales/pos-format'
import { formatYearMonth } from '../../../shared/format-period'
import { Badge, Button, EmptyState, Input, Table, useToast } from '../../../shared/ui'
import type { TranslationKey } from '../../../core/localization/translations'

type EmployeeCompensationPanelProps = {
  user: User
}

function statusKey(
  status: 'none' | 'accrued' | 'partial' | 'paid',
): TranslationKey {
  if (status === 'accrued') return 'compensationStatusAccrued'
  if (status === 'partial') return 'compensationStatusPartial'
  if (status === 'paid') return 'compensationStatusPaid'
  return 'compensationStatusNone'
}

export function EmployeeCompensationPanel({ user }: EmployeeCompensationPanelProps) {
  const { t, locale } = useLocalization()
  const { settings } = useOrganization()
  const { currentUser } = useAccess()
  const persistence = usePersistence()
  const version = usePersistenceVersion()
  const canPay = canManageEmployees(currentUser)
  const { showToast } = useToast()
  const [advanceAmount, setAdvanceAmount] = useState('')
  const [error, setError] = useState<string | null>(null)
  const numberLocale = locale === 'kk' ? 'kk-KZ' : 'ru-RU'
  const snapshot = useMemo(() => {
    void version
    return getEmployeeCompensationForUser(
      persistence,
      currentUser,
      user.id,
      currentMotivationPeriodKey(),
    )
  }, [currentUser, persistence, user.id, version])

  const money = (value: number) => formatMoney(value, locale, settings.currency)

  const onAdvance = (event: FormEvent) => {
    event.preventDefault()
    const amount = Number(advanceAmount.replace(',', '.'))
    const result = createEmployeeAdvanceForUser(
      persistence,
      currentUser,
      user.id,
      amount,
    )
    if (!result.ok) {
      setError(t(result.error.code as TranslationKey))
      showToast(t('INVALID_INPUT'), 'error')
      return
    }
    setAdvanceAmount('')
    setError(null)
    showToast(t('compensationAdvanceDone'), 'success')
  }

  if (!snapshot.ok) {
    return <p className="workspace-muted">{t(snapshot.error.code as TranslationKey)}</p>
  }

  const view = snapshot.value

  return (
    <div className="compensation-sheet">
      <div className="compensation-sheet__head">
        <div>
          <h3>
            {t('compensationPeriodHeading')} {formatYearMonth(view.period, locale)}
          </h3>
        </div>
        <p className="compensation-sheet__status">
          <Badge
            tone={
              view.status === 'paid'
                ? 'success'
                : view.status === 'partial'
                  ? 'warning'
                  : view.status === 'accrued'
                    ? 'info'
                    : 'neutral'
            }
          >
            {t(statusKey(view.status))}
          </Badge>
        </p>
      </div>

      <dl className="compensation-rows">
        <div>
          <dt>{t('employeeSalary')}</dt>
          <dd>{money(view.salaryAmount || view.plannedSalary)}</dd>
        </div>
        {view.bonusAmount > 0 || view.plannedBonus > 0 ? (
          <div>
            <dt>{t('employeeBonus')}</dt>
            <dd>{money(view.bonusAmount || view.plannedBonus)}</dd>
          </div>
        ) : null}
        <div className="compensation-rows__total">
          <dt>{t('compensationAccrued')}</dt>
          <dd>{money(view.accruedAmount)}</dd>
        </div>
        <div>
          <dt>{t('compensationPaid')}</dt>
          <dd>{money(view.paidAmount)}</dd>
        </div>
        <div>
          <dt>{t('compensationAdvance')}</dt>
          <dd>{money(view.advanceAmount)}</dd>
        </div>
        <div className="compensation-rows__total">
          <dt>{t('compensationRemaining')}</dt>
          <dd>{money(view.remainingAmount)}</dd>
        </div>
      </dl>

      {canPay ? (
        <div className="compensation-actions">
          {view.status === 'none' ? (
            <Button
              variant="primary"
              onClick={() => {
                const result = accrueEmployeeCompensationForUser(
                  persistence,
                  currentUser,
                  user.id,
                )
                setError(result.ok ? null : t(result.error.code as TranslationKey))
                if (result.ok) {
                  showToast(t('compensationAccrueDone'), 'success')
                }
              }}
            >
              {t('compensationAccrue')}
            </Button>
          ) : null}
          {view.remainingAmount > 0 ? (
            <form className="compensation-advance" onSubmit={onAdvance}>
              <Input
                name="advance"
                type="number"
                min="0"
                step="0.01"
                value={advanceAmount}
                onChange={(event) => setAdvanceAmount(event.target.value)}
                aria-label={t('compensationAdvance')}
              />
              <Button type="submit">{t('compensationGiveAdvance')}</Button>
            </form>
          ) : null}
          {view.remainingAmount > 0 ? (
            <Button
              variant="primary"
              onClick={() => {
                const result = payEmployeeCompensationRemainingForUser(
                  persistence,
                  currentUser,
                  user.id,
                )
                setError(result.ok ? null : t(result.error.code as TranslationKey))
                if (result.ok) {
                  showToast(t('compensationPaidDone'), 'success')
                }
              }}
            >
              {t('compensationPayRemaining')}
            </Button>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="form-error">{error}</p> : null}

      <h4>{t('compensationHistory')}</h4>
      {view.history.length === 0 ? (
        <EmptyState title={t('analyticsEmpty')} />
      ) : (
        <Table className="compensation-history">
          <tbody>
            {view.history.map((item) => (
              <tr key={item.id}>
                <td>
                  {new Date(`${item.paidAt}T00:00:00`).toLocaleDateString(numberLocale)}
                </td>
                <td>
                  {item.kind === 'advance'
                    ? t('compensationAdvance')
                    : t('compensationPayoutSalary')}
                </td>
                <td className="is-num">−{money(item.amount)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  )
}
