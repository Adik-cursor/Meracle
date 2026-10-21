import type { User } from '../../../core/types'
import { useLocalization } from '../../../app/context/localization-context'
import { useBranches } from '../../../app/context/branch-context'
import { useDepartments } from '../../../app/context/department-context'
import { useUsers } from '../../../app/context/user-context'
import { useWarehouses } from '../../../app/context/warehouse-context'
import {
  accessLogFieldDisplay,
  accessLogValueDisplay,
} from '../../company/access-log-label'
import { userDisplayName } from './user-name'

type EmployeeActivityPanelProps = {
  user: User
}

export function EmployeeActivityPanel({ user }: EmployeeActivityPanelProps) {
  const { t, locale } = useLocalization()
  const { getUser, accessChangeLogs } = useUsers()
  const { getBranch } = useBranches()
  const { getDepartment } = useDepartments()
  const { warehouses } = useWarehouses()
  const numberLocale = locale === 'kk' ? 'kk-KZ' : 'ru-RU'
  const logs = accessChangeLogs.filter((entry) => entry.targetUserId === user.id)

  const resolveLogId = (id: string) => {
    const named = getUser(id)
    if (named) {
      return userDisplayName(named)
    }
    const branch = getBranch(id)
    if (branch) {
      return branch.name
    }
    const department = getDepartment(id)
    if (department) {
      return department.name
    }
    return warehouses.find((warehouse) => warehouse.id === id)?.name
  }

  return (
    <div className="settings-section">
      <h3>{t('employeeTabActivity')}</h3>
      <p>
        {t('employeeLastLogin')}:{' '}
        {user.lastLoginAt
          ? new Date(user.lastLoginAt).toLocaleString(numberLocale)
          : t('neverLoggedIn')}
      </p>
      {logs.length === 0 ? (
        <p className="workspace-muted">—</p>
      ) : (
        <ul className="employee-activity-list">
          {logs.map((entry) => {
            const actor = getUser(entry.actorUserId)
            return (
              <li key={entry.id}>
                <strong>{actor ? userDisplayName(actor) : '—'}</strong>
                {' → '}
                {accessLogFieldDisplay(entry.field, t)}
                {': '}
                {accessLogValueDisplay(entry.previousValue, t, resolveLogId)}
                {' → '}
                {accessLogValueDisplay(entry.nextValue, t, resolveLogId)}
                {' · '}
                {new Date(entry.createdAt).toLocaleString(numberLocale)}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
