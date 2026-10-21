import type { Id, Session, User } from '../types'
import { fail, ok, okVoid, type ServiceResult } from '../types/domain-error'
import type { Persistence } from '../repositories/persistence'
import { newId, nowIso } from './primitives'
import { isUserAccountEnabled } from './user-account'
import { requireCompanyWorkspaceAccess } from './organization-workspace'
import { DEMO_MODE } from '../config/demo-mode'

function invalidateSession(persistence: Persistence): void {
  persistence.auth.clearSession()
}

export function login(
  persistence: Persistence,
  userId: Id,
): ServiceResult<User> {
  const user = persistence.users.getById(userId)

  if (!user) {
    return fail({ code: 'USER_NOT_FOUND' })
  }

  if (DEMO_MODE && user.platformRole === 'platform_owner') {
    return fail({ code: 'ACCESS_DENIED' })
  }

  if (user.status !== 'active') {
    return fail({ code: 'USER_INACTIVE' })
  }

  if (!isUserAccountEnabled(user)) {
    return fail({ code: 'ACCESS_DENIED' })
  }

  const workspace = requireCompanyWorkspaceAccess(persistence, user)
  if (!workspace.ok) {
    return workspace
  }

  persistence.auth.clearSession()
  const signedInAt = nowIso()
  persistence.auth.createSession({
    id: newId(),
    userId: user.id,
    organizationId: user.organizationId,
    createdAt: signedInAt,
  })
  persistence.users.update(user.id, {
    lastLoginAt: signedInAt,
    updatedAt: signedInAt,
  })
  const signedIn = persistence.users.getById(user.id)

  return ok(signedIn ?? { ...user, lastLoginAt: signedInAt, updatedAt: signedInAt })
}

export function logout(persistence: Persistence): ServiceResult {
  persistence.auth.clearSession()
  return okVoid()
}

export function getCurrentUser(
  persistence: Persistence,
  expectedOrganizationId?: Id,
): ServiceResult<User> {
  const session = persistence.auth.getSession()

  if (!session) {
    return fail({ code: 'CURRENT_USER_REQUIRED' })
  }

  const user = persistence.users.getById(session.userId)

  if (!user) {
    invalidateSession(persistence)
    return fail({ code: 'USER_NOT_FOUND' })
  }

  if (user.organizationId !== session.organizationId) {
    invalidateSession(persistence)
    return fail({ code: 'ACCESS_DENIED' })
  }

  if (
    expectedOrganizationId &&
    user.organizationId !== expectedOrganizationId
  ) {
    invalidateSession(persistence)
    return fail({ code: 'ACCESS_DENIED' })
  }

  if (user.status !== 'active') {
    invalidateSession(persistence)
    return fail({ code: 'USER_INACTIVE' })
  }

  if (!isUserAccountEnabled(user)) {
    invalidateSession(persistence)
    return fail({ code: 'ACCESS_DENIED' })
  }

  const workspace = requireCompanyWorkspaceAccess(persistence, user)
  if (!workspace.ok) {
    invalidateSession(persistence)
    return workspace
  }

  return ok(user)
}

export function getSession(persistence: Persistence): Session | undefined {
  return persistence.auth.getSession()
}
