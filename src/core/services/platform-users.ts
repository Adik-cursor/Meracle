import type { Branch, Department, Id, Organization, User, UserRole, Warehouse } from '../types'
import { USER_ROLES } from '../types'
import { fail, ok, type ServiceResult } from '../types/domain-error'
import type { Persistence } from '../repositories/persistence'
import { PLATFORM_ORGANIZATION_ID } from '../config/platform'
import { denyUnless, requireCurrentUser } from './access'
import { isPlatformOwner } from './organization-modules'
import { createUser, type UserWrite } from './users'

export type PlatformCompanyPeopleView = {
  organization: Organization
  users: User[]
  branches: Branch[]
  departments: Department[]
  warehouses: Warehouse[]
}

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

function requireCompanyOrganization(
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

export function canAssignCompanyRoleForPlatformUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  organizationId: Id,
  role: UserRole,
): boolean {
  if (!isPlatformOwner(currentUser)) {
    return false
  }

  if (!USER_ROLES.includes(role)) {
    return false
  }

  if (role === 'owner') {
    if (organizationId === PLATFORM_ORGANIZATION_ID) {
      return false
    }

    const organization = persistence.organizations.getById(organizationId)
    if (!organization) {
      return false
    }

    return !persistence.users
      .list(organizationId)
      .some((user) => user.role === 'owner')
  }

  return true
}

export function getCompanyPeopleForPlatformUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  organizationId: Id,
): ServiceResult<PlatformCompanyPeopleView> {
  const actor = requirePlatformActor(currentUser)
  if (!actor.ok) {
    return actor
  }

  const organization = requireCompanyOrganization(persistence, organizationId)
  if (!organization.ok) {
    return organization
  }

  return ok({
    organization: organization.value,
    users: persistence.users.list(organizationId),
    branches: persistence.branches.list(organizationId),
    departments: persistence.departments.list(organizationId),
    warehouses: persistence.warehouses.list(organizationId),
  })
}

export function createUserForPlatformUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  organizationId: Id,
  draft: UserWrite,
): ServiceResult<User> {
  const actor = requirePlatformActor(currentUser)
  if (!actor.ok) {
    return actor
  }

  const organization = requireCompanyOrganization(persistence, organizationId)
  if (!organization.ok) {
    return organization
  }

  const roleAllowed = denyUnless(
    canAssignCompanyRoleForPlatformUser(
      persistence,
      actor.value,
      organization.value.id,
      draft.role,
    ),
  )
  if (!roleAllowed.ok) {
    return roleAllowed
  }

  return createUser(persistence, organization.value.id, {
    firstName: draft.firstName,
    lastName: draft.lastName,
    email: draft.email,
    role: draft.role,
    status: draft.status,
    phone: draft.phone,
    jobTitle: draft.jobTitle,
    managerId: draft.managerId,
    branchId: draft.branchId,
    departmentId: draft.departmentId,
    warehouseId: draft.warehouseId,
    salaryAmount: draft.salaryAmount,
  })
}

export function getCompanyUserForPlatformUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  organizationId: Id,
  userId: Id,
): ServiceResult<User> {
  const people = getCompanyPeopleForPlatformUser(
    persistence,
    currentUser,
    organizationId,
  )
  if (!people.ok) {
    return people
  }

  const user = people.value.users.find((item) => item.id === userId)
  if (!user) {
    return fail({ code: 'USER_NOT_FOUND' })
  }

  return ok(user)
}
