import type {
  AccessScope,
  Branch,
  CarePermission,
  Department,
  FinancialPermission,
  Id,
  User,
  WarehousePermission,
} from '../types'
import { getAccessScope as accessScopeForRole } from '../types/access-scope'
import { getFinancialPermissions } from '../types/financial-permission'
import { getWarehousePermissions } from '../types/warehouse-permission'
import { getCarePermissions } from '../types/care-permission'
import { fail, ok, okVoid, type ServiceResult } from '../types/domain-error'
import type { Persistence } from '../repositories/persistence'
import { isUserAccountEnabled } from './user-account'

export type DealAccessTarget = {
  organizationId: Id
  assignedUserId?: Id
  ownerUserId?: Id
  branchId?: Id
  departmentId?: Id
}

type AssignedResource = {
  organizationId: Id
  assignedUserId?: Id
  dealId?: Id
}

type OrgUserRef = {
  id: Id
  organizationId: Id
  branchId?: Id
  departmentId?: Id
}

export function getAccessScope(user: User): AccessScope {
  return accessScopeForRole(user.role)
}

export function getEffectiveFinancialPermissions(
  user: User,
): FinancialPermission[] {
  const allowed = new Set(getFinancialPermissions(user.role))
  for (const override of user.permissionOverrides ?? []) {
    if (override.domain !== 'financial') {
      continue
    }

    const permission = override.permission as FinancialPermission
    if (override.effect === 'allow') {
      allowed.add(permission)
    }

    if (override.effect === 'deny') {
      allowed.delete(permission)
    }
  }

  return [...allowed]
}

export function hasEffectiveFinancialPermission(
  user: User,
  permission: FinancialPermission,
): boolean {
  return getEffectiveFinancialPermissions(user).includes(permission)
}

export function getEffectiveWarehousePermissions(
  user: User,
): WarehousePermission[] {
  const allowed = new Set(getWarehousePermissions(user.role))
  for (const override of user.permissionOverrides ?? []) {
    if (override.domain !== 'warehouse') {
      continue
    }

    const permission = override.permission as WarehousePermission
    if (override.effect === 'allow') {
      allowed.add(permission)
    }

    if (override.effect === 'deny') {
      allowed.delete(permission)
    }
  }

  return [...allowed]
}

export function hasEffectiveWarehousePermission(
  user: User,
  permission: WarehousePermission,
): boolean {
  return getEffectiveWarehousePermissions(user).includes(permission)
}

export function getEffectiveCarePermissions(user: User): CarePermission[] {
  return [...getCarePermissions(user.role)]
}

export function hasEffectiveCarePermission(
  user: User,
  permission: CarePermission,
): boolean {
  return getEffectiveCarePermissions(user).includes(permission)
}

export function canDelegateFinancialPermission(
  actor: User,
  permission: FinancialPermission,
): boolean {
  return hasEffectiveFinancialPermission(actor, permission)
}

export function canDelegateWarehousePermission(
  actor: User,
  permission: WarehousePermission,
): boolean {
  return hasEffectiveWarehousePermission(actor, permission)
}

export function requireCurrentUser(
  currentUser: User | null | undefined,
): ServiceResult<User> {
  if (!currentUser) {
    return fail({ code: 'CURRENT_USER_REQUIRED' })
  }

  if (!isUserAccountEnabled(currentUser)) {
    return fail({ code: 'ACCESS_DENIED' })
  }

  return ok(currentUser)
}

export function requireActorInOrganization(
  currentUser: User | null | undefined,
  organizationId: Id,
): ServiceResult<User> {
  const actor = requireCurrentUser(currentUser)
  if (!actor.ok) {
    return actor
  }

  if (actor.value.organizationId !== organizationId) {
    return fail({ code: 'ACCESS_DENIED' })
  }

  return actor
}

export function denyUnless(allowed: boolean): ServiceResult {
  return allowed ? okVoid() : fail({ code: 'ACCESS_DENIED' })
}

function sameOrganization(actor: User, organizationId: Id): boolean {
  return actor.organizationId === organizationId
}

function sameBranch(actor: User, branchId: Id | undefined): boolean {
  return Boolean(actor.branchId && branchId && actor.branchId === branchId)
}

function sameDepartment(actor: User, target: OrgUserRef): boolean {
  return (
    sameBranch(actor, target.branchId) &&
    Boolean(
      actor.departmentId &&
        target.departmentId &&
        actor.departmentId === target.departmentId,
    )
  )
}

export function canManageEmployees(currentUser: User | null | undefined): boolean {
  if (!currentUser) {
    return false
  }

  return (
    currentUser.role === 'owner' ||
    currentUser.role === 'commercial_director' ||
    currentUser.role === 'branch_director' ||
    currentUser.role === 'kindergarten_admin'
  )
}

export function canWritePlannedSalary(currentUser: User | null | undefined): boolean {
  return canManageEmployees(currentUser) || canWriteMotivation(currentUser)
}

export function canWriteMotivation(currentUser: User | null | undefined): boolean {
  if (!currentUser) {
    return false
  }

  return (
    currentUser.role === 'owner' ||
    currentUser.role === 'commercial_director' ||
    currentUser.role === 'branch_director' ||
    currentUser.role === 'sales_manager'
  )
}

export function canAccessMotivationPlans(
  currentUser: User | null | undefined,
): boolean {
  if (!currentUser) {
    return false
  }

  return canWriteMotivation(currentUser) || currentUser.role === 'accountant'
}

export function canViewEmployeeDirectory(
  currentUser: User | null | undefined,
): boolean {
  if (!currentUser) {
    return false
  }

  const scope = getAccessScope(currentUser)
  return scope === 'department' || scope === 'branch' || scope === 'organization'
}

export function canAccessUser(
  currentUser: User | null | undefined,
  targetUser: OrgUserRef,
): boolean {
  if (!currentUser || !sameOrganization(currentUser, targetUser.organizationId)) {
    return false
  }

  const scope = getAccessScope(currentUser)

  if (scope === 'own' || scope === 'warehouse') {
    return targetUser.id === currentUser.id
  }

  if (scope === 'department') {
    return sameDepartment(currentUser, targetUser)
  }

  if (scope === 'branch') {
    return sameBranch(currentUser, targetUser.branchId)
  }

  return true
}

export function canAccessBranch(
  currentUser: User | null | undefined,
  branch: Pick<Branch, 'id' | 'organizationId'>,
): boolean {
  if (!currentUser || !sameOrganization(currentUser, branch.organizationId)) {
    return false
  }

  const scope = getAccessScope(currentUser)

  if (scope === 'own' || scope === 'department' || scope === 'warehouse') {
    return false
  }

  if (scope === 'branch') {
    return currentUser.branchId === branch.id
  }

  return true
}

export function canAccessDepartment(
  currentUser: User | null | undefined,
  department: Pick<Department, 'id' | 'organizationId' | 'branchId'>,
): boolean {
  if (
    !currentUser ||
    !sameOrganization(currentUser, department.organizationId)
  ) {
    return false
  }

  const scope = getAccessScope(currentUser)

  if (scope === 'warehouse') {
    return false
  }

  if (scope === 'own' || scope === 'department') {
    return currentUser.departmentId === department.id
  }

  if (scope === 'branch') {
    return sameBranch(currentUser, department.branchId)
  }

  return true
}

function dealOwnerId(resource: DealAccessTarget): Id | undefined {
  return resource.ownerUserId ?? resource.assignedUserId
}

export function canAccessDeal(
  persistence: Persistence,
  currentUser: User | null | undefined,
  deal: DealAccessTarget,
): boolean {
  if (!currentUser || !sameOrganization(currentUser, deal.organizationId)) {
    return false
  }

  const scope = getAccessScope(currentUser)

  if (scope === 'warehouse') {
    return false
  }

  const ownerId = dealOwnerId(deal)

  if (!ownerId) {
    return scope === 'organization'
  }

  if (scope === 'organization') {
    return true
  }

  if (scope === 'own') {
    return ownerId === currentUser.id
  }

  const owner = persistence.users.getById(ownerId)
  const branchId = deal.branchId ?? owner?.branchId
  const departmentId = deal.departmentId ?? owner?.departmentId

  if (
    owner &&
    !sameOrganization(currentUser, owner.organizationId)
  ) {
    return false
  }

  if (scope === 'department') {
    return sameDepartment(currentUser, {
      id: ownerId,
      organizationId: deal.organizationId,
      branchId,
      departmentId,
    })
  }

  return sameBranch(currentUser, branchId)
}

function canAccessAssignedResource(
  persistence: Persistence,
  currentUser: User,
  resource: AssignedResource,
): boolean {
  if (!sameOrganization(currentUser, resource.organizationId)) {
    return false
  }

  const scope = getAccessScope(currentUser)

  if (!resource.assignedUserId) {
    return scope === 'organization'
  }

  if (scope === 'organization') {
    return true
  }

  if (scope === 'own' || scope === 'warehouse') {
    return resource.assignedUserId === currentUser.id
  }

  const assignee = persistence.users.getById(resource.assignedUserId)
  if (!assignee || !sameOrganization(currentUser, assignee.organizationId)) {
    return false
  }

  if (scope === 'department') {
    return sameDepartment(currentUser, assignee)
  }

  return sameBranch(currentUser, assignee.branchId)
}

export function canAccessTask(
  persistence: Persistence,
  currentUser: User | null | undefined,
  task: AssignedResource,
): boolean {
  if (!currentUser) {
    return false
  }

  if (task.dealId) {
    const deal = persistence.deals.getById(task.dealId)
    if (!deal) {
      return false
    }

    return canAccessDeal(persistence, currentUser, deal)
  }

  return canAccessAssignedResource(persistence, currentUser, task)
}

export function canManageOrganizationStructure(currentUser: User): boolean {
  return getAccessScope(currentUser) === 'organization'
}

export function canWriteBranch(
  currentUser: User | null | undefined,
  branch: Pick<Branch, 'id' | 'organizationId'>,
): boolean {
  if (!canAccessBranch(currentUser, branch) || !currentUser) {
    return false
  }

  const scope = getAccessScope(currentUser)
  return scope === 'organization' || scope === 'branch'
}

export function canCreateBranch(currentUser: User | null | undefined): boolean {
  return Boolean(currentUser && canManageOrganizationStructure(currentUser))
}

export function canWriteDepartment(
  currentUser: User | null | undefined,
  department: Pick<Department, 'id' | 'organizationId' | 'branchId'>,
): boolean {
  if (!canAccessDepartment(currentUser, department) || !currentUser) {
    return false
  }

  const scope = getAccessScope(currentUser)
  return scope === 'organization' || scope === 'branch'
}

/*
 * Warehouse / Inventory / StockMovement / Sale / SaleReturn / Payment
 * runtime filtering is not wired yet. Proposed checks live in
 * warehouse-access.ts and are not called from warehouse services.
 */
