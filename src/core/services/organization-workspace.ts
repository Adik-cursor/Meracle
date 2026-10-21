import type { OrganizationStatus, User } from '../types'
import { fail, ok, type ServiceResult } from '../types/domain-error'
import type { Persistence } from '../repositories/persistence'
import { PLATFORM_ORGANIZATION_ID } from '../config/platform'

export function isCompanyWorkspaceOpen(status: OrganizationStatus): boolean {
  return status === 'active'
}

export function requireCompanyWorkspaceAccess(
  persistence: Persistence,
  user: User,
): ServiceResult<User> {
  if (user.platformRole === 'platform_owner') {
    return ok(user)
  }

  const organization = persistence.organizations.getById(user.organizationId)
  if (!organization) {
    return fail({ code: 'ORGANIZATION_NOT_FOUND' })
  }

  if (organization.id === PLATFORM_ORGANIZATION_ID) {
    return ok(user)
  }

  if (organization.status === 'archived') {
    return fail({ code: 'ORGANIZATION_ARCHIVED' })
  }

  if (!isCompanyWorkspaceOpen(organization.status)) {
    return fail({ code: 'ORGANIZATION_SUSPENDED' })
  }

  return ok(user)
}
