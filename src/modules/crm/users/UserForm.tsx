import { useState, type FormEvent } from 'react'
import { useAccess } from '../../../app/context/access-context'
import { useBranches } from '../../../app/context/branch-context'
import { useDepartments } from '../../../app/context/department-context'
import { useLocalization } from '../../../app/context/localization-context'
import { useOrganization } from '../../../app/context/organization-context'
import { usePersistence } from '../../../app/context/persistence-context'
import type { UserDraft } from '../../../app/context/user-context'
import { useUsers } from '../../../app/context/user-context'
import { useWarehouses } from '../../../app/context/warehouse-context'
import { assignableEmployeeRolesForModules, canWritePlannedSalary } from '../../../core/services'
import type { Branch, Department, User, UserRole, UserStatus, Warehouse } from '../../../core/types'
import { getAccessScope } from '../../../core/types'
import type { TranslationKey } from '../../../core/localization/translations'
import { RolePermissionPreview } from '../../company/RolePermissionPreview'
import { accessScopeDisplayKey } from './access-scope-label'
import { userDisplayName } from './user-name'
import { JOB_TITLE_PRESET_KEYS } from './job-title-presets'
import { USER_STATUS_LABEL_KEY } from './employee-status-label'
import { KINDERGARTEN_JOB_TITLES, kindergartenJobHasAccount, kindergartenJobRequiresCareGroup } from '../../../core/config/kindergarten-job-titles'
import { KINDERGARTEN_JOB_TITLE_LABEL_KEY } from './kindergarten-job-title-label'
import { isUserAccountEnabled } from '../../../core/services'

const USER_STATUSES: UserStatus[] = ['invited', 'active', 'disabled']

const ROLE_LABEL: Record<UserRole, TranslationKey> = {
  owner: 'userRoleOwner',
  commercial_director: 'userRoleCommercialDirector',
  branch_director: 'userRoleBranchDirector',
  sales_manager: 'userRoleSalesManager',
  sales_employee: 'userRoleSalesEmployee',
  office_employee: 'userRoleOfficeEmployee',
  warehouse_manager: 'userRoleWarehouseManager',
  accountant: 'userRoleAccountant',
  kindergarten_admin: 'userRoleAdmin',
}

function roleNeedsBranch(role: UserRole): boolean {
  return (
    role === 'sales_employee' ||
    role === 'sales_manager' ||
    role === 'branch_director' ||
    role === 'warehouse_manager'
  )
}

function roleNeedsDepartment(role: UserRole): boolean {
  return role === 'sales_employee' || role === 'sales_manager'
}

function roleNeedsWarehouse(role: UserRole): boolean {
  return role === 'sales_employee' || role === 'warehouse_manager'
}

type UserFormDirectory = {
  branches: Branch[]
  departments: Department[]
  warehouses: Warehouse[]
  users: User[]
}

type UserFormProps = {
  user?: User
  lockPrivileges?: boolean
  hideHeading?: boolean
  directory?: UserFormDirectory
  assignableRoles?: UserRole[]
  allowSalary?: boolean
  onSubmit: (draft: UserDraft) => boolean
  onCancel: () => void
}

export function UserForm({
  user,
  lockPrivileges,
  hideHeading,
  directory,
  assignableRoles: assignableRolesProp,
  allowSalary: allowSalaryProp,
  onSubmit,
  onCancel,
}: UserFormProps) {
  const { t } = useLocalization()
  const { modules, organization } = useOrganization()
  const persistence = usePersistence()
  const { currentUser } = useAccess()
  const { branches: contextBranches } = useBranches()
  const { departments: contextDepartments, getDepartmentsByBranch } =
    useDepartments()
  const { users: contextUsers } = useUsers()
  const { warehouses: contextWarehouses } = useWarehouses()
  const branches = directory?.branches ?? contextBranches
  const departments = directory?.departments ?? contextDepartments
  const users = directory?.users ?? contextUsers
  const warehouses = directory?.warehouses ?? contextWarehouses
  const assignableRoles =
    assignableRolesProp ?? assignableEmployeeRolesForModules(currentUser, modules)
  const allowSalary = allowSalaryProp ?? canWritePlannedSalary(currentUser)
  const emptyOptionsLabel = directory ? 'noneAvailable' : undefined
  const [firstName, setFirstName] = useState(user?.firstName ?? '')
  const [lastName, setLastName] = useState(user?.lastName ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [phone, setPhone] = useState(user?.phone ?? '')
  const [jobTitle, setJobTitle] = useState(user?.jobTitle ?? '')
  const [careGroupId, setCareGroupId] = useState(user?.careGroupId ?? '')
  const [managerId, setManagerId] = useState(user?.managerId ?? '')
  const [role, setRole] = useState<UserRole>(
    user?.role ?? assignableRoles[0] ?? 'office_employee',
  )
  const [branchId, setBranchId] = useState(user?.branchId ?? '')
  const [departmentId, setDepartmentId] = useState(user?.departmentId ?? '')
  const [warehouseId, setWarehouseId] = useState(user?.warehouseId ?? '')
  const [status, setStatus] = useState<UserStatus>(user?.status ?? 'active')
  const [salaryAmount, setSalaryAmount] = useState(
    user?.salaryAmount !== undefined ? String(user.salaryAmount) : '',
  )
  const [firstNameError, setFirstNameError] = useState(false)
  const [lastNameError, setLastNameError] = useState(false)
  const [emailError, setEmailError] = useState(false)
  const [phoneError, setPhoneError] = useState(false)
  const [jobError, setJobError] = useState(false)
  const [branchError, setBranchError] = useState(false)
  const [departmentError, setDepartmentError] = useState(false)
  const [warehouseError, setWarehouseError] = useState(false)
  const [careGroupError, setCareGroupError] = useState(false)
  const [saveDenied, setSaveDenied] = useState(false)
  const careMode = modules.children === true
  const ownerRecord = user?.role === 'owner'
  const [createAccount, setCreateAccount] = useState(
    user ? isUserAccountEnabled(user) : !careMode,
  )
  const hideEmail = user ? !isUserAccountEnabled(user) : !createAccount
  const staffWithoutAccount = hideEmail && !ownerRecord
  const careGroups = careMode
    ? persistence.careGroups.list(organization.id)
    : []
  const groupRequired = careMode && kindergartenJobRequiresCareGroup(jobTitle)
  const groupOptions = careGroups.filter(
    (group) => group.status === 'active' || group.id === user?.careGroupId,
  )

  const departmentsForBranch = branchId
    ? directory
      ? departments.filter((department) => department.branchId === branchId)
      : getDepartmentsByBranch(branchId)
    : []
  const warehousesForBranch = branchId
    ? warehouses.filter((warehouse) => warehouse.branchId === branchId)
    : warehouses

  const applyWarehouseForBranch = (nextBranchId: string) => {
    const stillValid = nextBranchId
      ? warehouses.some(
          (warehouse) =>
            warehouse.id === warehouseId && warehouse.branchId === nextBranchId,
        )
      : warehouses.some((warehouse) => warehouse.id === warehouseId)

    if (!stillValid) {
      setWarehouseId('')
    }
  }

  const applyBranchId = (nextBranchId: string) => {
    setBranchId(nextBranchId)
    if (branchError) {
      setBranchError(false)
    }

    const stillValid = nextBranchId
      ? (directory
          ? departments.filter((department) => department.branchId === nextBranchId)
          : getDepartmentsByBranch(nextBranchId)
        ).some((department) => department.id === departmentId)
      : false

    if (!stillValid) {
      setDepartmentId('')
    }

    applyWarehouseForBranch(nextBranchId)
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextFirst = !firstName.trim()
    const nextLast = !lastName.trim()
    const trimmedEmail = email.trim()
    const emailRequired = !staffWithoutAccount
    const nextEmail = emailRequired
      ? !trimmedEmail || !trimmedEmail.includes('@')
      : Boolean(trimmedEmail) && !trimmedEmail.includes('@')
    const nextPhone = !phone.trim()
    const selectedDepartment = departmentId
      ? departmentsForBranch.find((department) => department.id === departmentId)
      : undefined
    const needsStructure = createAccount && !careMode
    const nextBranch = needsStructure && roleNeedsBranch(role) && !branchId
    const nextDepartment = needsStructure && roleNeedsDepartment(role) && !departmentId
    const nextWarehouse = needsStructure && roleNeedsWarehouse(role) && !warehouseId
    const nextMismatch = Boolean(
      departmentId &&
        (!selectedDepartment || selectedDepartment.branchId !== branchId),
    )
    const selectedWarehouse = warehouseId
      ? warehouses.find((warehouse) => warehouse.id === warehouseId)
      : undefined
    const nextWarehouseMismatch = Boolean(
      !careMode &&
        warehouseId &&
        (!selectedWarehouse ||
          (branchId && selectedWarehouse.branchId !== branchId)),
    )
    const nextGroup = groupRequired && !careGroupId
    const nextJob = !ownerRecord && !jobTitle.trim()

    setFirstNameError(nextFirst)
    setLastNameError(nextLast)
    setEmailError(nextEmail)
    setPhoneError(nextPhone)
    setJobError(nextJob)
    setBranchError(nextBranch)
    setDepartmentError(nextDepartment || nextMismatch)
    setWarehouseError(nextWarehouse || nextWarehouseMismatch)
    setCareGroupError(nextGroup)

    if (
      nextFirst ||
      nextLast ||
      nextEmail ||
      nextBranch ||
      nextDepartment ||
      nextMismatch ||
      nextWarehouse ||
      nextWarehouseMismatch ||
      nextGroup ||
      nextJob ||
      nextPhone
    ) {
      return
    }

    const nextRole = ownerRecord ? 'owner' : role

    if (user && !lockPrivileges) {
      if (
        nextRole !== user.role &&
        !window.confirm(t('accessConfirmRoleChange'))
      ) {
        return
      }
      if (
        !careMode &&
        branchId !== (user.branchId ?? '') &&
        !window.confirm(t('accessConfirmBranchChange'))
      ) {
        return
      }
      if (
        !careMode &&
        warehouseId !== (user.warehouseId ?? '') &&
        !window.confirm(t('accessConfirmWarehouseChange'))
      ) {
        return
      }
      if (
        status === 'disabled' &&
        user.status !== 'disabled' &&
        !window.confirm(t('accessConfirmDisableUser'))
      ) {
        return
      }
    }

    const saved = onSubmit({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: staffWithoutAccount ? undefined : trimmedEmail || undefined,
      phone: phone.trim() || undefined,
      jobTitle: jobTitle.trim() || undefined,
      accountEnabled: ownerRecord ? true : user ? user.accountEnabled : createAccount,
      careGroupId: groupRequired ? careGroupId || undefined : undefined,
      managerId: managerId || undefined,
      role: nextRole,
      status,
      branchId: careMode ? undefined : branchId || undefined,
      departmentId: careMode ? undefined : departmentId || undefined,
      warehouseId: careMode ? undefined : warehouseId || undefined,
      salaryAmount:
        salaryAmount.trim() === '' || !allowSalary
          ? undefined
          : Number(salaryAmount),
    })

    if (saved) {
      setSaveDenied(false)
      onCancel()
      return
    }

    setSaveDenied(true)
  }

  return (
    <form className="warehouse-form settings-section" onSubmit={handleSubmit}>
      {hideHeading ? null : <h2>{user ? t('editUser') : t('addUser')}</h2>}

      <label className="warehouse-field">
        <span className="settings-field__label">{t('firstName')}</span>
        <input
          className="warehouse-input"
          type="text"
          name="firstName"
          value={firstName}
          onChange={(event) => {
            setFirstName(event.target.value)
            if (firstNameError) {
              setFirstNameError(false)
            }
          }}
          aria-invalid={firstNameError ? true : undefined}
        />
        {firstNameError ? (
          <span className="warehouse-field__error">{t('firstNameRequired')}</span>
        ) : null}
      </label>

      <label className="warehouse-field">
        <span className="settings-field__label">{t('lastName')}</span>
        <input
          className="warehouse-input"
          type="text"
          name="lastName"
          value={lastName}
          onChange={(event) => {
            setLastName(event.target.value)
            if (lastNameError) {
              setLastNameError(false)
            }
          }}
          aria-invalid={lastNameError ? true : undefined}
        />
        {lastNameError ? (
          <span className="warehouse-field__error">{t('lastNameRequired')}</span>
        ) : null}
      </label>

      {staffWithoutAccount ? null : (
      <label className="warehouse-field">
        <span className="settings-field__label">{t('email')}</span>
        <input
          className="warehouse-input"
          type="email"
          name="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value)
            if (emailError) {
              setEmailError(false)
            }
          }}
          aria-invalid={emailError ? true : undefined}
        />
        {emailError ? (
          <span className="warehouse-field__error">{t('emailRequired')}</span>
        ) : null}
      </label>
      )}

      <label className="warehouse-field">
        <span className="settings-field__label">{t('employeePhone')} *</span>
        <input
          className="warehouse-input"
          type="tel"
          name="phone"
          value={phone}
          onChange={(event) => {
            setPhone(event.target.value)
            if (phoneError) {
              setPhoneError(false)
            }
          }}
          aria-invalid={phoneError ? true : undefined}
        />
        {phoneError ? (
          <span className="warehouse-field__error">{t('employeePhoneRequired')}</span>
        ) : null}
      </label>

      <label className="warehouse-field">
        <span className="settings-field__label">{t('employeeJobTitle')} *</span>
        {careMode ? (
          <select
            className="warehouse-input"
            name="jobTitle"
            value={jobTitle}
            onChange={(event) => {
              const next = event.target.value
              setJobTitle(next)
              if (jobError) {
                setJobError(false)
              }
              if (!kindergartenJobRequiresCareGroup(next)) {
                setCareGroupId('')
                setCareGroupError(false)
              }
              if (!user && careMode) {
                setCreateAccount(kindergartenJobHasAccount(next))
              }
            }}
            aria-invalid={jobError ? true : undefined}
          >
            <option value="">{t('selectJobTitle')}</option>
            {KINDERGARTEN_JOB_TITLES.map((title) => (
              <option key={title} value={title}>
                {t(KINDERGARTEN_JOB_TITLE_LABEL_KEY[title])}
              </option>
            ))}
          </select>
        ) : (
          <>
            <input
              className="warehouse-input"
              type="text"
              name="jobTitle"
              list="employee-job-title-presets"
              value={jobTitle}
              onChange={(event) => {
                setJobTitle(event.target.value)
                if (jobError) {
                  setJobError(false)
                }
              }}
              aria-invalid={jobError ? true : undefined}
            />
            <datalist id="employee-job-title-presets">
              {JOB_TITLE_PRESET_KEYS.map((key) => (
                <option key={key} value={t(key)} />
              ))}
            </datalist>
          </>
        )}
        {jobError ? (
          <span className="warehouse-field__error">{t('employeeJobTitleRequired')}</span>
        ) : null}
      </label>

      {careMode && groupRequired ? (
        <label className="warehouse-field">
          <span className="settings-field__label">{t('careGroup')} *</span>
          {groupOptions.length === 0 ? (
            <p className="workspace-muted">{t('createCareGroupFirst')}</p>
          ) : (
            <select
              className="warehouse-input"
              name="careGroupId"
              value={careGroupId}
              onChange={(event) => {
                setCareGroupId(event.target.value)
                if (careGroupError) {
                  setCareGroupError(false)
                }
              }}
              aria-invalid={careGroupError ? true : undefined}
            >
              <option value="">{t('selectCareGroup')}</option>
              {groupOptions.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          )}
          {careGroupError ? (
            <span className="warehouse-field__error">{t('CARE_GROUP_REQUIRED')}</span>
          ) : null}
        </label>
      ) : null}

      {!user && !ownerRecord ? (
        <label className="warehouse-field">
          <span className="settings-field__label">{t('employeeAccountCrm')}</span>
          <span className="warehouse-check">
            <input
              type="checkbox"
              name="createAccount"
              checked={createAccount}
              onChange={(event) => setCreateAccount(event.target.checked)}
            />
            {t('employeeCreateAccount')}
          </span>
        </label>
      ) : null}

      {ownerRecord ? null : (
        <>
      <label className="warehouse-field">
        <span className="settings-field__label">{t('userRole')}</span>
        <select
          className="warehouse-input"
          name="role"
          value={role}
          disabled={lockPrivileges}
          onChange={(event) => setRole(event.target.value as UserRole)}
        >
          {assignableRoles.map((item) => (
            <option key={item} value={item}>
              {t(ROLE_LABEL[item])}
            </option>
          ))}
        </select>
      </label>

      <RolePermissionPreview role={role} />

      <p className="workspace-muted">
        {t('accessScopeLabel')}: {t(accessScopeDisplayKey(getAccessScope(role), modules))}
      </p>
        </>
      )}

      {careMode && !ownerRecord && user ? (
        <p className="workspace-muted">
          {isUserAccountEnabled(user)
            ? `${t('employeeAccountCrm')} · ${t('employeeAccountYes')}`
            : `${t('employeeAccountCrm')} · ${t('employeeAccountNo')}`}
        </p>
      ) : null}

      {careMode ? null : (
        <>
      <label className="warehouse-field">
        <span className="settings-field__label">{t('employeeManager')}</span>
        <select
          className="warehouse-input"
          name="managerId"
          value={managerId}
          disabled={lockPrivileges}
          onChange={(event) => setManagerId(event.target.value)}
        >
          <option value="">{t('dealPartyNone')}</option>
          {users
            .filter((item) => item.id !== user?.id)
            .map((item) => (
              <option key={item.id} value={item.id}>
                {userDisplayName(item)}
              </option>
            ))}
        </select>
      </label>

      <label className="warehouse-field">
        <span className="settings-field__label">{t('navBranches')}</span>
        {branches.length === 0 ? (
          <p className="workspace-muted">
            {t(emptyOptionsLabel ?? 'noBranches')}
          </p>
        ) : (
          <select
            className="warehouse-input"
            name="branchId"
            value={branchId}
            disabled={lockPrivileges}
            onChange={(event) => applyBranchId(event.target.value)}
            aria-invalid={branchError ? true : undefined}
          >
            <option value="">{t('dealPartyNone')}</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        )}
        {branchError ? (
          <span className="warehouse-field__error">{t('branchRequired')}</span>
        ) : null}
      </label>

      <label className="warehouse-field">
        <span className="settings-field__label">{t('navDepartments')}</span>
        {!branchId ? (
          <p className="workspace-muted">{t('selectBranchFirst')}</p>
        ) : departmentsForBranch.length === 0 ? (
          <p className="workspace-muted">
            {t(emptyOptionsLabel ?? 'noDepartments')}
          </p>
        ) : (
          <select
            className="warehouse-input"
            name="departmentId"
            value={departmentId}
            disabled={lockPrivileges}
            onChange={(event) => {
              setDepartmentId(event.target.value)
              if (departmentError) {
                setDepartmentError(false)
              }
            }}
            aria-invalid={departmentError ? true : undefined}
          >
            <option value="">{t('dealPartyNone')}</option>
            {departmentsForBranch.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
        )}
        {departmentError ? (
          <span className="warehouse-field__error">
            {t('departmentRequired')}
          </span>
        ) : null}
      </label>

      <label className="warehouse-field">
        <span className="settings-field__label">
          {roleNeedsWarehouse(role)
            ? t('userWarehouse')
            : t('userPrimaryWarehouse')}
        </span>
        {roleNeedsWarehouse(role) && !branchId ? (
          <p className="workspace-muted">{t('selectBranchFirst')}</p>
        ) : warehousesForBranch.length === 0 ? (
          <p className="workspace-muted">
            {t(emptyOptionsLabel ?? 'noWarehouses')}
          </p>
        ) : (
          <select
            className="warehouse-input"
            name="warehouseId"
            value={warehouseId}
            disabled={lockPrivileges}
            onChange={(event) => {
              setWarehouseId(event.target.value)
              if (warehouseError) {
                setWarehouseError(false)
              }
            }}
            aria-invalid={warehouseError ? true : undefined}
          >
            <option value="">{t('dealPartyNone')}</option>
            {warehousesForBranch.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.name}
              </option>
            ))}
          </select>
        )}
        {warehouseError ? (
          <span className="warehouse-field__error">{t('warehouseRequired')}</span>
        ) : null}
      </label>
        </>
      )}

      <label className="warehouse-field">
        <span className="settings-field__label">{t('status')}</span>
        <select
          className="warehouse-input"
          name="status"
          value={status}
          disabled={lockPrivileges}
          onChange={(event) => setStatus(event.target.value as UserStatus)}
        >
          {USER_STATUSES.map((item) => (
            <option key={item} value={item}>
              {t(USER_STATUS_LABEL_KEY[item])}
            </option>
          ))}
        </select>
      </label>

      {allowSalary ? (
        <label className="warehouse-field">
          <span className="settings-field__label">{t('employeeSalary')}</span>
          <input
            className="warehouse-input"
            value={salaryAmount}
            onChange={(event) => setSalaryAmount(event.target.value)}
          />
        </label>
      ) : null}

      {saveDenied ? (
        <p className="warehouse-field__error">{t('ACCESS_DENIED')}</p>
      ) : null}

      <div className="warehouse-form__actions">
        <button type="submit" className="module-switch module-switch--on">
          {t('save')}
        </button>
        <button type="button" className="module-switch" onClick={onCancel}>
          {t('cancel')}
        </button>
      </div>
    </form>
  )
}
