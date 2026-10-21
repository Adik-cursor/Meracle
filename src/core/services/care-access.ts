import type { CarePermission, Id, User } from '../types'
import { fail, ok, type ServiceResult } from '../types/domain-error'
import type { Persistence } from '../repositories/persistence'
import {
  hasEffectiveCarePermission,
  getEffectiveCarePermissions,
  requireActorInOrganization,
  requireCurrentUser,
} from './access'
import { requireModuleEnabledForUser } from './organization-modules'

export function listCarePermissionsForUser(
  currentUser: User | null | undefined,
): ServiceResult<readonly CarePermission[]> {
  const actor = requireCurrentUser(currentUser)
  if (!actor.ok) {
    return actor
  }

  return ok(getEffectiveCarePermissions(actor.value))
}

export function requireChildrenModule(
  persistence: Persistence,
  currentUser: User | null | undefined,
): ServiceResult<User> {
  return requireModuleEnabledForUser(persistence, currentUser, 'children')
}

export function requireAttendanceModule(
  persistence: Persistence,
  currentUser: User | null | undefined,
): ServiceResult<User> {
  return requireModuleEnabledForUser(persistence, currentUser, 'attendance')
}

export function requireChildrenReader(
  persistence: Persistence,
  currentUser: User | null | undefined,
): ServiceResult<User> {
  const gated = requireChildrenModule(persistence, currentUser)
  if (!gated.ok) {
    return gated
  }

  if (!hasEffectiveCarePermission(gated.value, 'children.read')) {
    return fail({ code: 'ACCESS_DENIED' })
  }

  return gated
}

export function requireChildrenManager(
  persistence: Persistence,
  currentUser: User | null | undefined,
): ServiceResult<User> {
  const reader = requireChildrenReader(persistence, currentUser)
  if (!reader.ok) {
    return reader
  }

  if (!hasEffectiveCarePermission(reader.value, 'children.manage')) {
    return fail({ code: 'ACCESS_DENIED' })
  }

  return reader
}

export function requireAttendanceReader(
  persistence: Persistence,
  currentUser: User | null | undefined,
): ServiceResult<User> {
  const gated = requireAttendanceModule(persistence, currentUser)
  if (!gated.ok) {
    return gated
  }

  if (!hasEffectiveCarePermission(gated.value, 'attendance.read')) {
    return fail({ code: 'ACCESS_DENIED' })
  }

  return gated
}

export function requireAttendanceManager(
  persistence: Persistence,
  currentUser: User | null | undefined,
): ServiceResult<User> {
  const reader = requireAttendanceReader(persistence, currentUser)
  if (!reader.ok) {
    return reader
  }

  if (!hasEffectiveCarePermission(reader.value, 'attendance.manage')) {
    return fail({ code: 'ACCESS_DENIED' })
  }

  return reader
}

export function requireAttendanceSelf(
  persistence: Persistence,
  currentUser: User | null | undefined,
): ServiceResult<User> {
  const reader = requireAttendanceReader(persistence, currentUser)
  if (!reader.ok) {
    return reader
  }

  if (
    !hasEffectiveCarePermission(reader.value, 'attendance.self') &&
    !hasEffectiveCarePermission(reader.value, 'attendance.manage')
  ) {
    return fail({ code: 'ACCESS_DENIED' })
  }

  return reader
}

export function requireSameOrganizationActor(
  currentUser: User | null | undefined,
  organizationId: Id,
): ServiceResult<User> {
  return requireActorInOrganization(currentUser, organizationId)
}
