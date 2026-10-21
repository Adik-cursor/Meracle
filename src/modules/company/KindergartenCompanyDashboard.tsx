import { useMemo } from 'react'
import { useAuth } from '../../app/context/auth-context'
import { useCare } from '../../app/context/care-context'
import { useDeals } from '../../app/context/deal-context'
import { useExpenses } from '../../app/context/expense-context'
import { useLocalization } from '../../app/context/localization-context'
import { useOrganization } from '../../app/context/organization-context'
import { usePersistence, usePersistenceVersion } from '../../app/context/persistence-context'
import { AuthRequiredState } from '../../app/components/AuthRequiredState'
import { useAppPath } from '../../app/routes/useAppPath'
import { getDefaultCrmPath } from '../../app/routes/app.routes'
import { getCompanyDashboardForUser, todayExpenseDateInput, childOccupiesPlace, type CareDashboardView } from '../../core/services'
import {
  EXPENSE_CATEGORIES,
  type DealStatus,
  type ExpenseCategory,
} from '../../core/types'
import type { TranslationKey } from '../../core/localization/translations'
import { formatMoney } from '../sales/pos-format'
import { Button } from '../../shared/ui'

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

function dealStatusKey(status: DealStatus): TranslationKey {
  if (status === 'in_progress') return 'careDealStatusInProgress'
  if (status === 'won') return 'careDealStatusWon'
  if (status === 'lost') return 'careDealStatusLost'
  return 'careDealStatusNew'
}

function formatDay(iso: string, locale: 'ru' | 'kk', timeZone?: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString(locale === 'kk' ? 'kk-KZ' : 'ru-RU', {
    timeZone: timeZone || undefined,
    day: '2-digit',
    month: '2-digit',
  })
}

function occupancyTone(percent: number, full: boolean): string {
  if (full || percent >= 100) return 'danger'
  if (percent >= 90) return 'warn'
  return 'ok'
}

function sameMonth(date: string, today: string): boolean {
  return date.slice(0, 7) === today.slice(0, 7)
}

export function KindergartenDashboardSections({ care }: { care: CareDashboardView }) {
  const { t, locale } = useLocalization()
  const { navigate } = useAppPath()
  const { settings, modules } = useOrganization()
  const { groups, childrenList, listAttendance } = useCare()
  const { expenses } = useExpenses()
  const { deals } = useDeals()
  const crmPath = getDefaultCrmPath(modules) ?? '/deals'
  const today = todayExpenseDateInput()
  const todayRecords = listAttendance(today)
  const absentByGroup = useMemo(() => {
    const byChild = new Map(todayRecords.map((item) => [item.childId, item.status]))
    const counts = new Map<string, number>()
    for (const child of childrenList) {
      if (!childOccupiesPlace(child) || !child.groupId) continue
      if (byChild.get(child.id) !== 'absent') continue
      counts.set(child.groupId, (counts.get(child.groupId) ?? 0) + 1)
    }
    return counts
  }, [childrenList, todayRecords])

  const expenseBreakdown = useMemo(() => {
    const monthExpenses = expenses.filter((expense) => sameMonth(expense.date, today))
    return EXPENSE_CATEGORIES.map((item) => ({
      item,
      amount: monthExpenses
        .filter((expense) => expense.category === item)
        .reduce((sum, expense) => sum + expense.amount, 0),
    })).filter((row) => row.amount > 0)
  }, [expenses, today])

  const money = (value: number) => formatMoney(value, locale, settings.currency)
  const showFinance =
    care.childrenIncluded && (care.expensesIncluded || care.paymentsIncluded)
  const childValue = (value: number) => (care.attendanceIncluded ? value : t('careNoData'))
  const staffValue = (value: number) => (care.attendanceIncluded ? value : t('careNoData'))
  const paidAmount = care.paymentsIncluded ? care.paidAmount : care.expensesIncluded ? 0 : undefined
  const netAmount = care.paymentsIncluded
    ? care.netResult
    : care.expensesIncluded
      ? -care.expenses
      : undefined

  const showToday =
    care.childrenIncluded || care.attendanceIncluded || care.applicationsIncluded

  const attention: { id: string; label: string; href: string }[] = []
  if (care.attendanceIncluded && care.unmarked > 0) {
    attention.push({
      id: 'unmarked',
      label: t('careAttentionUnmarked').replace('{count}', String(care.unmarked)),
      href: '/attendance',
    })
  }
  if (care.attendanceIncluded && care.absent > 0) {
    attention.push({
      id: 'absent',
      label: t('careAttentionAbsentChildren').replace('{count}', String(care.absent)),
      href: '/attendance',
    })
  }
  if (care.applicationsIncluded && care.newApplications > 0) {
    attention.push({
      id: 'apps',
      label: t('careAttentionApplications').replace('{count}', String(care.newApplications)),
      href: crmPath,
    })
  }
  for (const group of care.groups.filter((item) => item.occupancyPercent >= 90)) {
    attention.push({
      id: `full-${group.id}`,
      label: t('careAttentionGroupFull').replace('{name}', group.name),
      href: '/children',
    })
  }
  if (care.debtsIncluded && care.debtors > 0) {
    attention.push({
      id: 'debts',
      label: t('careAttentionDebtors').replace('{count}', String(care.debtors)),
      href: '/company/debts',
    })
  }
  if (care.debtsIncluded && care.overdueAmount > 0) {
    attention.push({
      id: 'overdue',
      label: t('careAttentionOverdue'),
      href: '/company/debts',
    })
  }

  return (
    <div className="care-dashboard dash-grid dash-span-12">
      {showToday ? (
      <article className="care-dashboard__today dash-span-12">
        <h3 className="care-dashboard__section-title">{t('careToday')}</h3>
        <div className="care-dashboard__today-grid">
          {care.childrenIncluded ? (
            <>
          <div>
            <p className="care-dashboard__label">{t('careChildrenPresent')}</p>
            <p className="care-dashboard__value care-dashboard__value--sm">{childValue(care.present)}</p>
            <p className="care-dashboard__muted">
              {t('careOfEnrolled').replace('{count}', String(care.enrolled))}
            </p>
          </div>
          <div>
            <p className="care-dashboard__label">{t('careChildrenAbsent')}</p>
            <p className="care-dashboard__value care-dashboard__value--sm">{childValue(care.absent)}</p>
          </div>
            </>
          ) : null}
          {care.applicationsIncluded ? (
            <div>
              <p className="care-dashboard__label">{t('careNewApplications')}</p>
              <p className="care-dashboard__value care-dashboard__value--sm">{care.newApplicationsToday}</p>
            </div>
          ) : null}
          {care.childrenIncluded ? (
            <div className="care-dashboard__anchor">
              <p className="care-dashboard__label">{t('careFreePlaces')}</p>
              <p className="care-dashboard__value">{care.freePlaces}</p>
            </div>
          ) : null}
          {care.attendanceIncluded ? (
            <>
              <div>
                <p className="care-dashboard__label">{t('careStaffOnWork')}</p>
                <p className="care-dashboard__value care-dashboard__value--sm">{staffValue(care.staffPresent)}</p>
              </div>
              <div>
                <p className="care-dashboard__label">{t('careStaffAbsent')}</p>
                <p className="care-dashboard__value care-dashboard__value--sm">{staffValue(care.staffAbsent)}</p>
              </div>
              <div>
                <p className="care-dashboard__label">{t('careStaffUnmarked')}</p>
                <p className="care-dashboard__value care-dashboard__value--sm">{staffValue(care.staffUnmarked)}</p>
              </div>
            </>
          ) : null}
        </div>
      </article>
      ) : null}

      {care.childrenIncluded ? (
        <article className="care-dashboard__groups dash-span-6">
          <div className="care-dashboard__section-head">
            <h3 className="care-dashboard__section-title">{t('careGroups')}</h3>
            <Button variant="ghost" onClick={() => navigate('/children')}>
              {t('dashboardOpenAction')}
            </Button>
          </div>
          {care.groups.length === 0 ? (
            <div>
              <p className="care-dashboard__empty">{t('careGroupsEmpty')}</p>
              <p className="care-dashboard__muted">{t('careGroupsEmptyHint')}</p>
              <Button onClick={() => navigate('/children')}>{t('careQuickCreateGroup')}</Button>
            </div>
          ) : (
            <ul className="care-dashboard__group-list">
              {care.groups.map((group) => {
                const live = groups.find((item) => item.id === group.id)
                const capacity = live?.capacity ?? group.capacity
                const absentToday = absentByGroup.get(group.id) ?? 0
                return (
                  <li key={group.id}>
                    <button
                      type="button"
                      className="care-dashboard__group-row"
                      onClick={() => navigate('/children')}
                    >
                      <span>
                        {group.name}
                        <small>
                          {group.childCount} / {capacity} · {group.occupancyPercent}%
                          {care.attendanceIncluded
                            ? ` · ${t('careGroupAbsent')}: ${absentToday}`
                            : ''}
                        </small>
                      </span>
                    </button>
                    <div
                      className="care-dashboard__occupancy"
                      data-tone={occupancyTone(group.occupancyPercent, group.full)}
                    >
                      <span style={{ width: `${Math.max(0, Math.min(100, group.occupancyPercent))}%` }} />
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </article>
      ) : null}

      {showFinance ? (
        <article className="care-dashboard__finance dash-span-6">
          <div className="care-dashboard__section-head">
            <h3 className="care-dashboard__section-title">{t('careFinance')}</h3>
            {care.expensesIncluded || care.paymentsIncluded ? (
              <Button variant="ghost" onClick={() => navigate('/finance')}>
                {t('dashboardOpenAction')}
              </Button>
            ) : null}
          </div>
          <div className="care-dashboard__finance-lines">
            <div>
              <span>{t('carePaid')}</span>
              <strong>{paidAmount === undefined ? t('careNoData') : money(paidAmount)}</strong>
            </div>
            {care.expensesIncluded ? (
              <div>
                <span>{t('careExpenses')}</span>
                <strong>{money(care.expenses)}</strong>
              </div>
            ) : null}
            <div>
              <span>{t('careNetResult')}</span>
              <strong>{netAmount === undefined ? t('careNoData') : money(netAmount)}</strong>
            </div>
          </div>
          {expenseBreakdown.length > 0 ? (
            <ul className="care-dashboard__cats">
              {expenseBreakdown.map((row) => (
                <li key={row.item}>
                  <span>{t(EXPENSE_LABEL[row.item])}</span>
                  <span>{money(row.amount)}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </article>
      ) : null}

      {care.attendanceIncluded ? (
        <article className="care-dashboard__attendance dash-span-6">
          <div className="care-dashboard__section-head">
            <h3 className="care-dashboard__section-title">{t('careChildAttendance')}</h3>
            <Button variant="ghost" onClick={() => navigate('/attendance')}>
              {t('dashboardOpenAction')}
            </Button>
          </div>
          <div className="care-dashboard__finance-row">
            <div>
              <p className="care-dashboard__label">{t('careAttendancePresent')}</p>
              <p className="care-dashboard__value care-dashboard__value--sm">{care.present}</p>
            </div>
            <div>
              <p className="care-dashboard__label">{t('careAttendanceAbsent')}</p>
              <p className="care-dashboard__value care-dashboard__value--sm">{care.absent}</p>
            </div>
            <div>
              <p className="care-dashboard__label">{t('careAttendanceUnmarked')}</p>
              <p className="care-dashboard__value care-dashboard__value--sm">{care.unmarked}</p>
            </div>
          </div>
          <p className="care-dashboard__muted">
            {t('careAttendanceRate')}: {care.attendancePercent}%
          </p>
        </article>
      ) : null}

      {care.attendanceIncluded ? (
        <article className="care-dashboard__staff dash-span-6">
          <div className="care-dashboard__section-head">
            <h3 className="care-dashboard__section-title">{t('careStaffAttendance')}</h3>
            <Button variant="ghost" onClick={() => navigate('/attendance')}>
              {t('dashboardOpenAction')}
            </Button>
          </div>
          <div className="care-dashboard__finance-row">
            <div>
              <p className="care-dashboard__label">{t('careAttendancePresent')}</p>
              <p className="care-dashboard__value care-dashboard__value--sm">{staffValue(care.staffPresent)}</p>
            </div>
            <div>
              <p className="care-dashboard__label">{t('careAttendanceAbsent')}</p>
              <p className="care-dashboard__value care-dashboard__value--sm">{staffValue(care.staffAbsent)}</p>
            </div>
            <div>
              <p className="care-dashboard__label">{t('careAttendanceUnmarked')}</p>
              <p className="care-dashboard__value care-dashboard__value--sm">{staffValue(care.staffUnmarked)}</p>
            </div>
          </div>
          <p className="care-dashboard__muted">
            {t('careAttendanceRate')}: {care.staffAttendancePercent}%
          </p>
        </article>
      ) : null}

      <article className="care-dashboard__attention dash-span-6" data-state={attention.length > 0 ? 'warn' : 'ok'}>
        <h3 className="care-dashboard__section-title">{t('careAttention')}</h3>
        {attention.length === 0 ? (
          <p className="care-dashboard__ok">{t('careAllGood')}</p>
        ) : (
          <ul className="care-dashboard__attention-list">
            {attention.map((item) => (
              <li key={item.id}>
                <button type="button" onClick={() => navigate(item.href)}>
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </article>

      {care.applicationsIncluded ? (
        <article className="care-dashboard__applications dash-span-6">
          <div className="care-dashboard__section-head">
            <h3 className="care-dashboard__section-title">{t('careLastApplications')}</h3>
            <Button variant="ghost" onClick={() => navigate(crmPath)}>
              {t('dashboardOpenAction')}
            </Button>
          </div>
          {care.applications.length === 0 ? (
            <p className="care-dashboard__empty">{t('careApplicationsEmpty')}</p>
          ) : (
            <ul className="care-dashboard__feed">
              {care.applications.map((item) => {
                const deal = deals.find((entry) => entry.id === item.id)
                const amount =
                  deal && deal.amount !== null && Number.isFinite(deal.amount)
                    ? money(deal.amount)
                    : null
                return (
                  <li key={item.id}>
                    <button type="button" onClick={() => navigate(`/deals/${item.id}`)}>
                      <span className="care-dashboard__feed-title">{item.title}</span>
                      <span className="care-dashboard__muted">
                        {item.phone || '—'} · {formatDay(item.createdAt, locale, settings.timezone)}
                        {amount ? ` · ${amount}` : ''}
                      </span>
                      <span className={`care-dashboard__status care-dashboard__status--${item.status}`}>
                        {t(dealStatusKey(item.status))}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </article>
      ) : null}
    </div>
  )
}

export function KindergartenCompanyDashboard() {
  const { t } = useLocalization()
  const { currentUser } = useAuth()
  const { organization } = useOrganization()
  const persistence = usePersistence()
  const version = usePersistenceVersion()
  const dashboard = useMemo(() => {
    void version
    return getCompanyDashboardForUser(persistence, currentUser)
  }, [currentUser, persistence, version])

  if (!currentUser) return <AuthRequiredState />
  if (!dashboard.ok || !dashboard.value.care) return <AuthRequiredState />

  return (
    <section className="workspace-page care-dashboard dash-grid">
      <header className="care-dashboard__header dash-span-12">
        <div>
          <h2 className="care-dashboard__title">{organization.name}</h2>
          <p className="care-dashboard__meta">{t('dashboardPeriodMonth')}</p>
        </div>
      </header>
      <KindergartenDashboardSections care={dashboard.value.care} />
    </section>
  )
}
