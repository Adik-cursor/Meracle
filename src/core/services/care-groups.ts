import type { CareGroup, CareGroupStatus, Id, User } from '../types'
import { fail, ok, type ServiceResult } from '../types/domain-error'
import type { Persistence } from '../repositories/persistence'
import { belongsToOrganization } from './catalog'
import { newId, nowIso } from './primitives'
import { requireChildrenManager, requireChildrenReader } from './care-access'

export type CareGroupWrite = {
  name: string
  capacity: number
  status: CareGroupStatus
}

function requireGroup(
  persistence: Persistence,
  organizationId: Id,
  id: Id,
): ServiceResult<CareGroup> {
  const group = persistence.careGroups.getById(id)
  if (!group) {
    return fail({ code: 'CARE_GROUP_NOT_FOUND' })
  }
  if (!belongsToOrganization(group, organizationId)) {
    return fail({ code: 'ORGANIZATION_MISMATCH' })
  }
  return ok(group)
}

function normalizeWrite(draft: CareGroupWrite): ServiceResult<CareGroupWrite> {
  const name = draft.name.trim()
  const capacity = Math.floor(draft.capacity)
  if (!name || !Number.isFinite(capacity) || capacity < 1) {
    return fail({ code: 'INVALID_INPUT' })
  }
  if (draft.status !== 'active' && draft.status !== 'inactive') {
    return fail({ code: 'INVALID_INPUT' })
  }
  return ok({ name, capacity, status: draft.status })
}

export function listCareGroupsForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
): ServiceResult<CareGroup[]> {
  const actor = requireChildrenReader(persistence, currentUser)
  if (!actor.ok) {
    return actor
  }

  return ok(
    persistence.careGroups
      .list(actor.value.organizationId)
      .sort((left, right) => left.name.localeCompare(right.name, 'ru')),
  )
}

export function getCareGroupForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  id: Id,
): ServiceResult<CareGroup> {
  const actor = requireChildrenReader(persistence, currentUser)
  if (!actor.ok) {
    return actor
  }

  return requireGroup(persistence, actor.value.organizationId, id)
}

export function createCareGroupForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  draft: CareGroupWrite,
): ServiceResult<CareGroup> {
  const actor = requireChildrenManager(persistence, currentUser)
  if (!actor.ok) {
    return actor
  }

  const normalized = normalizeWrite(draft)
  if (!normalized.ok) {
    return normalized
  }

  const now = nowIso()
  return ok(
    persistence.careGroups.create({
      id: newId(),
      organizationId: actor.value.organizationId,
      name: normalized.value.name,
      capacity: normalized.value.capacity,
      status: normalized.value.status,
      createdAt: now,
      updatedAt: now,
    }),
  )
}

export function updateCareGroupForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  id: Id,
  draft: CareGroupWrite,
): ServiceResult<CareGroup> {
  const actor = requireChildrenManager(persistence, currentUser)
  if (!actor.ok) {
    return actor
  }

  const existing = requireGroup(persistence, actor.value.organizationId, id)
  if (!existing.ok) {
    return existing
  }

  const normalized = normalizeWrite(draft)
  if (!normalized.ok) {
    return normalized
  }

  const updated = persistence.careGroups.update(id, {
    name: normalized.value.name,
    capacity: normalized.value.capacity,
    status: normalized.value.status,
    updatedAt: nowIso(),
  })
  if (!updated) {
    return fail({ code: 'CARE_GROUP_NOT_FOUND' })
  }
  return ok(updated)
}

export function setCareGroupStatusForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  id: Id,
  status: CareGroupStatus,
): ServiceResult<CareGroup> {
  const existing = getCareGroupForUser(persistence, currentUser, id)
  if (!existing.ok) {
    return existing
  }
  return updateCareGroupForUser(persistence, currentUser, id, {
    name: existing.value.name,
    capacity: existing.value.capacity,
    status,
  })
}
