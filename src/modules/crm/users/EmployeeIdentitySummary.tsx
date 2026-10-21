import { getAccessScope } from '../../../core/types'
import type { User } from '../../../core/types'
import { useBranches } from '../../../app/context/branch-context'
import { useDepartments } from '../../../app/context/department-context'
import { useLocalization } from '../../../app/context/localization-context'
import { useOrganization } from '../../../app/context/organization-context'
import { usePersistence } from '../../../app/context/persistence-context'
import { useUsers } from '../../../app/context/user-context'
import { useWarehouses } from '../../../app/context/warehouse-context'
import { accessScopeDisplayKey } from './access-scope-label'
import { USER_ROLE_LABEL_KEY } from './user-role-label'
import { userDisplayName } from './user-name'
import { USER_STATUS_LABEL_KEY } from './employee-status-label'
import { isUserAccountEnabled } from '../../../core/services'

type EmployeeIdentitySummaryProps = {
  user: User
}

export function EmployeeIdentitySummary({ user }: EmployeeIdentitySummaryProps) {
  const { t, locale } = useLocalization()
  const { branches } = useBranches()
  const { departments } = useDepartments()
  const { warehouses } = useWarehouses()
  const { getUser } = useUsers()
  const { modules, organization } = useOrganization()
  const persistence = usePersistence()
  const careMode = modules.children === true
  const careGroupName = user.careGroupId
    ? persistence.careGroups
        .list(organization.id)
        .find((group) => group.id === user.careGroupId)?.name ?? '—'
    : '—'
  const numberLocale = locale === 'kk' ? 'kk-KZ' : 'ru-RU'
  const branchName = branches.find((branch) => branch.id === user.branchId)?.name ?? '—'
  const departmentName =
    departments.find((department) => department.id === user.departmentId)?.name ?? '—'
  const warehouseName =
    warehouses.find((warehouse) => warehouse.id === user.warehouseId)?.name ?? '—'
  const manager = user.managerId ? getUser(user.managerId) : undefined

  return (
    <dl className="employee-card__meta">
      <div>
        <dt>{t('employeeFullName')}</dt>
        <dd>{userDisplayName(user)}</dd>
      </div>
      <div>
        <dt>{t('email')}</dt>
        <dd>{user.email}</dd>
      </div>
      <div>
        <dt>{t('employeePhone')}</dt>
        <dd>{user.phone ?? '—'}</dd>
      </div>
      <div>
        <dt>{t('employeeJobTitle')}</dt>
        <dd>{user.jobTitle ?? '—'}</dd>
      </div>
      <div>
        <dt>{t('userRole')}</dt>
        <dd>{t(USER_ROLE_LABEL_KEY[user.role])}</dd>
      </div>
      {careMode ? (
        <div>
          <dt>{t('careGroup')}</dt>
          <dd>{careGroupName}</dd>
        </div>
      ) : (
        <>
      <div>
        <dt>{t('navBranches')}</dt>
        <dd>{branchName}</dd>
      </div>
      <div>
        <dt>{t('navDepartments')}</dt>
        <dd>{departmentName}</dd>
      </div>
      <div>
        <dt>{t('navWarehouses')}</dt>
        <dd>{warehouseName}</dd>
      </div>
        </>
      )}
      <div>
        <dt>{t('status')}</dt>
        <dd>{t(USER_STATUS_LABEL_KEY[user.status])}</dd>
      </div>
      <div>
        <dt>{t('employeeCreatedAt')}</dt>
        <dd>{new Date(user.createdAt).toLocaleString(numberLocale)}</dd>
      </div>
      <div>
        <dt>{t('employeeAccountCrm')}</dt>
        <dd>{isUserAccountEnabled(user) ? t('employeeAccountYes') : t('employeeAccountNotCreated')}</dd>
      </div>
      <div>
        <dt>{t('employeeLastLogin')}</dt>
        <dd>
          {isUserAccountEnabled(user)
            ? user.lastLoginAt
              ? new Date(user.lastLoginAt).toLocaleString(numberLocale)
              : t('neverLoggedIn')
            : '—'}
        </dd>
      </div>
      <div>
        <dt>{t('accessScopeLabel')}</dt>
        <dd>{t(accessScopeDisplayKey(getAccessScope(user.role), modules))}</dd>
      </div>
      <div>
        <dt>{t('employeeManager')}</dt>
        <dd>{manager ? userDisplayName(manager) : '—'}</dd>
      </div>
    </dl>
  )
}
