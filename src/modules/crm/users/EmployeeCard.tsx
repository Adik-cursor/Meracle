import { useState } from 'react'
import type { User } from '../../../core/types'
import { useLocalization } from '../../../app/context/localization-context'
import { useAccess } from '../../../app/context/access-context'
import { useOrganization } from '../../../app/context/organization-context'
import { useUsers } from '../../../app/context/user-context'
import { EmployeeAccessPanel } from '../../company/EmployeeAccessPanel'
import { EmployeeOverview } from './EmployeeOverview'
import { EmployeeSalesPanel } from './EmployeeSalesPanel'
import { EmployeeMotivationPanel } from './EmployeeMotivationPanel'
import { EmployeeActivityPanel } from './EmployeeActivityPanel'
import { EmployeeAttendancePanel } from './EmployeeAttendancePanel'
import { EmployeeCompensationPanel } from './EmployeeCompensationPanel'
import { UserForm } from './UserForm'
import { Button } from '../../../shared/ui'
import { canManageEmployees, isUserAccountEnabled } from '../../../core/services'

type EmployeeCardProps = {
  user: User
  canEdit?: boolean
  lockPrivileges?: boolean
  tab?: EmployeeTab
  onTabChange?: (tab: EmployeeTab) => void
}

export type EmployeeTab =
  | 'overview'
  | 'profile'
  | 'sales'
  | 'motivation'
  | 'access'
  | 'attendance'
  | 'compensation'
  | 'activity'
  | 'settings'

export function EmployeeCard({
  user,
  canEdit,
  lockPrivileges,
  tab: tabProp,
  onTabChange,
}: EmployeeCardProps) {
  const { t } = useLocalization()
  const { updateUser, disableAccount } = useUsers()
  const { currentUser } = useAccess()
  const { modules } = useOrganization()
  const [localTab, setLocalTab] = useState<EmployeeTab>('profile')
  const tab = tabProp ?? localTab
  const setTab = onTabChange ?? setLocalTab
  const activeTab = tab === 'overview' ? 'profile' : tab
  const showAccess = canManageEmployees(currentUser)
  const tabs: {
    id: EmployeeTab
    labelKey:
      | 'employeeTabProfile'
      | 'employeeTabSales'
      | 'employeeTabMotivation'
      | 'employeeTabAccess'
      | 'employeeTabAttendance'
      | 'compensationTitle'
      | 'employeeTabActivity'
      | 'employeeTabSettings'
  }[] = [
    { id: 'profile', labelKey: 'employeeTabProfile' },
    ...(showAccess
      ? ([{ id: 'access', labelKey: 'employeeTabAccess' }] as const)
      : []),
    ...(modules.attendance === true
      ? ([{ id: 'attendance', labelKey: 'employeeTabAttendance' }] as const)
      : []),
    { id: 'compensation', labelKey: 'compensationTitle' },
    { id: 'activity', labelKey: 'employeeTabActivity' },
    ...(modules.sales === true
      ? ([{ id: 'sales', labelKey: 'employeeTabSales' }] as const)
      : []),
    ...(modules.plans === true
      ? ([{ id: 'motivation', labelKey: 'employeeTabMotivation' }] as const)
      : []),
    ...(canEdit
      ? ([{ id: 'settings', labelKey: 'employeeTabSettings' }] as const)
      : []),
  ]

  return (
    <div className="employee-card">
      {canEdit && canManageEmployees(currentUser) && user.role !== 'owner' ? (
        <div className="warehouse-card__actions">
          {isUserAccountEnabled(user) ? (
            <Button
              variant="danger"
              onClick={() => {
                if (!window.confirm(t('employeeDisableAccountConfirm'))) {
                  return
                }
                disableAccount(user.id)
              }}
            >
              {t('employeeDisableAccount')}
            </Button>
          ) : (
            <EnableAccountAction user={user} />
          )}
        </div>
      ) : null}

      <nav className="employee-card__tabs" aria-label={t('employeeCard')}>
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            className={
              activeTab === item.id ? 'employee-tab employee-tab--active' : 'employee-tab'
            }
            onClick={() => setTab(item.id)}
          >
            {t(item.labelKey)}
          </button>
        ))}
      </nav>

      {activeTab === 'profile' ? <EmployeeOverview user={user} /> : null}
      {activeTab === 'sales' ? <EmployeeSalesPanel user={user} /> : null}
      {activeTab === 'motivation' ? <EmployeeMotivationPanel user={user} /> : null}
      {activeTab === 'access' ? <EmployeeAccessPanel user={user} /> : null}
      {activeTab === 'attendance' ? <EmployeeAttendancePanel user={user} /> : null}
      {activeTab === 'compensation' ? <EmployeeCompensationPanel user={user} /> : null}
      {activeTab === 'activity' ? <EmployeeActivityPanel user={user} /> : null}
      {activeTab === 'settings' ? (
        canEdit ? (
          <UserForm
            key={`${user.id}-${user.updatedAt}`}
            user={user}
            lockPrivileges={lockPrivileges}
            onSubmit={(draft) => updateUser(user.id, draft)}
            onCancel={() => setTab('profile')}
          />
        ) : (
          <p className="workspace-muted">{t('ACCESS_DENIED')}</p>
        )
      ) : null}
    </div>
  )
}

function EnableAccountAction({ user }: { user: User }) {
  const { t } = useLocalization()
  const { enableAccount } = useUsers()
  const [email, setEmail] = useState(user.email ?? '')
  const needsEmail = !user.email.trim() || !user.email.includes('@')

  return (
    <>
      {needsEmail ? (
        <input
          className="warehouse-input"
          type="email"
          name="accountEmail"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder={t('email')}
        />
      ) : null}
      <Button
        onClick={() => {
          enableAccount(user.id, needsEmail ? email : undefined)
        }}
      >
        {t('employeeCreateAccountLater')}
      </Button>
    </>
  )
}
