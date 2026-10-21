import type { User } from '../types'
import { createInMemoryPersistence } from '../repositories/in-memory/create-in-memory-persistence'
import { PLATFORM_ORGANIZATION_ID } from '../config/platform'
import { newId, nowIso } from './primitives'
import { listLoginUserRows } from './login-users'
import { seedEnabledBusinessModules } from './organization-modules'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

export function runPlatformUsersByOrganizationChecks(): void {
  const persistence = createInMemoryPersistence()
  const now = nowIso()
  persistence.organizations.create({
    id: PLATFORM_ORGANIZATION_ID,
    organizationId: PLATFORM_ORGANIZATION_ID,
    name: 'Platform',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  })
  persistence.users.create({
    id: newId(),
    organizationId: PLATFORM_ORGANIZATION_ID,
    email: 'platform@local',
    firstName: 'Platform',
    lastName: 'Owner',
    role: 'office_employee',
    platformRole: 'platform_owner',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  })
  for (const [id, name] of [
    ['org-dsk', 'DSK'],
    ['org-dentis', 'Dentis'],
  ] as const) {
    persistence.organizations.create({
      id,
      organizationId: id,
      name,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    })
    seedEnabledBusinessModules(persistence, id, 'seed', ['crm'])
    const user: User = {
      id: newId(),
      organizationId: id,
      email: `${id}@local`,
      firstName: name,
      lastName: 'Employee',
      role: 'sales_employee',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    }
    persistence.users.create(user)
  }

  const rows = listLoginUserRows(persistence)
  const platform = rows.find((row) => row.isPlatform)
  const dsk = rows.find((row) => row.organizationName === 'DSK')
  const dentis = rows.find((row) => row.organizationName === 'Dentis')
  assert(platform, 'platform owner on login')
  assert(dsk && dsk.user.organizationId === 'org-dsk', 'dsk employee mapped')
  assert(dentis && dentis.user.organizationId === 'org-dentis', 'dentis employee mapped')
  assert(rows[0]?.isPlatform, 'platform owner first')
  const dskIndex = rows.findIndex((row) => row.organizationName === 'DSK')
  const dentisIndex = rows.findIndex((row) => row.organizationName === 'Dentis')
  assert(dskIndex !== dentisIndex, 'companies visually separated by name')
  console.log('platform-users-by-organization.verify: ok')
}

runPlatformUsersByOrganizationChecks()
