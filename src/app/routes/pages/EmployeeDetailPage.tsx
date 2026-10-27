import { useEffect, useState } from 'react'
import { useAccess } from '../../context/access-context'
import { useLocalization } from '../../context/localization-context'
import { useOrganization } from '../../context/organization-context'
import { useUsers } from '../../context/user-context'
import { canAccessMotivationPlans, canManageEmployees, isUserAccountEnabled } from '../../../core/services'
import { EmployeeCard, type EmployeeTab } from '../../../modules/crm/users/EmployeeCard'
import { userDisplayName } from '../../../modules/crm/users/user-name'
import { AuthRequiredState } from '../../components/AuthRequiredState'
import { PagePlaceholder } from '../../../shared/components/PagePlaceholder'
import { ActionRow, Button, PageHeader, StatusBadge } from '../../../shared/ui'
import { USER_STATUS_LABEL_KEY } from '../../../modules/crm/users/employee-status-label'
import { USER_ROLE_LABEL_KEY } from '../../../modules/crm/users/user-role-label'
import { getEmployeeIdFromPath } from '../app.routes'
import { useAppPath } from '../useAppPath'

function tabFromSearch(search: string): EmployeeTab | undefined {
  const tab = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search).get(
    'tab',
  )
  if (
    tab === 'overview' ||
    tab === 'profile' ||
    tab === 'sales' ||
    tab === 'motivation' ||
    tab === 'access' ||
    tab === 'attendance' ||
    tab === 'compensation' ||
    tab === 'activity' ||
    tab === 'settings'
  ) {
    return tab === 'overview' ? 'profile' : tab
  }

  return undefined
}

export function EmployeeDetailPage() {
  const { t } = useLocalization()
  const { pathname, search, navigate } = useAppPath()
  const { currentUser } = useAccess()
  const { modules } = useOrganization()
  const { getUserAccess, setUserStatus } = useUsers()
  const [tab, setTab] = useState<EmployeeTab>(() => tabFromSearch(search) ?? 'profile')
  const employeeId = getEmployeeIdFromPath(pathname)

  useEffect(() => {
    const next = tabFromSearch(search)
    if (next) {
      setTab(next)
    }
  }, [search])

  if (!currentUser) {
    return <AuthRequiredState />
  }

  if (!employeeId) {
    return (
      <PagePlaceholder
        title={t('pageNotFound')}
        description={t('pageNotFoundDescription')}
      />
    )
  }

  const access = getUserAccess(employeeId)
  if (!access.ok) {
    if (access.code === 'USER_NOT_FOUND') {
      return (
        <PagePlaceholder
          title={t('pageNotFound')}
          description={t('pageNotFoundDescription')}
        />
      )
    }

    return (
      <PagePlaceholder title={t('ACCESS_DENIED')} description={t('ACCESS_DENIED')} />
    )
  }

  const user = access.user
  const canEdit = canManageEmployees(currentUser) && user.id !== currentUser.id
  const canEditSelfLimited = canManageEmployees(currentUser)

  return (
    <section className="workspace-page employee-detail-page">
      <PageHeader
        title={userDisplayName(user)}
        description={user.jobTitle ?? t(USER_ROLE_LABEL_KEY[user.role])}
        actions={
          <ActionRow>
          <Button onClick={() => navigate('/company/employees')}>{t('navEmployees')}</Button>
          {canAccessMotivationPlans(currentUser) && modules.plans === true ? (
            <Button onClick={() => navigate('/company/plans')}>{t('dashboardPlans')}</Button>
          ) : null}
          {canEditSelfLimited ? (
            <Button
              onClick={() => {
                setTab('settings')
              }}
            >
              {t('edit')}
            </Button>
          ) : null}
          {canEdit ? (
            <Button
              onClick={() => {
                setTab('access')
              }}
            >
              {t('employeeChangeAccess')}
            </Button>
          ) : null}
          {canEdit ? (
            <Button
              variant={user.status === 'active' ? 'danger' : 'secondary'}
              onClick={() => {
                if (user.status === 'active') {
                  if (!window.confirm(t('accessConfirmDisableUser'))) {
                    return
                  }
                  setUserStatus(user.id, 'disabled')
                  return
                }
                if (!window.confirm(t('accessConfirmEnableUser'))) {
                  return
                }
                setUserStatus(user.id, 'active')
              }}
            >
              {user.status === 'active' ? t('employeeDisable') : t('employeeEnable')}
            </Button>
          ) : null}
          </ActionRow>
        }
      />
      <div className="deal-detail__summary">
        <StatusBadge
          tone={
            user.status === 'active'
              ? 'success'
              : user.status === 'invited'
                ? 'info'
                : 'neutral'
          }
        >
          {t(USER_STATUS_LABEL_KEY[user.status])}
        </StatusBadge>
        <StatusBadge tone={isUserAccountEnabled(user) ? 'success' : 'neutral'}>
          {isUserAccountEnabled(user) ? t('employeeAccountYes') : t('employeeAccountNo')}
        </StatusBadge>
      </div>

      <EmployeeCard
        user={user}
        canEdit={canEditSelfLimited}
        lockPrivileges={user.id === currentUser.id}
        tab={tab}
        onTabChange={setTab}
      />
    </section>
  )
}
