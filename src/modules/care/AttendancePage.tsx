import { useMemo, useState } from 'react'
import { useAccess } from '../../app/context/access-context'
import { useCare } from '../../app/context/care-context'
import { useLocalization } from '../../app/context/localization-context'
import { useOrganization } from '../../app/context/organization-context'
import { AuthRequiredState } from '../../app/components/AuthRequiredState'
import { useAppPath } from '../../app/routes/useAppPath'
import {
  childDisplayName,
  childOccupiesPlace,
  employeeWorkDayState,
  formatAttendanceClockTime,
  isChildAttendance,
  isEmployeeAttendance,
  todayExpenseDateInput,
  type AttendanceWrite,
} from '../../core/services'
import type { AttendanceStatus, Child, User } from '../../core/types'
import type { TranslationKey } from '../../core/localization/translations'
import { Button, Input, Modal, Select } from '../../shared/ui'
import { userDisplayName } from '../crm/users/user-name'
import { USER_ROLE_LABEL_KEY } from '../crm/users/user-role-label'

type AttendanceScope = 'children' | 'staff'
type AttendanceMarkStatus = AttendanceStatus | undefined

function shiftDate(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00`)
  date.setDate(date.getDate() + days)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatDayLabel(iso: string, locale: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(locale === 'kk' ? 'kk-KZ' : 'ru-RU', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
  })
}

function tallyStatuses(statuses: AttendanceMarkStatus[]): {
  present: number
  absent: number
  unmarked: number
} {
  return {
    present: statuses.filter((status) => status === 'present').length,
    absent: statuses.filter((status) => status === 'absent').length,
    unmarked: statuses.filter((status) => status !== 'present' && status !== 'absent').length,
  }
}

function MarkButtons({
  status,
  disabled,
  presentLabel,
  absentLabel,
  unmarkedLabel,
  onMark,
}: {
  status: AttendanceMarkStatus
  disabled: boolean
  presentLabel: string
  absentLabel: string
  unmarkedLabel: string
  onMark: (status: AttendanceWrite['status']) => void
}) {
  return (
    <div className="care-mark">
      <button
        type="button"
        className={status === 'present' ? 'is-present' : ''}
        disabled={disabled}
        onClick={() => onMark('present')}
      >
        {presentLabel}
      </button>
      <button
        type="button"
        className={status === 'absent' ? 'is-absent' : ''}
        disabled={disabled}
        onClick={() => onMark('absent')}
      >
        {absentLabel}
      </button>
      <button
        type="button"
        className={!status ? 'is-unmarked' : ''}
        disabled={disabled}
        onClick={() => onMark('unmarked')}
      >
        {unmarkedLabel}
      </button>
    </div>
  )
}

export function AttendancePage() {
  const { t, locale } = useLocalization()
  const { search } = useAppPath()
  const { currentUser, hasCareAccess } = useAccess()
  const { modules } = useOrganization()
  const {
    groups,
    childrenList,
    employees,
    listAttendance,
    markAttendance,
    markAttendanceBatch,
    checkInSelf,
    checkOutSelf,
    checkInEmployee,
    checkOutEmployee,
  } = useCare()
  const params = new URLSearchParams(search)
  const childrenEnabled = modules.children === true
  const [date, setDate] = useState(todayExpenseDateInput)
  const [scope, setScope] = useState<AttendanceScope>(
    !childrenEnabled || params.get('tab') === 'staff' ? 'staff' : 'children',
  )
  const [groupId, setGroupId] = useState(() => params.get('group') ?? '')
  const [query, setQuery] = useState('')
  const [jobFilter, setJobFilter] = useState('')
  const [bulkStatus, setBulkStatus] = useState<AttendanceStatus | null>(null)
  const [error, setError] = useState<TranslationKey | null>(null)

  const records = listAttendance(date)
  const byChild = useMemo(
    () =>
      new Map(
        records.filter(isChildAttendance).map((item) => [item.childId as string, item.status]),
      ),
    [records],
  )
  const byEmployee = useMemo(
    () =>
      new Map(
        records
          .filter(isEmployeeAttendance)
          .map((item) => [item.employeeId as string, item]),
      ),
    [records],
  )
  const canManage = hasCareAccess('attendance.manage')
  const canSelf = hasCareAccess('attendance.self') || canManage
  const isToday = date === todayExpenseDateInput()
  const visibleGroups = groups.filter((group) => group.status === 'active')
  const needle = query.trim().toLowerCase()

  const occupyingChildren = childrenList.filter(
    (child) => childOccupiesPlace(child) && child.groupId,
  )
  const groupChildren = occupyingChildren.filter(
    (child) => !groupId || child.groupId === groupId,
  )
  const visibleChildren = groupChildren.filter((child) => {
    if (!needle) {
      return true
    }
    return childDisplayName(child).toLowerCase().includes(needle)
  })

  const grouped = visibleGroups
    .filter((group) => !groupId || group.id === groupId)
    .map((group) => ({
      group,
      children: visibleChildren.filter((child) => child.groupId === group.id),
    }))
    .filter((item) => item.children.length > 0 || (!needle && Boolean(groupId)))

  const childTally = tallyStatuses(visibleChildren.map((child) => byChild.get(child.id)))

  const jobOptions = useMemo(() => {
    const labels = new Set<string>()
    for (const employee of employees) {
      labels.add(employee.jobTitle?.trim() || t(USER_ROLE_LABEL_KEY[employee.role]))
    }
    return [...labels].sort((left, right) => left.localeCompare(right, 'ru'))
  }, [employees, t])

  const visibleEmployees = employees.filter((employee) => {
    const job = employee.jobTitle?.trim() || t(USER_ROLE_LABEL_KEY[employee.role])
    if (jobFilter && job !== jobFilter) {
      return false
    }
    if (!needle) {
      return true
    }
    return userDisplayName(employee).toLowerCase().includes(needle)
  })
  const staffTally = {
    working: visibleEmployees.filter(
      (employee) => employeeWorkDayState(byEmployee.get(employee.id)) === 'working',
    ).length,
    completed: visibleEmployees.filter(
      (employee) => employeeWorkDayState(byEmployee.get(employee.id)) === 'completed',
    ).length,
    unmarked: visibleEmployees.filter(
      (employee) => employeeWorkDayState(byEmployee.get(employee.id)) === 'unmarked',
    ).length,
  }

  if (!currentUser) {
    return <AuthRequiredState />
  }

  const applyClock = (result: { ok: boolean; error?: { code: string } }) => {
    setError(result.ok ? null : (result.error?.code as TranslationKey))
  }

  const applyMark = (input: AttendanceWrite) => {
    const result = markAttendance(input)
    setError(result.ok ? null : (result.error.code as TranslationKey))
  }

  const clockEmployee = (employee: User, state: ReturnType<typeof employeeWorkDayState>) => {
    const isSelf = employee.id === currentUser?.id
    if (isSelf) {
      applyClock(state === 'unmarked' ? checkInSelf() : checkOutSelf())
      return
    }
    applyClock(
      state === 'unmarked' ? checkInEmployee(employee.id) : checkOutEmployee(employee.id),
    )
  }

  const confirmBulk = () => {
    if (!bulkStatus) {
      return
    }
    const items: AttendanceWrite[] =
      scope === 'children'
        ? visibleChildren.map((child) => ({
            childId: child.id,
            date,
            status: bulkStatus,
          }))
        : []
    const result = markAttendanceBatch(items)
    setError(result.ok ? null : (result.error.code as TranslationKey))
    if (result.ok) {
      setBulkStatus(null)
    }
  }

  const markedLabel = (marked: number, total: number) =>
    t('careMarkedOfTotal')
      .replace('{marked}', String(marked))
      .replace('{total}', String(total))

  return (
    <section className="workspace-page care-page care-attendance-page">
      <header className="care-page__header">
        <div>
          <h2 className="care-page__title">{t('navAttendance')}</h2>
          <p className="care-page__meta">{t('careAttendanceHint')}</p>
        </div>
      </header>

      <div className="care-attendance-date">
        <Button aria-label={t('carePrevDay')} onClick={() => setDate(shiftDate(date, -1))}>
          ←
        </Button>
        <Button
          variant={date === todayExpenseDateInput() ? 'primary' : 'secondary'}
          onClick={() => setDate(todayExpenseDateInput())}
        >
          {t('careToday')}
        </Button>
        <Button aria-label={t('careNextDay')} onClick={() => setDate(shiftDate(date, 1))}>
          →
        </Button>
        <time dateTime={date}>{formatDayLabel(date, locale)}</time>
        <input
          className="select"
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />
      </div>

      {childrenEnabled ? (
        <div className="care-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={scope === 'children'}
            className={
              scope === 'children' ? 'care-tabs__btn care-tabs__btn--active' : 'care-tabs__btn'
            }
            onClick={() => setScope('children')}
          >
            {t('careAttendanceChildrenTab')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={scope === 'staff'}
            className={scope === 'staff' ? 'care-tabs__btn care-tabs__btn--active' : 'care-tabs__btn'}
            onClick={() => setScope('staff')}
          >
            {t('careAttendanceStaffTab')}
          </button>
        </div>
      ) : null}

      <div className="care-filters care-filters--attendance">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={scope === 'children' ? t('careSearchChild') : t('careSearchEmployee')}
        />
        {scope === 'children' ? (
          <Select value={groupId} onChange={(event) => setGroupId(event.target.value)}>
            <option value="">{t('careAllGroups')}</option>
            {visibleGroups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </Select>
        ) : (
          <Select value={jobFilter} onChange={(event) => setJobFilter(event.target.value)}>
            <option value="">{t('careAllEmployees')}</option>
            {jobOptions.map((job) => (
              <option key={job} value={job}>
                {job}
              </option>
            ))}
          </Select>
        )}
      </div>

      {scope === 'children' ? (
        <div className="care-attendance-summary">
          <article>
            <p className="care-dashboard__label">{t('careAttendancePresent')}</p>
            <p className="care-dashboard__value care-dashboard__value--sm">{childTally.present}</p>
          </article>
          <article>
            <p className="care-dashboard__label">{t('careAttendanceAbsent')}</p>
            <p className="care-dashboard__value care-dashboard__value--sm">{childTally.absent}</p>
          </article>
          <article>
            <p className="care-dashboard__label">{t('careAttendanceUnmarked')}</p>
            <p className="care-dashboard__value care-dashboard__value--sm">{childTally.unmarked}</p>
          </article>
        </div>
      ) : (
        <div className="care-attendance-summary care-attendance-summary--staff">
          <article>
            <p className="care-dashboard__label">{t('careStaffHeadcount')}</p>
            <p className="care-dashboard__value care-dashboard__value--sm">
              {visibleEmployees.length}
            </p>
          </article>
          <article>
            <p className="care-dashboard__label">{t('attendanceWorking')}</p>
            <p className="care-dashboard__value care-dashboard__value--sm">{staffTally.working}</p>
          </article>
          <article>
            <p className="care-dashboard__label">{t('attendanceDayDone')}</p>
            <p className="care-dashboard__value care-dashboard__value--sm">{staffTally.completed}</p>
          </article>
          <article>
            <p className="care-dashboard__label">{t('careAttendanceUnmarked')}</p>
            <p className="care-dashboard__value care-dashboard__value--sm">{staffTally.unmarked}</p>
          </article>
        </div>
      )}

      {canManage && scope === 'children' && visibleChildren.length > 0 ? (
        <div className="care-attendance-toolbar">
          <Button onClick={() => setBulkStatus('present')}>{t('careMarkAllPresent')}</Button>
          <Button onClick={() => setBulkStatus('absent')}>{t('careMarkAllAbsent')}</Button>
        </div>
      ) : null}

      {error ? <p className="field__error">{t(error)}</p> : null}

      {scope === 'children' ? (
        occupyingChildren.length === 0 || (groupId && groupChildren.length === 0) ? (
          <p className="care-dashboard__empty">
            {groupId ? t('careNoChildrenInGroup') : t('careAttendanceNoChildren')}
          </p>
        ) : grouped.length === 0 ? (
          <p className="care-dashboard__empty">{t('careAttendanceNoChildren')}</p>
        ) : (
          grouped.map(({ group, children }) => {
            const marked = children.filter((child) => byChild.get(child.id)).length
            return (
              <article key={group.id} className="care-attendance-group">
                <header>
                  <h3>{group.name}</h3>
                  <p>{markedLabel(marked, children.length)}</p>
                </header>
                {children.length === 0 ? (
                  <p className="care-dashboard__empty">{t('careNoChildrenInGroup')}</p>
                ) : (
                  <ul>
                    {children.map((child: Child) => (
                      <li key={child.id}>
                        <div className="care-attendance-person">
                          <strong>{childDisplayName(child)}</strong>
                        </div>
                        <MarkButtons
                          status={byChild.get(child.id)}
                          disabled={!canManage}
                          presentLabel={t('carePresent')}
                          absentLabel={t('careAbsent')}
                          unmarkedLabel={t('careUnmarked')}
                          onMark={(status) => applyMark({ childId: child.id, date, status })}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            )
          })
        )
      ) : employees.length === 0 ? (
        <p className="care-dashboard__empty">{t('careNoEmployeesYet')}</p>
      ) : visibleEmployees.length === 0 ? (
        <p className="care-dashboard__empty">{t('careAttendanceNoEmployees')}</p>
      ) : (
        <article className="care-attendance-group">
          <header>
            <h3>{t('careStaffAttendance')}</h3>
            <p>
              {markedLabel(
                visibleEmployees.filter(
                  (employee) => employeeWorkDayState(byEmployee.get(employee.id)) !== 'unmarked',
                ).length,
                visibleEmployees.length,
              )}
            </p>
          </header>
          <ul>
            {visibleEmployees.map((employee: User) => {
              const job = employee.jobTitle?.trim() || t(USER_ROLE_LABEL_KEY[employee.role])
              const record = byEmployee.get(employee.id)
              const state = employeeWorkDayState(record)
              const isSelf = employee.id === currentUser.id
              const canAct =
                isToday &&
                state !== 'completed' &&
                (isSelf ? canSelf : canManage)
              const statusLabel =
                state === 'working'
                  ? t('attendanceWorking')
                  : state === 'completed'
                    ? t('attendanceDayDone')
                    : t('careUnmarked')
              return (
                <li key={employee.id}>
                  <div className="care-attendance-person">
                    <strong>{userDisplayName(employee)}</strong>
                    <small>{job}</small>
                    <small>
                      {t('attendanceCheckIn')}:{' '}
                      {record?.checkInAt
                        ? formatAttendanceClockTime(record.checkInAt, locale)
                        : '—'}
                    </small>
                    <small>
                      {t('attendanceCheckOut')}:{' '}
                      {record?.checkOutAt
                        ? formatAttendanceClockTime(record.checkOutAt, locale)
                        : '—'}
                    </small>
                    <small>{statusLabel}</small>
                  </div>
                  {canAct ? (
                    <Button
                      variant="primary"
                      onClick={() => clockEmployee(employee, state)}
                    >
                      {state === 'unmarked'
                        ? isSelf
                          ? t('attendanceStartDay')
                          : t('attendanceMarkArrival')
                        : isSelf
                          ? t('attendanceEndDay')
                          : t('attendanceMarkDeparture')}
                    </Button>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </article>
      )}

      {bulkStatus ? (
        <Modal
          title={
            bulkStatus === 'present' ? t('careMarkAllPresent') : t('careMarkAllAbsent')
          }
          onClose={() => setBulkStatus(null)}
        >
          <p>
            {bulkStatus === 'present'
              ? t('careConfirmBulkPresent')
              : t('careConfirmBulkAbsent')}
          </p>
          <div className="care-form__actions">
            <Button onClick={() => setBulkStatus(null)}>{t('cancel')}</Button>
            <Button variant="primary" onClick={confirmBulk}>
              {t('careContinue')}
            </Button>
          </div>
        </Modal>
      ) : null}
    </section>
  )
}
