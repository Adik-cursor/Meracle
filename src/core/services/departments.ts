import type { Department, DepartmentStatus, Id, User } from '../types'
import { fail, ok, okVoid, type ServiceResult } from '../types/domain-error'
import type { Persistence } from '../repositories/persistence'
import { belongsToOrganization } from './catalog'
import {
  canAccessDepartment,
  canWriteDepartment,
  denyUnless,
  requireActorInOrganization,
  requireCurrentUser,
} from './access'
import { newId, nowIso, optionalText } from './primitives'

export const DEPARTMENT_STATUSES: readonly DepartmentStatus[] = [
  'active',
  'inactive',
]

export type DepartmentWrite = {
  name: string
  code?: string
  branchId: Id
}

function isDepartmentStatus(value: string): value is DepartmentStatus {
  return DEPARTMENT_STATUSES.includes(value as DepartmentStatus)
}

function requireDepartment(
  persistence: Persistence,
  organizationId: Id,
  id: Id,
): ServiceResult<Department> {
  const department = persistence.departments.getById(id)

  if (!department) {
    return fail({ code: 'DEPARTMENT_NOT_FOUND' })
  }

  if (!belongsToOrganization(department, organizationId)) {
    return fail({ code: 'DEPARTMENT_ORGANIZATION_MISMATCH' })
  }

  return ok(department)
}

function requireOrgBranch(
  persistence: Persistence,
  organizationId: Id,
  branchId: Id,
): ServiceResult {
  const branch = persistence.branches.getById(branchId)

  if (!branch) {
    return fail({ code: 'BRANCH_NOT_FOUND' })
  }

  if (!belongsToOrganization(branch, organizationId)) {
    return fail({ code: 'BRANCH_ORGANIZATION_MISMATCH' })
  }

  return okVoid()
}

function normalizeWrite(
  persistence: Persistence,
  organizationId: Id,
  draft: DepartmentWrite,
  exceptId?: Id,
): ServiceResult<DepartmentWrite> {
  const name = draft.name.trim()
  const branchId = draft.branchId.trim()

  if (!name || !branchId) {
    return fail({ code: 'INVALID_INPUT' })
  }

  const branch = requireOrgBranch(persistence, organizationId, branchId)
  if (!branch.ok) {
    return branch
  }

  const code = optionalText(draft.code)
  if (code) {
    const taken = persistence.departments
      .listByBranchId(organizationId, branchId)
      .some(
        (department) =>
          department.id !== exceptId &&
          department.code?.toLowerCase() === code.toLowerCase(),
      )

    if (taken) {
      return fail({ code: 'DEPARTMENT_CODE_DUPLICATE' })
    }
  }

  return ok({ name, code, branchId })
}

export function createDepartment(
  persistence: Persistence,
  organizationId: Id,
  draft: DepartmentWrite,
): ServiceResult<Department> {
  const normalized = normalizeWrite(persistence, organizationId, draft)
  if (!normalized.ok) {
    return normalized
  }

  const now = nowIso()
  const department: Department = {
    id: newId(),
    organizationId,
    ...normalized.value,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  }

  return ok(persistence.departments.create(department))
}

export function updateDepartment(
  persistence: Persistence,
  organizationId: Id,
  id: Id,
  draft: DepartmentWrite,
): ServiceResult<Department> {
  const existing = requireDepartment(persistence, organizationId, id)
  if (!existing.ok) {
    return existing
  }

  const normalized = normalizeWrite(persistence, organizationId, draft, id)
  if (!normalized.ok) {
    return normalized
  }

  const updated = persistence.departments.update(id, {
    ...normalized.value,
    updatedAt: nowIso(),
  })

  if (!updated) {
    return fail({ code: 'DEPARTMENT_NOT_FOUND' })
  }

  return ok(updated)
}

export function setDepartmentStatus(
  persistence: Persistence,
  organizationId: Id,
  id: Id,
  status: DepartmentStatus,
): ServiceResult {
  const existing = requireDepartment(persistence, organizationId, id)
  if (!existing.ok) {
    return existing
  }

  if (!isDepartmentStatus(status)) {
    return fail({ code: 'INVALID_INPUT' })
  }

  const updated = persistence.departments.update(id, {
    status,
    updatedAt: nowIso(),
  })

  if (!updated) {
    return fail({ code: 'DEPARTMENT_NOT_FOUND' })
  }

  return okVoid()
}

export function listDepartmentsForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
): ServiceResult<Department[]> {
  const actor = requireCurrentUser(currentUser)
  if (!actor.ok) {
    return actor
  }

  return ok(
    persistence.departments
      .list(actor.value.organizationId)
      .filter((department) => canAccessDepartment(actor.value, department)),
  )
}

export function getDepartmentForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  id: Id,
): ServiceResult<Department> {
  const actor = requireCurrentUser(currentUser)
  if (!actor.ok) {
    return actor
  }

  const department = persistence.departments.getById(id)
  if (!department) {
    return fail({ code: 'DEPARTMENT_NOT_FOUND' })
  }

  const allowed = denyUnless(canAccessDepartment(actor.value, department))
  if (!allowed.ok) {
    return allowed
  }

  return ok(department)
}

export function createDepartmentForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  organizationId: Id,
  draft: DepartmentWrite,
): ServiceResult<Department> {
  const actor = requireActorInOrganization(currentUser, organizationId)
  if (!actor.ok) {
    return actor
  }

  const allowed = denyUnless(
    canWriteDepartment(actor.value, {
      id: '',
      organizationId,
      branchId: draft.branchId,
    }),
  )
  if (!allowed.ok) {
    return allowed
  }

  return createDepartment(persistence, organizationId, draft)
}

export function updateDepartmentForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  organizationId: Id,
  id: Id,
  draft: DepartmentWrite,
): ServiceResult<Department> {
  const actor = requireActorInOrganization(currentUser, organizationId)
  if (!actor.ok) {
    return actor
  }

  const existing = requireDepartment(persistence, organizationId, id)
  if (!existing.ok) {
    return existing
  }

  const canRead = denyUnless(canWriteDepartment(actor.value, existing.value))
  if (!canRead.ok) {
    return canRead
  }

  const canWrite = denyUnless(
    canWriteDepartment(actor.value, {
      id,
      organizationId,
      branchId: draft.branchId,
    }),
  )
  if (!canWrite.ok) {
    return canWrite
  }

  return updateDepartment(persistence, organizationId, id, draft)
}

export function setDepartmentStatusForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  organizationId: Id,
  id: Id,
  status: DepartmentStatus,
): ServiceResult {
  const actor = requireActorInOrganization(currentUser, organizationId)
  if (!actor.ok) {
    return actor
  }

  const existing = requireDepartment(persistence, organizationId, id)
  if (!existing.ok) {
    return existing
  }

  const allowed = denyUnless(canWriteDepartment(actor.value, existing.value))
  if (!allowed.ok) {
    return allowed
  }

  return setDepartmentStatus(persistence, organizationId, id, status)
}
