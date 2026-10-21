import type { Id, User, UserRole } from '../types'
import { createInMemoryPersistence } from '../repositories/in-memory/create-in-memory-persistence'
import type { Persistence } from '../repositories/persistence'
import type { DomainErrorCode } from '../types/domain-error'
import { newId, nowIso } from './primitives'
import {
  canUpdateCompanyOrganization,
  updateCompanyOrganizationForUser,
} from './company-organization'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function denied(
  result: { ok: boolean; error?: { code: DomainErrorCode } },
  code: DomainErrorCode,
  message: string,
): void {
  assert(!result.ok && result.error?.code === code, message)
}

function addOrg(persistence: Persistence, id: Id, name: string): void {
  const now = nowIso()
  persistence.organizations.create({
    id,
    organizationId: id,
    name,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  })
}

function addUser(
  persistence: Persistence,
  organizationId: Id,
  role: UserRole,
): User {
  const now = nowIso()
  const user: User = {
    id: newId(),
    organizationId,
    email: `${role}-${newId()}@${organizationId}.local`,
    firstName: role,
    lastName: 'User',
    role,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  }
  persistence.users.create(user)
  return user
}

export function runCompanyOrganizationChecks(): void {
  const persistence = createInMemoryPersistence()
  const orgA = 'org-profile-a'
  const orgB = 'org-profile-b'
  addOrg(persistence, orgA, 'Alpha')
  addOrg(persistence, orgB, 'Beta')

  const ownerA = addUser(persistence, orgA, 'owner')
  const employeeA = addUser(persistence, orgA, 'sales_employee')
  const directorA = addUser(persistence, orgA, 'commercial_director')
  const ownerB = addUser(persistence, orgB, 'owner')
  const platformOrg = 'org-platform'
  addOrg(persistence, platformOrg, 'Platform')
  const platformOwner = addUser(persistence, platformOrg, 'office_employee')
  persistence.users.update(platformOwner.id, { platformRole: 'platform_owner' })
  const platformActor = persistence.users.getById(platformOwner.id)
  assert(platformActor, 'platform actor')

  assert(canUpdateCompanyOrganization(ownerA), 'owner can edit UI')
  assert(!canUpdateCompanyOrganization(employeeA), 'employee cannot edit UI')
  assert(!canUpdateCompanyOrganization(directorA), 'director cannot edit org profile')
  assert(!canUpdateCompanyOrganization(platformActor), 'platform owner is not company owner')

  const renamed = updateCompanyOrganizationForUser(persistence, ownerA, orgA, {
    name: 'Dental Shop Kazakhstan',
    bin: '000000000004',
    currency: 'KZT',
    timezone: 'Asia/Almaty',
  })
  assert(renamed.ok && renamed.value.name === 'Dental Shop Kazakhstan', 'owner can rename')
  assert(renamed.ok && renamed.value.bin === '000000000004', 'owner can set BIN')
  assert(renamed.ok && renamed.value.status === 'active', 'status stays unchanged')
  assert(renamed.ok && renamed.value.id === orgA, 'id stays unchanged')
  assert(renamed.ok && renamed.value.organizationId === orgA, 'organizationId stays unchanged')

  denied(
    updateCompanyOrganizationForUser(persistence, employeeA, orgA, {
      name: 'Hacked',
      currency: 'KZT',
      timezone: 'Asia/Almaty',
    }),
    'ACCESS_DENIED',
    'employee cannot update organization',
  )
  assert(
    persistence.organizations.getById(orgA)?.name === 'Dental Shop Kazakhstan',
    'employee update did not persist',
  )

  denied(
    updateCompanyOrganizationForUser(persistence, directorA, orgA, {
      name: 'Director Rename',
      currency: 'USD',
      timezone: 'UTC',
    }),
    'ACCESS_DENIED',
    'commercial director cannot update organization profile',
  )

  denied(
    updateCompanyOrganizationForUser(persistence, ownerA, orgB, {
      name: 'Leak',
      currency: 'KZT',
      timezone: 'Asia/Almaty',
    }),
    'ACCESS_DENIED',
    'owner cannot update another organization',
  )
  assert(persistence.organizations.getById(orgB)?.name === 'Beta', 'org B name unchanged')

  denied(
    updateCompanyOrganizationForUser(persistence, ownerB, orgA, {
      name: 'Cross',
      currency: 'KZT',
      timezone: 'Asia/Almaty',
    }),
    'ACCESS_DENIED',
    'foreign owner cannot update org A',
  )

  denied(
    updateCompanyOrganizationForUser(persistence, platformActor, orgA, {
      name: 'Platform rewrite',
      currency: 'EUR',
      timezone: 'UTC',
    }),
    'ACCESS_DENIED',
    'platform super admin does not edit company profile through company service',
  )

  denied(
    updateCompanyOrganizationForUser(persistence, ownerA, orgA, {
      name: 'Dental Shop Kazakhstan',
      currency: 'BTC',
      timezone: 'Asia/Almaty',
    }),
    'INVALID_INPUT',
    'unknown currency rejected',
  )

  denied(
    updateCompanyOrganizationForUser(persistence, ownerA, orgA, {
      name: '   ',
      currency: 'KZT',
      timezone: 'Asia/Almaty',
    }),
    'INVALID_INPUT',
    'empty name rejected',
  )

  const withBank = updateCompanyOrganizationForUser(persistence, ownerA, orgA, {
    name: 'Dental Shop Kazakhstan',
    currency: 'KZT',
    timezone: 'Asia/Almaty',
    kbe: '19',
    knp: '710',
  })
  assert(withBank.ok && withBank.value.kbe === '19', 'kbe saved on organization')
  assert(withBank.ok && withBank.value.knp === '710', 'knp saved on organization')

  const clearedBank = updateCompanyOrganizationForUser(persistence, ownerA, orgA, {
    name: 'Dental Shop Kazakhstan',
    currency: 'KZT',
    timezone: 'Asia/Almaty',
    kbe: '',
    knp: '',
  })
  assert(clearedBank.ok && !clearedBank.value.kbe, 'empty kbe stored empty')
  assert(clearedBank.ok && !clearedBank.value.knp, 'empty knp stored empty')
  assert(clearedBank.ok && clearedBank.value.kbe !== '19', 'no default kbe')
  assert(clearedBank.ok && clearedBank.value.knp !== '710', 'no default knp')

  console.log('company-organization.verify: ok')
}

runCompanyOrganizationChecks()
