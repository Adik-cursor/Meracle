import { useMemo, useState } from 'react'
import {
  canManageEmployees,
  currentMotivationPeriodKey,
  listOrganizationCompensationForUser,
} from '../../../core/services'
import type { TranslationKey } from '../../../core/localization/translations'
import { useAccess } from '../../context/access-context'
import { useLocalization } from '../../context/localization-context'
import { useOrganization } from '../../context/organization-context'
import { usePersistence, usePersistenceVersion } from '../../context/persistence-context'
import { useUsers } from '../../context/user-context'
import { formatMoney } from '../../../modules/sales/pos-format'
import { userDisplayName } from '../../../modules/crm/users/user-name'
import { useAppPath } from '../useAppPath'
import { Badge, Button, EmptyState, Input } from '../../../shared/ui'
import { WorkbookExportButton } from '../../../shared/components/WorkbookExportButton'
import { buildFinanceSalarySheet } from '../../../core/services'

function statusKey(
  status: 'none' | 'accrued' | 'partial' | 'paid',
): TranslationKey {
  if (status === 'accrued') return 'compensationStatusAccrued'
  if (status === 'partial') return 'compensationStatusPartial'
  if (status === 'paid') return 'compensationStatusPaid'
  return 'compensationStatusNone'
}

function statusTone(
  status: 'none' | 'accrued' | 'partial' | 'paid',
): 'neutral' | 'info' | 'warning' | 'success' {
  if (status === 'accrued') return 'info'
  if (status === 'partial') return 'warning'
  if (status === 'paid') return 'success'
  return 'neutral'
}

export function FinanceSalaryPage() {
  const { t, locale } = useLocalization()
  const { navigate } = useAppPath()
  const { currentUser } = useAccess()
  const { settings } = useOrganization()
  const { getUser } = useUsers()
  const persistence = usePersistence()
  const version = usePersistenceVersion()
  const [period, setPeriod] = useState(currentMotivationPeriodKey)
  const canOpen = canManageEmployees(currentUser)
  const rows = useMemo(() => {
    void version
    const listed = listOrganizationCompensationForUser(persistence, currentUser, period)
    return listed.ok ? listed.value : []
  }, [currentUser, period, persistence, version])

  const money = (value: number) => formatMoney(value, locale, settings.currency)

  return (
    <div className="finance-panel">
      <header className="finance-panel__intro">
        <h3>{t('financeTabSalary')}</h3>
        <label className="finance-period-control">
          <span>{t('employeeKpiPeriod')}</span>
          <Input type="month" value={period} onChange={(event) => setPeriod(event.target.value)} />
        </label>
        <WorkbookExportButton
          filename={`finance-salary-${period}.xlsx`}
          sheets={[
            buildFinanceSalarySheet(rows, (userId) => {
              const employee = getUser(userId)
              return employee ? userDisplayName(employee) : userId
            }),
          ]}
        />
      </header>
      {rows.length === 0 ? (
        <EmptyState title={t('analyticsEmpty')} />
      ) : (
        <div className="table-wrap">
          <table className="data-table finance-salary-table">
            <thead>
              <tr>
                <th>{t('employeeFullName')}</th>
                <th className="is-num">{t('employeeSalary')}</th>
                <th className="is-num">{t('employeeBonus')}</th>
                <th className="is-num">{t('compensationAccrued')}</th>
                <th className="is-num">{t('compensationAdvance')}</th>
                <th className="is-num">{t('compensationPaid')}</th>
                <th className="is-num">{t('compensationRemaining')}</th>
                <th>{t('status')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const employee = getUser(row.employeeUserId)
                return (
                  <tr key={row.employeeUserId}>
                    <td>{employee ? userDisplayName(employee) : row.employeeUserId}</td>
                    <td className="is-num">{money(row.salaryAmount)}</td>
                    <td className="is-num">{money(row.bonusAmount)}</td>
                    <td className="is-num">{money(row.accruedAmount)}</td>
                    <td className="is-num">{money(row.advanceAmount)}</td>
                    <td className="is-num">{money(row.paidAmount)}</td>
                    <td className="is-num">{money(row.remainingAmount)}</td>
                    <td>
                      <Badge tone={statusTone(row.status)}>{t(statusKey(row.status))}</Badge>
                    </td>
                    <td>
                      {canOpen ? (
                        <Button
                          variant="ghost"
                          onClick={() =>
                            navigate(
                              `/company/employees/${row.employeeUserId}?tab=compensation`,
                            )
                          }
                        >
                          {t('compensationTitle')}
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
