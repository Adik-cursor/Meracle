import { useMemo, useState } from 'react'
import { useAccess } from '../../context/access-context'
import { useBranches } from '../../context/branch-context'
import { useDepartments } from '../../context/department-context'
import { useLocalization } from '../../context/localization-context'
import { useOrganization } from '../../context/organization-context'
import { usePersistence } from '../../context/persistence-context'
import { useUsers } from '../../context/user-context'
import type { UserDraft } from '../../context/user-context'
import type { User, UserRole, UserStatus } from '../../../core/types'
import { UserForm } from '../../../modules/crm/users/UserForm'
import { userDisplayName } from '../../../modules/crm/users/user-name'
import { USER_ROLE_LABEL_KEY } from '../../../modules/crm/users/user-role-label'
import { USER_STATUS_LABEL_KEY } from '../../../modules/crm/users/employee-status-label'
import { AuthRequiredState } from '../../components/AuthRequiredState'
import { assignableEmployeeRolesForModules, canManageEmployees, isUserAccountEnabled } from '../../../core/services'
import { KINDERGARTEN_JOB_TITLES } from '../../../core/config/kindergarten-job-titles'
import { KINDERGARTEN_JOB_TITLE_LABEL_KEY } from '../../../modules/crm/users/kindergarten-job-title-label'
import {
  ActionRow,
  Button,
  EmptyState,
  FilterBar,
  Input,
  PageHeader,
  RowMenu,
  Select,
  StatusBadge,
} from '../../../shared/ui'
import { ExcelExportButton } from '../../../shared/components/ExcelExportButton'
import { useWarehouses } from '../../context/warehouse-context'
import { useAppPath } from '../useAppPath'

export function UsersPage() {
  const { t, locale } = useLocalization()
  const { navigate } = useAppPath()
  const { currentUser } = useAccess()
  const { modules, organization } = useOrganization()
  const persistence = usePersistence()
  const { users, createUser, updateUser, setUserStatus, filterUsers } = useUsers()
  const { warehouses } = useWarehouses()
  const { branches } = useBranches()
  const { departments } = useDepartments()
  const numberLocale = locale === 'kk' ? 'kk-KZ' : 'ru-RU'
  const [formMode, setFormMode] = useState<'closed' | 'create' | 'edit'>(
    'closed',
  )
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [query, setQuery] = useState('')
  const [branchFilter, setBranchFilter] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('')
  const [warehouseFilter, setWarehouseFilter] = useState('')
  const [careGroupFilter, setCareGroupFilter] = useState('')
  const [jobTitleFilter, setJobTitleFilter] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const careMode = modules.children === true
  const showWarehouse = !careMode && modules.warehouses === true
  const careGroups = careMode ? persistence.careGroups.list(organization.id) : []

  const closeForm = () => {
    setFormMode('closed')
    setEditingUser(null)
  }

  const selectedUser =
    formMode === 'edit' && editingUser
      ? users.find((user) => user.id === editingUser.id)
      : undefined

  const handleCreate = (draft: UserDraft) => createUser(draft)
  const handleUpdate = (draft: UserDraft) =>
    selectedUser ? updateUser(selectedUser.id, draft) : false

  const filteredUsers = useMemo(
    () =>
      filterUsers({
        query,
        branchId: careMode ? undefined : branchFilter || undefined,
        departmentId: careMode ? undefined : departmentFilter || undefined,
        warehouseId: careMode ? undefined : warehouseFilter || undefined,
        careGroupId: careMode ? careGroupFilter || undefined : undefined,
        jobTitle: careMode ? jobTitleFilter || undefined : undefined,
        role: careMode ? undefined : ((roleFilter || undefined) as UserRole | undefined),
        status: (statusFilter || undefined) as UserStatus | undefined,
      }),
    [
      filterUsers,
      careMode,
      query,
      branchFilter,
      departmentFilter,
      warehouseFilter,
      careGroupFilter,
      jobTitleFilter,
      roleFilter,
      statusFilter,
    ],
  )

  const departmentsForFilter = branchFilter
    ? departments.filter((department) => department.branchId === branchFilter)
    : departments
  const warehousesForFilter = branchFilter
    ? warehouses.filter((warehouse) => warehouse.branchId === branchFilter)
    : warehouses

  if (!currentUser) {
    return <AuthRequiredState />
  }

  const branchName = (id?: string) =>
    branches.find((branch) => branch.id === id)?.name ?? '—'
  const departmentName = (id?: string) =>
    departments.find((department) => department.id === id)?.name ?? '—'
  const warehouseName = (id?: string) =>
    warehouses.find((warehouse) => warehouse.id === id)?.name ?? '—'
  const careGroupName = (id?: string) =>
    careGroups.find((group) => group.id === id)?.name ?? '—'

  const statusTone = (status: UserStatus) =>
    status === 'active' ? 'success' : status === 'invited' ? 'info' : 'neutral'
  const accountCell = (user: User) => (
    <>
      <StatusBadge tone={isUserAccountEnabled(user) ? 'success' : 'neutral'}>
        {isUserAccountEnabled(user) ? t('employeeAccountYes') : t('employeeAccountNo')}
      </StatusBadge>
      {isUserAccountEnabled(user) && user.lastLoginAt ? (
        <span className="workspace-muted">
          {' '}
          {new Date(user.lastLoginAt).toLocaleString(numberLocale)}
        </span>
      ) : null}
    </>
  )

  return (
    <section className="workspace-page">
      <PageHeader
        title={t('navEmployees')}
        actions={
          <>
            <ExcelExportButton dataset="employees" />
            {formMode === 'closed' && canManageEmployees(currentUser) ? (
              <Button variant="primary" onClick={() => setFormMode('create')}>
                {t('addUser')}
              </Button>
            ) : null}
          </>
        }
      />

      {formMode === 'closed' ? (
        <div className="employee-filter-bar">
          <FilterBar
            search={
              <Input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label={t('employeeSearch')}
                placeholder={t('employeeSearch')}
              />
            }
            filters={
              <>
            {careMode ? (
              <>
                <Select
                  value={careGroupFilter}
                  onChange={(event) => setCareGroupFilter(event.target.value)}
                  aria-label={t('allCareGroups')}
                >
                  <option value="">{t('allCareGroups')}</option>
                  {careGroups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </Select>
                <Select
                  value={jobTitleFilter}
                  onChange={(event) => setJobTitleFilter(event.target.value)}
                  aria-label={t('allJobTitles')}
                >
                  <option value="">{t('allJobTitles')}</option>
                  {KINDERGARTEN_JOB_TITLES.map((title) => (
                    <option key={title} value={title}>
                      {t(KINDERGARTEN_JOB_TITLE_LABEL_KEY[title])}
                    </option>
                  ))}
                </Select>
              </>
            ) : (
              <>
            <Select
              value={branchFilter}
              onChange={(event) => {
                const next = event.target.value
                setBranchFilter(next)
                setDepartmentFilter('')
                setWarehouseFilter('')
              }}
              aria-label={t('navBranches')}
            >
              <option value="">{t('navBranches')}</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </Select>
            <Select
              value={departmentFilter}
              onChange={(event) => setDepartmentFilter(event.target.value)}
              aria-label={t('navDepartments')}
            >
              <option value="">{t('navDepartments')}</option>
              {departmentsForFilter.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </Select>
            {showWarehouse ? (
              <Select
                value={warehouseFilter}
                onChange={(event) => setWarehouseFilter(event.target.value)}
                aria-label={t('navWarehouses')}
              >
                <option value="">{t('navWarehouses')}</option>
                {warehousesForFilter.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </option>
                ))}
              </Select>
            ) : null}
            <Select
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value)}
              aria-label={t('userRole')}
            >
              <option value="">{t('userRole')}</option>
              {(
                ['owner', ...assignableEmployeeRolesForModules(currentUser, modules)] as UserRole[]
              ).map((role) => (
                <option key={role} value={role}>
                  {t(USER_ROLE_LABEL_KEY[role])}
                </option>
              ))}
            </Select>
              </>
            )}
            <Select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              aria-label={t('status')}
            >
              <option value="">{t('status')}</option>
              <option value="active">{t('active')}</option>
              <option value="invited">{t('employeeStatusInvited')}</option>
              <option value="disabled">{t('employeeStatusDisabled')}</option>
            </Select>
              </>
            }
          />
        </div>
      ) : null}

      {formMode === 'create' ? (
        <UserForm onSubmit={handleCreate} onCancel={closeForm} />
      ) : null}

      {formMode === 'edit' && selectedUser ? (
        <UserForm
          key={`${selectedUser.id}-${selectedUser.updatedAt}`}
          user={selectedUser}
          lockPrivileges={selectedUser.id === currentUser.id}
          onSubmit={handleUpdate}
          onCancel={closeForm}
        />
      ) : null}

      {users.length === 0 && formMode === 'closed' ? (
        <EmptyState
          title={t('noUsers')}
          action={
            canManageEmployees(currentUser) ? (
              <Button variant="primary" onClick={() => setFormMode('create')}>
                {t('addUser')}
              </Button>
            ) : undefined
          }
        />
      ) : null}

      {filteredUsers.length > 0 && formMode === 'closed' ? (
        <>
          <div className="employee-table-wrap employee-table-wrap--desktop">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('employeeColName')}</th>
                  <th>{t('employeeJobTitle')}</th>
                  {careMode ? (
                    <>
                      <th>{t('careGroup')}</th>
                      <th>{t('status')}</th>
                      <th>{t('employeeAccount')}</th>
                    </>
                  ) : (
                    <>
                      <th>{t('userRole')}</th>
                      <th>{t('employeeUnit')}</th>
                      {showWarehouse ? <th>{t('navWarehouses')}</th> : null}
                      <th>{t('status')}</th>
                      <th>{t('employeeAccount')}</th>
                    </>
                  )}
                  <th>{t('transferActions')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <Button
                        variant="ghost"
                        className="entity-cell__title"
                        onClick={() => navigate(`/company/employees/${user.id}`)}
                      >
                        {userDisplayName(user)}
                      </Button>
                    </td>
                    <td className={user.jobTitle ? undefined : 'cell-muted'}>
                      {user.jobTitle ?? '—'}
                    </td>
                    {careMode ? (
                      <>
                        <td className={user.careGroupId ? undefined : 'cell-muted'}>
                          {careGroupName(user.careGroupId)}
                        </td>
                        <td>
                          <StatusBadge tone={statusTone(user.status)}>
                            {t(USER_STATUS_LABEL_KEY[user.status])}
                          </StatusBadge>
                        </td>
                        <td>{accountCell(user)}</td>
                      </>
                    ) : (
                      <>
                    <td>{t(USER_ROLE_LABEL_KEY[user.role])}</td>
                        <td>{`${branchName(user.branchId)} · ${departmentName(user.departmentId)}`}</td>
                        {showWarehouse ? <td>{warehouseName(user.warehouseId)}</td> : null}
                    <td>
                      <StatusBadge tone={statusTone(user.status)}>
                        {t(USER_STATUS_LABEL_KEY[user.status])}
                      </StatusBadge>
                    </td>
                    <td>{accountCell(user)}</td>
                      </>
                    )}
                    <td>
                      <div className="table-actions">
                        <ActionRow>
                        {canManageEmployees(currentUser) ? (
                          <Button
                            onClick={() => {
                              setEditingUser(user)
                              setFormMode('edit')
                            }}
                          >
                            {t('edit')}
                          </Button>
                        ) : null}
                        {canManageEmployees(currentUser) && user.id !== currentUser.id ? (
                          <RowMenu
                            label={t('moreActions')}
                            items={[
                              {
                                id: 'status',
                                label:
                                  user.status === 'active'
                                    ? t('employeeDisable')
                                    : t('employeeEnable'),
                                danger: user.status === 'active',
                                onSelect: () => {
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
                                },
                              },
                            ]}
                          />
                        ) : null}
                        </ActionRow>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="employee-mobile-list">
            {filteredUsers.map((user) => (
              <article className="employee-mobile-card" key={`m-${user.id}`}>
                <button
                  type="button"
                  className="employee-mobile-card__title"
                  onClick={() => navigate(`/company/employees/${user.id}`)}
                >
                  {userDisplayName(user)}
                </button>
                <p>
                  {user.jobTitle ?? '—'}
                  {careMode
                    ? ''
                    : ` · ${t(USER_ROLE_LABEL_KEY[user.role])}`}
                </p>
                <p>
                  {careMode
                    ? careGroupName(user.careGroupId)
                    : showWarehouse
                      ? `${branchName(user.branchId)} · ${departmentName(user.departmentId)} · ${warehouseName(user.warehouseId)}`
                      : `${branchName(user.branchId)} · ${departmentName(user.departmentId)}`}
                </p>
                <p>
                  {t(USER_STATUS_LABEL_KEY[user.status])} ·{' '}
                  {isUserAccountEnabled(user)
                    ? `${t('employeeAccountYes')}${
                        user.lastLoginAt
                          ? ` · ${new Date(user.lastLoginAt).toLocaleString(numberLocale)}`
                          : ''
                      }`
                    : t('employeeAccountNo')}
                </p>
                <ActionRow>
                  {canManageEmployees(currentUser) ? (
                    <Button
                      onClick={() => {
                        setEditingUser(user)
                        setFormMode('edit')
                      }}
                    >
                      {t('edit')}
                    </Button>
                  ) : null}
                  {canManageEmployees(currentUser) && user.id !== currentUser.id ? (
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
                      {user.status === 'active'
                        ? t('employeeDisable')
                        : t('employeeEnable')}
                    </Button>
                  ) : null}
                </ActionRow>
              </article>
            ))}
          </div>
        </>
      ) : null}
    </section>
  )
}
