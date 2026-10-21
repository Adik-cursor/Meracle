import type { Branch, BranchStatus, Id, User } from '../types'
import { fail, ok, okVoid, type ServiceResult } from '../types/domain-error'
import type { Persistence } from '../repositories/persistence'
import { belongsToOrganization } from './catalog'
import {
  canAccessBranch,
  canCreateBranch,
  canWriteBranch,
  denyUnless,
  requireActorInOrganization,
  requireCurrentUser,
} from './access'
import { newId, nowIso, optionalText } from './primitives'

export const BRANCH_STATUSES: readonly BranchStatus[] = ['active', 'inactive']

export type BranchWrite = {
  name: string
  code?: string
}

function isBranchStatus(value: string): value is BranchStatus {
  return BRANCH_STATUSES.includes(value as BranchStatus)
}

function requireBranch(
  persistence: Persistence,
  organizationId: Id,
  id: Id,
): ServiceResult<Branch> {
  const branch = persistence.branches.getById(id)

  if (!branch) {
    return fail({ code: 'BRANCH_NOT_FOUND' })
  }

  if (!belongsToOrganization(branch, organizationId)) {
    return fail({ code: 'BRANCH_ORGANIZATION_MISMATCH' })
  }

  return ok(branch)
}

function normalizeWrite(
  persistence: Persistence,
  organizationId: Id,
  draft: BranchWrite,
  exceptId?: Id,
): ServiceResult<BranchWrite> {
  const name = draft.name.trim()
  if (!name) {
    return fail({ code: 'INVALID_INPUT' })
  }

  const code = optionalText(draft.code)
  if (code) {
    const taken = persistence.branches
      .list(organizationId)
      .some(
        (branch) =>
          branch.id !== exceptId &&
          branch.code?.toLowerCase() === code.toLowerCase(),
      )

    if (taken) {
      return fail({ code: 'BRANCH_CODE_DUPLICATE' })
    }
  }

  return ok({ name, code })
}

export function createBranch(
  persistence: Persistence,
  organizationId: Id,
  draft: BranchWrite,
): ServiceResult<Branch> {
  const normalized = normalizeWrite(persistence, organizationId, draft)
  if (!normalized.ok) {
    return normalized
  }

  const now = nowIso()
  const branch: Branch = {
    id: newId(),
    organizationId,
    ...normalized.value,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  }

  return ok(persistence.branches.create(branch))
}

export function updateBranch(
  persistence: Persistence,
  organizationId: Id,
  id: Id,
  draft: BranchWrite,
): ServiceResult<Branch> {
  const existing = requireBranch(persistence, organizationId, id)
  if (!existing.ok) {
    return existing
  }

  const normalized = normalizeWrite(persistence, organizationId, draft, id)
  if (!normalized.ok) {
    return normalized
  }

  const updated = persistence.branches.update(id, {
    ...normalized.value,
    updatedAt: nowIso(),
  })

  if (!updated) {
    return fail({ code: 'BRANCH_NOT_FOUND' })
  }

  return ok(updated)
}

export function setBranchStatus(
  persistence: Persistence,
  organizationId: Id,
  id: Id,
  status: BranchStatus,
): ServiceResult {
  const existing = requireBranch(persistence, organizationId, id)
  if (!existing.ok) {
    return existing
  }

  if (!isBranchStatus(status)) {
    return fail({ code: 'INVALID_INPUT' })
  }

  const updated = persistence.branches.update(id, {
    status,
    updatedAt: nowIso(),
  })

  if (!updated) {
    return fail({ code: 'BRANCH_NOT_FOUND' })
  }

  return okVoid()
}

export function listBranchesForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
): ServiceResult<Branch[]> {
  const actor = requireCurrentUser(currentUser)
  if (!actor.ok) {
    return actor
  }

  return ok(
    persistence.branches
      .list(actor.value.organizationId)
      .filter((branch) => canAccessBranch(actor.value, branch)),
  )
}

export function getBranchForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  id: Id,
): ServiceResult<Branch> {
  const actor = requireCurrentUser(currentUser)
  if (!actor.ok) {
    return actor
  }

  const branch = persistence.branches.getById(id)
  if (!branch) {
    return fail({ code: 'BRANCH_NOT_FOUND' })
  }

  const allowed = denyUnless(canAccessBranch(actor.value, branch))
  if (!allowed.ok) {
    return allowed
  }

  return ok(branch)
}

export function createBranchForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  organizationId: Id,
  draft: BranchWrite,
): ServiceResult<Branch> {
  const actor = requireActorInOrganization(currentUser, organizationId)
  if (!actor.ok) {
    return actor
  }

  const allowed = denyUnless(canCreateBranch(actor.value))
  if (!allowed.ok) {
    return allowed
  }

  return createBranch(persistence, organizationId, draft)
}

export function updateBranchForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  organizationId: Id,
  id: Id,
  draft: BranchWrite,
): ServiceResult<Branch> {
  const actor = requireActorInOrganization(currentUser, organizationId)
  if (!actor.ok) {
    return actor
  }

  const existing = requireBranch(persistence, organizationId, id)
  if (!existing.ok) {
    return existing
  }

  const allowed = denyUnless(canWriteBranch(actor.value, existing.value))
  if (!allowed.ok) {
    return allowed
  }

  return updateBranch(persistence, organizationId, id, draft)
}

export function setBranchStatusForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  organizationId: Id,
  id: Id,
  status: BranchStatus,
): ServiceResult {
  const actor = requireActorInOrganization(currentUser, organizationId)
  if (!actor.ok) {
    return actor
  }

  const existing = requireBranch(persistence, organizationId, id)
  if (!existing.ok) {
    return existing
  }

  const allowed = denyUnless(canWriteBranch(actor.value, existing.value))
  if (!allowed.ok) {
    return allowed
  }

  return setBranchStatus(persistence, organizationId, id, status)
}
