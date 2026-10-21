import { useAccess } from '../../context/access-context'
import { useBranches } from '../../context/branch-context'
import { useDepartments } from '../../context/department-context'
import { useLocalization } from '../../context/localization-context'
import { useUsers } from '../../context/user-context'
import { useWarehouses } from '../../context/warehouse-context'
import { userDisplayName } from '../../../modules/crm/users/user-name'
import { AuthRequiredState } from '../../components/AuthRequiredState'
import { canManageEmployees } from '../../../core/services'
import { PagePlaceholder } from '../../../shared/components/PagePlaceholder'
import { Table } from '../../../shared/ui'
import {
  accessLogFieldDisplay,
  accessLogValueDisplay,
} from '../../../modules/company/access-log-label'

export function CompanyAccessLogPage() {
  const { t, locale } = useLocalization()
  const { currentUser } = useAccess()
  const { accessChangeLogs, getUser } = useUsers()
  const { getBranch } = useBranches()
  const { getDepartment } = useDepartments()
  const { warehouses } = useWarehouses()
  const numberLocale = locale === 'kk' ? 'kk-KZ' : 'ru-RU'

  const resolveLogId = (id: string) => {
    const user = getUser(id)
    if (user) {
      return userDisplayName(user)
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

  if (!currentUser) {
    return <AuthRequiredState />
  }

  if (!canManageEmployees(currentUser)) {
    return (
      <PagePlaceholder title={t('ACCESS_DENIED')} description={t('ACCESS_DENIED')} />
    )
  }

  return (
    <section className="workspace-page">
      <div className="workspace-toolbar">
        <h2 className="workspace-toolbar__title">{t('navAccessLog')}</h2>
      </div>
      {accessChangeLogs.length === 0 ? (
        <p>{t('accessLogEmpty')}</p>
      ) : (
        <Table>
          <thead>
            <tr>
              <th>{t('movementDate')}</th>
              <th>{t('accessLogActor')}</th>
              <th>{t('accessLogTarget')}</th>
              <th>{t('accessLogField')}</th>
              <th>{t('accessLogPrevious')}</th>
              <th>{t('accessLogNext')}</th>
            </tr>
          </thead>
          <tbody>
            {accessChangeLogs.map((entry) => {
              const actor = getUser(entry.actorUserId)
              const target = entry.targetUserId
                ? getUser(entry.targetUserId)
                : undefined
              return (
                <tr key={entry.id}>
                  <td>{new Date(entry.createdAt).toLocaleString(numberLocale)}</td>
                  <td>{actor ? userDisplayName(actor) : '—'}</td>
                  <td>{target ? userDisplayName(target) : '—'}</td>
                  <td>{accessLogFieldDisplay(entry.field, t)}</td>
                  <td>{accessLogValueDisplay(entry.previousValue, t, resolveLogId)}</td>
                  <td>{accessLogValueDisplay(entry.nextValue, t, resolveLogId)}</td>
                </tr>
              )
            })}
          </tbody>
        </Table>
      )}
    </section>
  )
}
