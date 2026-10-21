import type { Id, Organization, OrganizationStatus, User } from '../types'
import { fail, ok, type ServiceResult } from '../types/domain-error'
import type { Persistence } from '../repositories/persistence'
import { PLATFORM_ORGANIZATION_ID } from '../config/platform'
import { requireCurrentUser } from './access'
import { isPlatformOwner } from './organization-modules'
import { newId, nowIso } from './primitives'

export const COMPANY_LIFECYCLE_ACTIONS = [
  'COMPANY_SUSPENDED',
  'COMPANY_REACTIVATED',
  'COMPANY_ARCHIVED',
  'COMPANY_RESTORED',
] as const

export type CompanyLifecycleAction = (typeof COMPANY_LIFECYCLE_ACTIONS)[number]

function requirePlatformActor(
  currentUser: User | null | undefined,
): ServiceResult<User> {
  const actor = requireCurrentUser(currentUser)
  if (!actor.ok) {
    return actor
  }
  if (!isPlatformOwner(actor.value)) {
    return fail({ code: 'ACCESS_DENIED' })
  }
  return actor
}

function requireManagedCompany(
  persistence: Persistence,
  organizationId: Id,
): ServiceResult<Organization> {
  if (organizationId === PLATFORM_ORGANIZATION_ID) {
    return fail({ code: 'ACCESS_DENIED' })
  }
  const organization = persistence.organizations.getById(organizationId)
  if (!organization) {
    return fail({ code: 'ORGANIZATION_NOT_FOUND' })
  }
  return ok(organization)
}

function recordLifecycle(
  persistence: Persistence,
  actorUserId: Id,
  organization: Organization,
  action: CompanyLifecycleAction,
  next: OrganizationStatus,
): Organization {
  const now = nowIso()
  persistence.accessChangeLogs.create({
    id: newId(),
    organizationId: organization.id,
    actorUserId,
    targetOrganizationId: organization.id,
    field: `lifecycle.${action}`,
    previousValue: organization.status,
    nextValue: next,
    createdAt: now,
    updatedAt: now,
  })
  return (
    persistence.organizations.update(organization.id, {
      status: next,
      updatedAt: now,
    }) ?? { ...organization, status: next, updatedAt: now }
  )
}

function setCompanyStatusForPlatformUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  organizationId: Id,
  action: CompanyLifecycleAction,
  allowedFrom: OrganizationStatus[],
  next: OrganizationStatus,
): ServiceResult<Organization> {
  const actor = requirePlatformActor(currentUser)
  if (!actor.ok) {
    return actor
  }
  const organization = requireManagedCompany(persistence, organizationId)
  if (!organization.ok) {
    return organization
  }
  if (!allowedFrom.includes(organization.value.status)) {
    return fail({ code: 'INVALID_INPUT' })
  }
  return ok(
    recordLifecycle(persistence, actor.value.id, organization.value, action, next),
  )
}

export function suspendCompanyForPlatformUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  organizationId: Id,
): ServiceResult<Organization> {
  return setCompanyStatusForPlatformUser(
    persistence,
    currentUser,
    organizationId,
    'COMPANY_SUSPENDED',
    ['active'],
    'suspended',
  )
}

export function reactivateCompanyForPlatformUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  organizationId: Id,
): ServiceResult<Organization> {
  return setCompanyStatusForPlatformUser(
    persistence,
    currentUser,
    organizationId,
    'COMPANY_REACTIVATED',
    ['suspended', 'inactive'],
    'active',
  )
}

export function archiveCompanyForPlatformUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  organizationId: Id,
): ServiceResult<Organization> {
  return setCompanyStatusForPlatformUser(
    persistence,
    currentUser,
    organizationId,
    'COMPANY_ARCHIVED',
    ['active', 'suspended', 'inactive'],
    'archived',
  )
}

export function restoreCompanyForPlatformUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  organizationId: Id,
): ServiceResult<Organization> {
  return setCompanyStatusForPlatformUser(
    persistence,
    currentUser,
    organizationId,
    'COMPANY_RESTORED',
    ['archived'],
    'active',
  )
}
