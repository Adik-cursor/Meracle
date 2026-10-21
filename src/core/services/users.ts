import type { AccessScope, Id, User, UserRole, UserStatus } from '../types'
import { getAccessScope, USER_ROLES } from '../types'
import { fail, ok, okVoid, type ServiceResult } from '../types/domain-error'
import type { Persistence } from '../repositories/persistence'
import { belongsToOrganization } from './catalog'
import type { AccessChangeLog } from '../types/access-change-log'
import type {
  PermissionOverride,
  PermissionOverrideDomain,
  PermissionOverrideEffect,
} from '../types/permission-override'
import { FINANCIAL_PERMISSION_GROUPS } from '../types/financial-permission'
import { WAREHOUSE_PERMISSION_GROUPS } from '../types/warehouse-permission'
import {
  canAccessUser,
  canDelegateFinancialPermission,
  canDelegateWarehousePermission,
  canManageEmployees,
  canWritePlannedSalary,
  denyUnless,
  requireActorInOrganization,
  requireCurrentUser,
} from './access'
import { canAccessWarehouse } from './warehouse-access'
import { newId, nowIso, optionalText } from './primitives'
import { kindergartenJobHasAccount, kindergartenJobRequiresCareGroup } from '../config/kindergarten-job-titles'
import {
  isEmployeeRoleAvailableForModules,
  type ModuleAccessFlags,
} from './module-access'

export type UserWrite = {
  firstName: string
  lastName: string
  email?: string
  role: UserRole
  status: UserStatus
  phone?: string
  jobTitle?: string
  accountEnabled?: boolean
  careGroupId?: Id
  managerId?: Id
  branchId?: Id
  departmentId?: Id
  warehouseId?: Id
  salaryAmount?: number
}

function isModuleKeyEnabled(
  persistence: Persistence,
  organizationId: Id,
  moduleKey: string,
): boolean {
  return persistence.organizationModuleConfigs
    .list(organizationId)
    .some((item) => item.moduleKey === moduleKey && item.status === 'enabled')
}

function isChildrenModuleEnabled(
  persistence: Persistence,
  organizationId: Id,
): boolean {
  return isModuleKeyEnabled(persistence, organizationId, 'children')
}

function roleModulesForOrganization(
  persistence: Persistence,
  organizationId: Id,
): ModuleAccessFlags {
  return {
    sales: isModuleKeyEnabled(persistence, organizationId, 'sales'),
    warehouses: isModuleKeyEnabled(persistence, organizationId, 'warehouse'),
    children: isModuleKeyEnabled(persistence, organizationId, 'children'),
  }
}

function denyUnlessRoleAvailableForOrganization(
  persistence: Persistence,
  organizationId: Id,
  role: UserRole,
  existingRole?: UserRole,
): ServiceResult<void> {
  if (role === 'owner' || role === existingRole) {
    return okVoid()
  }
  if (isEmployeeRoleAvailableForModules(role, roleModulesForOrganization(persistence, organizationId))) {
    return okVoid()
  }
  return fail({ code: 'ACCESS_DENIED' })
}

const USER_WRITE_STATUSES: readonly UserStatus[] = [
  'invited',
  'active',
  'disabled',
]

function isUserRole(value: string): value is UserRole {
  return USER_ROLES.includes(value as UserRole)
}

function isWriteStatus(value: string): value is UserStatus {
  return USER_WRITE_STATUSES.includes(value as UserStatus)
}

function optionalId(value: Id | undefined): Id | undefined {
  return optionalText(value)
}

function requireAssignableWarehouse(
  actor: User,
  persistence: Persistence,
  warehouseId: Id | undefined,
): ServiceResult<User> {
  const nextWarehouseId = optionalId(warehouseId)
  if (!nextWarehouseId) {
    return ok(actor)
  }

  const warehouse = persistence.warehouses.getById(nextWarehouseId)
  if (!warehouse) {
    return fail({ code: 'WAREHOUSE_NOT_FOUND' })
  }

  if (!canAccessWarehouse(actor, warehouse).ok) {
    return fail({ code: 'ACCESS_DENIED' })
  }

  return ok(actor)
}


function requireUser(
  persistence: Persistence,
  organizationId: Id,
  id: Id,
): ServiceResult<User> {
  const user = persistence.users.getById(id)

  if (!user) {
    return fail({ code: 'USER_NOT_FOUND' })
  }

  if (!belongsToOrganization(user, organizationId)) {
    return fail({ code: 'USER_ORGANIZATION_MISMATCH' })
  }

  return ok(user)
}

function validateWarehouseAssignment(
  persistence: Persistence,
  organizationId: Id,
  role: UserRole,
  branchId: Id | undefined,
  warehouseId: Id | undefined,
  requireWarehouse: boolean,
): ServiceResult<{ warehouseId?: Id }> {
  const nextWarehouseId = optionalId(warehouseId)

  if (
    requireWarehouse &&
    (role === 'sales_employee' || role === 'warehouse_manager')
  ) {
    if (!nextWarehouseId) {
      return fail({ code: 'USER_WAREHOUSE_REQUIRED' })
    }
  }

  if (!nextWarehouseId) {
    return ok({})
  }

  const warehouse = persistence.warehouses.getById(nextWarehouseId)
  if (!warehouse) {
    return fail({ code: 'WAREHOUSE_NOT_FOUND' })
  }

  if (warehouse.organizationId !== organizationId) {
    return fail({ code: 'WAREHOUSE_ORGANIZATION_MISMATCH' })
  }

  if (branchId && warehouse.branchId !== branchId) {
    return fail({ code: 'WAREHOUSE_BRANCH_MISMATCH' })
  }

  return ok({ warehouseId: nextWarehouseId })
}

function validateCareGroupAssignment(
  persistence: Persistence,
  organizationId: Id,
  jobTitle: string | undefined,
  careGroupId: Id | undefined,
): ServiceResult<{ careGroupId?: Id }> {
  if (!isChildrenModuleEnabled(persistence, organizationId)) {
    return ok({})
  }

  const nextGroupId = optionalId(careGroupId)
  if (!kindergartenJobRequiresCareGroup(jobTitle)) {
    return ok({})
  }

  if (!nextGroupId) {
    return fail({ code: 'CARE_GROUP_REQUIRED' })
  }

  const group = persistence.careGroups.getById(nextGroupId)
  if (!group) {
    return fail({ code: 'CARE_GROUP_NOT_FOUND' })
  }
  if (group.organizationId !== organizationId) {
    return fail({ code: 'ORGANIZATION_MISMATCH' })
  }

  return ok({ careGroupId: nextGroupId })
}

function validateOrganizationStructure(
  persistence: Persistence,
  organizationId: Id,
  role: UserRole,
  branchId: Id | undefined,
  departmentId: Id | undefined,
  requireStructure: boolean,
): ServiceResult<{ branchId?: Id; departmentId?: Id }> {
  const nextBranchId = optionalId(branchId)
  const nextDepartmentId = optionalId(departmentId)
  const requiresBranch =
    requireStructure &&
    (role === 'sales_employee' ||
      role === 'sales_manager' ||
      role === 'branch_director' ||
      role === 'warehouse_manager')
  const requiresDepartment =
    requireStructure && (role === 'sales_employee' || role === 'sales_manager')

  if (requiresBranch && !nextBranchId) {
    return fail({ code: 'INVALID_USER_ORGANIZATION_STRUCTURE' })
  }

  if (requiresDepartment && !nextDepartmentId) {
    return fail({ code: 'INVALID_USER_ORGANIZATION_STRUCTURE' })
  }

  if (nextDepartmentId && !nextBranchId) {
    return fail({ code: 'INVALID_USER_ORGANIZATION_STRUCTURE' })
  }

  if (nextBranchId) {
    const branch = persistence.branches.getById(nextBranchId)
    if (!branch) {
      return fail({ code: 'BRANCH_NOT_FOUND' })
    }
    if (!belongsToOrganization(branch, organizationId)) {
      return fail({ code: 'BRANCH_ORGANIZATION_MISMATCH' })
    }
  }

  if (nextDepartmentId) {
    const department = persistence.departments.getById(nextDepartmentId)
    if (!department) {
      return fail({ code: 'DEPARTMENT_NOT_FOUND' })
    }
    if (!belongsToOrganization(department, organizationId)) {
      return fail({ code: 'DEPARTMENT_ORGANIZATION_MISMATCH' })
    }
    if (department.branchId !== nextBranchId) {
      return fail({ code: 'DEPARTMENT_BRANCH_MISMATCH' })
    }
  }

  return ok({
    branchId: nextBranchId,
    departmentId: nextDepartmentId,
  })
}

function resolveEmployeeIdentity(
  childrenOrg: boolean,
  draft: UserWrite,
  jobTitle: string | undefined,
): { role: UserRole; accountEnabled: boolean } {
  if (draft.role === 'owner') {
    return { role: 'owner', accountEnabled: true }
  }

  if (childrenOrg && draft.accountEnabled === undefined) {
    return {
      role: draft.role,
      accountEnabled:
        draft.role === 'kindergarten_admin' || kindergartenJobHasAccount(jobTitle),
    }
  }

  return {
    role: draft.role,
    accountEnabled: draft.accountEnabled !== false,
  }
}

function normalizeWrite(
  persistence: Persistence,
  organizationId: Id,
  draft: UserWrite,
): ServiceResult<UserWrite> {
  const firstName = draft.firstName.trim()
  const lastName = draft.lastName.trim()

  if (!firstName || !lastName) {
    return fail({ code: 'INVALID_INPUT' })
  }

  if (!isUserRole(draft.role) || !isWriteStatus(draft.status)) {
    return fail({ code: 'INVALID_INPUT' })
  }

  const childrenOrg = isChildrenModuleEnabled(persistence, organizationId)
  const jobTitle = optionalText(draft.jobTitle)
  const identity = resolveEmployeeIdentity(childrenOrg, draft, jobTitle)
  const email = optionalText(draft.email) ?? ''

  if (identity.accountEnabled) {
    if (!email || !email.includes('@')) {
      return fail({ code: 'INVALID_INPUT' })
    }
  } else if (email && !email.includes('@')) {
    return fail({ code: 'INVALID_INPUT' })
  }

  const requireStructure = identity.accountEnabled && !childrenOrg
  const structure = validateOrganizationStructure(
    persistence,
    organizationId,
    identity.role,
    draft.branchId,
    draft.departmentId,
    requireStructure,
  )
  if (!structure.ok) {
    return structure
  }

  const warehouse = validateWarehouseAssignment(
    persistence,
    organizationId,
    identity.role,
    structure.value.branchId,
    draft.warehouseId,
    requireStructure,
  )
  if (!warehouse.ok) {
    return warehouse
  }

  const phone = optionalText(draft.phone)
  const managerId = optionalId(draft.managerId)
  const careGroup = validateCareGroupAssignment(
    persistence,
    organizationId,
    jobTitle,
    draft.careGroupId,
  )
  if (!careGroup.ok) {
    return careGroup
  }

  if (managerId) {
    const manager = persistence.users.getById(managerId)
    if (!manager) {
      return fail({ code: 'USER_NOT_FOUND' })
    }
    if (manager.organizationId !== organizationId) {
      return fail({ code: 'USER_ORGANIZATION_MISMATCH' })
    }
  }

  return ok({
    firstName,
    lastName,
    email,
    role: identity.role,
    status: draft.status,
    phone,
    jobTitle,
    accountEnabled: identity.accountEnabled,
    careGroupId: careGroup.value.careGroupId,
    managerId,
    branchId: structure.value.branchId,
    departmentId: structure.value.departmentId,
    warehouseId: warehouse.value.warehouseId,
  })
}

export function createUser(
  persistence: Persistence,
  organizationId: Id,
  draft: UserWrite,
): ServiceResult<User> {
  const normalized = normalizeWrite(persistence, organizationId, draft)
  if (!normalized.ok) {
    return normalized
  }

  const now = nowIso()
  const salaryAmount =
    draft.salaryAmount !== undefined &&
    Number.isFinite(draft.salaryAmount) &&
    draft.salaryAmount >= 0
      ? draft.salaryAmount
      : undefined
  const user: User = {
    id: newId(),
    organizationId,
    ...normalized.value,
    email: normalized.value.email ?? '',
    salaryAmount,
    createdAt: now,
    updatedAt: now,
  }

  return ok(persistence.users.create(user))
}

export type FirstOwnerWrite = {
  firstName: string
  lastName: string
  email: string
}

export function createFirstOwner(
  persistence: Persistence,
  organizationId: Id,
  draft: FirstOwnerWrite,
): ServiceResult<User> {
  if (persistence.users.list(organizationId).length > 0) {
    return fail({ code: 'ACCESS_DENIED' })
  }

  return createUser(persistence, organizationId, {
    firstName: draft.firstName,
    lastName: draft.lastName,
    email: draft.email,
    role: 'owner',
    status: 'active',
  })
}

export function updateUser(
  persistence: Persistence,
  organizationId: Id,
  id: Id,
  draft: UserWrite,
): ServiceResult<User> {
  const existing = requireUser(persistence, organizationId, id)
  if (!existing.ok) {
    return existing
  }

  const normalized = normalizeWrite(persistence, organizationId, draft)
  if (!normalized.ok) {
    return normalized
  }

  const updated = persistence.users.update(id, {
    ...normalized.value,
    email: normalized.value.email ?? '',
    salaryAmount:
      draft.salaryAmount !== undefined
        ? draft.salaryAmount
        : existing.value.salaryAmount,
    updatedAt: nowIso(),
  })

  if (!updated) {
    return fail({ code: 'USER_NOT_FOUND' })
  }

  return ok(updated)
}

export function setUserStatus(
  persistence: Persistence,
  organizationId: Id,
  id: Id,
  status: Extract<UserStatus, 'active' | 'disabled'>,
): ServiceResult {
  const existing = requireUser(persistence, organizationId, id)
  if (!existing.ok) {
    return existing
  }

  if (!isWriteStatus(status)) {
    return fail({ code: 'INVALID_INPUT' })
  }

  const updated = persistence.users.update(id, {
    status,
    updatedAt: nowIso(),
  })

  if (!updated) {
    return fail({ code: 'USER_NOT_FOUND' })
  }

  return okVoid()
}

export function listUsersForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
): ServiceResult<User[]> {
  const actor = requireCurrentUser(currentUser)
  if (!actor.ok) {
    return actor
  }

  return ok(
    persistence.users
      .list(actor.value.organizationId)
      .filter((user) => canAccessUser(actor.value, user)),
  )
}

export function getUserForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  id: Id,
): ServiceResult<User> {
  const actor = requireCurrentUser(currentUser)
  if (!actor.ok) {
    return actor
  }

  const user = persistence.users.getById(id)
  if (!user) {
    return fail({ code: 'USER_NOT_FOUND' })
  }

  const allowed = denyUnless(canAccessUser(actor.value, user))
  if (!allowed.ok) {
    return allowed
  }

  return ok(user)
}

export function setUserSalaryForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  userId: Id,
  salaryAmount: number,
): ServiceResult<User> {
  const actor = requireCurrentUser(currentUser)
  if (!actor.ok) {
    return actor
  }

  const write = denyUnless(canWritePlannedSalary(actor.value))
  if (!write.ok) {
    return write
  }

  if (!Number.isFinite(salaryAmount) || salaryAmount < 0) {
    return fail({ code: 'INVALID_INPUT' })
  }

  const target = getUserForUser(persistence, currentUser, userId)
  if (!target.ok) {
    return target
  }

  const updated = persistence.users.update(userId, {
    salaryAmount,
    updatedAt: nowIso(),
  })
  if (!updated) {
    return fail({ code: 'USER_NOT_FOUND' })
  }

  return ok(updated)
}

const ACCESS_SCOPE_RANK: Record<AccessScope, number> = {
  own: 0,
  warehouse: 1,
  department: 2,
  branch: 3,
  organization: 4,
}

export function canAssignRole(actor: User, role: UserRole): boolean {
  if (role === 'owner') {
    return actor.role === 'owner'
  }

  if (!canManageEmployees(actor)) {
    return false
  }

  return (
    ACCESS_SCOPE_RANK[getAccessScope(role)] <=
    ACCESS_SCOPE_RANK[getAccessScope(actor.role)]
  )
}

export function canAssignEmployeeRole(
  actor: User,
  role: UserRole,
  modules: ModuleAccessFlags,
): boolean {
  if (!isEmployeeRoleAvailableForModules(role, modules)) {
    return false
  }
  return canAssignRole(actor, role)
}

export function assignableEmployeeRolesForModules(
  actor: User | null | undefined,
  modules: ModuleAccessFlags,
  currentRole?: UserRole,
): UserRole[] {
  const catalog: UserRole[] = USER_ROLES.filter((role) => role !== 'owner')
  const available = catalog.filter((role) => {
    if (!actor) {
      return false
    }
    return canAssignEmployeeRole(actor, role, modules)
  })
  if (currentRole && currentRole !== 'owner' && !available.includes(currentRole)) {
    return [currentRole, ...available]
  }
  return available
}

export function createUserForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  organizationId: Id,
  draft: UserWrite,
): ServiceResult<User> {
  const actor = requireActorInOrganization(currentUser, organizationId)
  if (!actor.ok) {
    return actor
  }

  const manage = denyUnless(canManageEmployees(actor.value))
  if (!manage.ok) {
    return manage
  }

  const roleAllowed = denyUnless(canAssignRole(actor.value, draft.role))
  if (!roleAllowed.ok) {
    return roleAllowed
  }
  if (draft.role === 'owner') {
    const hasOwner = persistence.users
      .list(organizationId)
      .some((item) => item.role === 'owner')
    if (hasOwner) {
      return fail({ code: 'ACCESS_DENIED' })
    }
  }
  const moduleRole = denyUnlessRoleAvailableForOrganization(
    persistence,
    organizationId,
    draft.role,
  )
  if (!moduleRole.ok) {
    return moduleRole
  }

  const previewAllowed = denyUnless(
    canAccessUser(actor.value, {
      id: '',
      organizationId,
      branchId: draft.branchId,
      departmentId: draft.departmentId,
    }),
  )
  if (!previewAllowed.ok) {
    return previewAllowed
  }

  const warehouseAllowed = requireAssignableWarehouse(
    actor.value,
    persistence,
    draft.warehouseId,
  )
  if (!warehouseAllowed.ok) {
    return warehouseAllowed
  }

  if (
    draft.salaryAmount !== undefined &&
    !canWritePlannedSalary(actor.value)
  ) {
    return fail({ code: 'ACCESS_DENIED' })
  }

  return createUser(persistence, organizationId, draft)
}

export function updateUserForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  organizationId: Id,
  id: Id,
  draft: UserWrite,
): ServiceResult<User> {
  const actor = requireActorInOrganization(currentUser, organizationId)
  if (!actor.ok) {
    return actor
  }

  const existing = requireUser(persistence, organizationId, id)
  if (!existing.ok) {
    return existing
  }

  const canRead = denyUnless(canAccessUser(actor.value, existing.value))
  if (!canRead.ok) {
    return canRead
  }

  if (
    draft.salaryAmount !== undefined &&
    draft.salaryAmount !== existing.value.salaryAmount &&
    !canWritePlannedSalary(actor.value)
  ) {
    return fail({ code: 'ACCESS_DENIED' })
  }

  const isSelf = actor.value.id === id
  if (!isSelf) {
    const manage = denyUnless(canManageEmployees(actor.value))
    if (!manage.ok) {
      return manage
    }

    const roleAllowed = denyUnless(canAssignRole(actor.value, draft.role))
    if (!roleAllowed.ok) {
      return roleAllowed
    }
    if (draft.role === 'owner' && existing.value.role !== 'owner') {
      return fail({ code: 'ACCESS_DENIED' })
    }
    const moduleRole = denyUnlessRoleAvailableForOrganization(
      persistence,
      organizationId,
      draft.role,
      existing.value.role,
    )
    if (!moduleRole.ok) {
      return moduleRole
    }
  } else if (
    draft.role !== existing.value.role ||
    optionalId(draft.branchId) !== existing.value.branchId ||
    optionalId(draft.departmentId) !== existing.value.departmentId ||
    optionalId(draft.warehouseId) !== existing.value.warehouseId
  ) {
    return fail({ code: 'ACCESS_DENIED' })
  }

  const canWrite = denyUnless(
    canAccessUser(actor.value, {
      id,
      organizationId,
      branchId: isSelf ? existing.value.branchId : draft.branchId,
      departmentId: isSelf ? existing.value.departmentId : draft.departmentId,
    }),
  )
  if (!canWrite.ok) {
    return canWrite
  }

  if (!isSelf) {
    const warehouseAllowed = requireAssignableWarehouse(
      actor.value,
      persistence,
      draft.warehouseId,
    )
    if (!warehouseAllowed.ok) {
      return warehouseAllowed
    }
  }

  const updated = updateUser(persistence, organizationId, id, {
    ...draft,
    role: isSelf ? existing.value.role : draft.role,
    branchId: isSelf ? existing.value.branchId : draft.branchId,
    departmentId: isSelf ? existing.value.departmentId : draft.departmentId,
    warehouseId: isSelf ? existing.value.warehouseId : draft.warehouseId,
  })
  if (!updated.ok) {
    return updated
  }

  if (!isSelf && draft.role !== existing.value.role) {
    return clearOverridesOnRoleChange(
      persistence,
      actor.value,
      updated.value,
      existing.value.role,
    )
  }

  return updated
}

export function setUserStatusForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  organizationId: Id,
  id: Id,
  status: Extract<UserStatus, 'active' | 'disabled'>,
): ServiceResult {
  const actor = requireActorInOrganization(currentUser, organizationId)
  if (!actor.ok) {
    return actor
  }

  if (actor.value.id === id) {
    return fail({ code: 'ACCESS_DENIED' })
  }

  const manage = denyUnless(canManageEmployees(actor.value))
  if (!manage.ok) {
    return manage
  }

  const existing = requireUser(persistence, organizationId, id)
  if (!existing.ok) {
    return existing
  }

  const allowed = denyUnless(canAccessUser(actor.value, existing.value))
  if (!allowed.ok) {
    return allowed
  }

  return setUserStatus(persistence, organizationId, id, status)
}

export function enableAccountForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  organizationId: Id,
  id: Id,
  email?: string,
): ServiceResult<User> {
  const actor = requireActorInOrganization(currentUser, organizationId)
  if (!actor.ok) {
    return actor
  }

  const manage = denyUnless(canManageEmployees(actor.value))
  if (!manage.ok) {
    return manage
  }

  const existing = requireUser(persistence, organizationId, id)
  if (!existing.ok) {
    return existing
  }

  const allowed = denyUnless(canAccessUser(actor.value, existing.value))
  if (!allowed.ok) {
    return allowed
  }

  const nextEmail = optionalText(email) ?? optionalText(existing.value.email) ?? ''
  if (!nextEmail || !nextEmail.includes('@')) {
    return fail({ code: 'INVALID_INPUT' })
  }

  const childrenOrg = isChildrenModuleEnabled(persistence, organizationId)
  const directorJob =
    existing.value.role === 'kindergarten_admin' ||
    kindergartenJobHasAccount(existing.value.jobTitle)
  const nextRole =
    childrenOrg && directorJob && existing.value.role !== 'owner'
      ? 'kindergarten_admin'
      : existing.value.role

  const updated = persistence.users.update(id, {
    accountEnabled: true,
    email: nextEmail,
    role: nextRole,
    updatedAt: nowIso(),
  })
  if (!updated) {
    return fail({ code: 'USER_NOT_FOUND' })
  }

  return ok(updated)
}

export function disableAccountForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  organizationId: Id,
  id: Id,
): ServiceResult<User> {
  const actor = requireActorInOrganization(currentUser, organizationId)
  if (!actor.ok) {
    return actor
  }

  if (actor.value.id === id) {
    return fail({ code: 'ACCESS_DENIED' })
  }

  const manage = denyUnless(canManageEmployees(actor.value))
  if (!manage.ok) {
    return manage
  }

  const existing = requireUser(persistence, organizationId, id)
  if (!existing.ok) {
    return existing
  }

  if (existing.value.role === 'owner') {
    return fail({ code: 'ACCESS_DENIED' })
  }

  const allowed = denyUnless(canAccessUser(actor.value, existing.value))
  if (!allowed.ok) {
    return allowed
  }

  const updated = persistence.users.update(id, {
    accountEnabled: false,
    updatedAt: nowIso(),
  })
  if (!updated) {
    return fail({ code: 'USER_NOT_FOUND' })
  }

  const session = persistence.auth.getSession()
  if (session?.userId === id) {
    persistence.auth.clearSession()
  }

  return ok(updated)
}

export function searchUsersForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  query: string,
): ServiceResult<User[]> {
  const listed = listUsersForUser(persistence, currentUser)
  if (!listed.ok) {
    return listed
  }

  const needle = query.trim().toLowerCase()
  if (!needle) {
    return listed
  }

  return ok(
    listed.value.filter((user) => {
      const haystack =
        `${user.firstName} ${user.lastName} ${user.email ?? ''} ${user.phone ?? ''} ${user.jobTitle ?? ''}`.toLowerCase()
      return haystack.includes(needle)
    }),
  )
}

export type UserListFilter = {
  query?: string
  branchId?: Id
  departmentId?: Id
  warehouseId?: Id
  careGroupId?: Id
  role?: UserRole
  jobTitle?: string
  status?: UserStatus
}

export function filterUsersForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  filter: UserListFilter = {},
): ServiceResult<User[]> {
  const searched = searchUsersForUser(persistence, currentUser, filter.query ?? '')
  if (!searched.ok) {
    return searched
  }

  return ok(
    searched.value.filter((user) => {
      if (filter.branchId && user.branchId !== filter.branchId) {
        return false
      }
      if (filter.departmentId && user.departmentId !== filter.departmentId) {
        return false
      }
      if (filter.warehouseId && user.warehouseId !== filter.warehouseId) {
        return false
      }
      if (filter.careGroupId && user.careGroupId !== filter.careGroupId) {
        return false
      }
      if (filter.role && user.role !== filter.role) {
        return false
      }
      if (filter.jobTitle && (user.jobTitle ?? '') !== filter.jobTitle) {
        return false
      }
      if (filter.status && user.status !== filter.status) {
        return false
      }
      return true
    }),
  )
}

const FINANCIAL_PERMISSION_SET = new Set(
  Object.values(FINANCIAL_PERMISSION_GROUPS).flat(),
)
const WAREHOUSE_PERMISSION_SET = new Set(
  Object.values(WAREHOUSE_PERMISSION_GROUPS).flat(),
)

function recordAccessChange(
  persistence: Persistence,
  organizationId: Id,
  actorUserId: Id,
  targetUserId: Id,
  field: string,
  previousValue: string,
  nextValue: string,
  reason?: string,
): void {
  const now = nowIso()
  const entry: AccessChangeLog = {
    id: newId(),
    organizationId,
    actorUserId,
    targetUserId,
    field,
    previousValue,
    nextValue,
    reason,
    createdAt: now,
    updatedAt: now,
  }
  persistence.accessChangeLogs.create(entry)
}

function clearOverridesOnRoleChange(
  persistence: Persistence,
  actor: User,
  target: User,
  previousRole: User['role'],
): ServiceResult<User> {
  const previous = target.permissionOverrides ?? []
  if (previous.length === 0) {
    return ok(target)
  }

  const updated = persistence.users.update(target.id, {
    permissionOverrides: [],
    updatedAt: nowIso(),
  })
  if (!updated) {
    return fail({ code: 'USER_NOT_FOUND' })
  }

  recordAccessChange(
    persistence,
    target.organizationId,
    actor.id,
    target.id,
    'permissionOverrides',
    previousRole,
    target.role,
    'role-change-reset',
  )

  return ok(updated)
}

export function setUserPermissionOverrideForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  organizationId: Id,
  targetUserId: Id,
  domain: PermissionOverrideDomain,
  permission: string,
  effect: PermissionOverrideEffect,
  reason?: string,
): ServiceResult<User> {
  const actor = requireActorInOrganization(currentUser, organizationId)
  if (!actor.ok) {
    return actor
  }

  if (actor.value.id === targetUserId) {
    return fail({ code: 'ACCESS_DENIED' })
  }

  const manage = denyUnless(canManageEmployees(actor.value))
  if (!manage.ok) {
    return manage
  }

  const existing = requireUser(persistence, organizationId, targetUserId)
  if (!existing.ok) {
    return existing
  }

  const visible = denyUnless(canAccessUser(actor.value, existing.value))
  if (!visible.ok) {
    return visible
  }

  if (domain === 'financial') {
    if (!FINANCIAL_PERMISSION_SET.has(permission as never)) {
      return fail({ code: 'INVALID_INPUT' })
    }

    if (
      !canDelegateFinancialPermission(
        actor.value,
        permission as (typeof FINANCIAL_PERMISSION_GROUPS.SALES)[number],
      )
    ) {
      return fail({ code: 'ACCESS_DENIED' })
    }
  } else {
    if (!WAREHOUSE_PERMISSION_SET.has(permission as never)) {
      return fail({ code: 'INVALID_INPUT' })
    }

    if (
      !canDelegateWarehousePermission(
        actor.value,
        permission as (typeof WAREHOUSE_PERMISSION_GROUPS.CATALOG)[number],
      )
    ) {
      return fail({ code: 'ACCESS_DENIED' })
    }
  }

  const rest = (existing.value.permissionOverrides ?? []).filter(
    (override) =>
      !(override.domain === domain && override.permission === permission),
  )
  const next: PermissionOverride[] = [...rest, { domain, permission, effect }]
  const previous =
    existing.value.permissionOverrides?.find(
      (override) =>
        override.domain === domain && override.permission === permission,
    )?.effect ?? 'base'

  const updated = persistence.users.update(targetUserId, {
    permissionOverrides: next,
    updatedAt: nowIso(),
  })
  if (!updated) {
    return fail({ code: 'USER_NOT_FOUND' })
  }

  recordAccessChange(
    persistence,
    organizationId,
    actor.value.id,
    targetUserId,
    `${domain}:${permission}`,
    previous,
    effect,
    reason,
  )

  return ok(updated)
}

export function removeUserPermissionOverrideForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  organizationId: Id,
  targetUserId: Id,
  domain: PermissionOverrideDomain,
  permission: string,
): ServiceResult<User> {
  const actor = requireActorInOrganization(currentUser, organizationId)
  if (!actor.ok) {
    return actor
  }

  if (actor.value.id === targetUserId) {
    return fail({ code: 'ACCESS_DENIED' })
  }

  const manage = denyUnless(canManageEmployees(actor.value))
  if (!manage.ok) {
    return manage
  }

  const existing = requireUser(persistence, organizationId, targetUserId)
  if (!existing.ok) {
    return existing
  }

  const visible = denyUnless(canAccessUser(actor.value, existing.value))
  if (!visible.ok) {
    return visible
  }

  const previous = existing.value.permissionOverrides?.find(
    (override) =>
      override.domain === domain && override.permission === permission,
  )
  if (!previous) {
    return ok(existing.value)
  }

  const next = (existing.value.permissionOverrides ?? []).filter(
    (override) =>
      !(override.domain === domain && override.permission === permission),
  )
  const updated = persistence.users.update(targetUserId, {
    permissionOverrides: next,
    updatedAt: nowIso(),
  })
  if (!updated) {
    return fail({ code: 'USER_NOT_FOUND' })
  }

  recordAccessChange(
    persistence,
    organizationId,
    actor.value.id,
    targetUserId,
    `${domain}:${permission}`,
    previous.effect,
    'base',
  )

  return ok(updated)
}

export function listAccessChangeLogsForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
): ServiceResult<AccessChangeLog[]> {
  const actor = requireCurrentUser(currentUser)
  if (!actor.ok) {
    return actor
  }

  const manage = denyUnless(canManageEmployees(actor.value))
  if (!manage.ok) {
    return manage
  }

  return ok(
    persistence.accessChangeLogs
      .list(actor.value.organizationId)
      .filter((entry) => {
        const target = entry.targetUserId
          ? persistence.users.getById(entry.targetUserId)
          : undefined
        return target ? canAccessUser(actor.value, target) : false
      }),
  )
}
