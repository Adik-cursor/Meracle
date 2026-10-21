import type { Id, User, UserRole } from '../types'
import { createInMemoryPersistence } from '../repositories/in-memory/create-in-memory-persistence'
import type { Persistence } from '../repositories/persistence'
import { createCareGroupForUser } from './care-groups'
import { getCompanyDashboardForUser } from './company-dashboard'
import { seedEnabledBusinessModules } from './organization-modules'
import { newId, nowIso } from './primitives'
import { createUserForUser } from './users'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
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

export function runKindergartenDashboardAccessChecks(): void {
  const persistence = createInMemoryPersistence()
  const org = 'org-dash-acc'
  addOrg(persistence, org, 'Ясмин')
  seedEnabledBusinessModules(persistence, org, 'seed', [
    'crm',
    'expenses',
    'analytics',
    'children',
    'attendance',
  ])
  const owner = addUser(persistence, org, 'owner')
  const ownerDash = getCompanyDashboardForUser(persistence, owner)
  assert(ownerDash.ok && ownerDash.value.care, 'owner kindergarten dashboard')
  assert(!ownerDash.value.sales, 'owner has no sales dashboard')
  assert(!ownerDash.value.companyPlans, 'owner has no plans')

  const admin = createUserForUser(persistence, owner, org, {
    firstName: 'Зарина',
    lastName: 'Админ',
    email: 'demo-user-022@example.com',
    role: 'kindergarten_admin',
    status: 'active',
    jobTitle: 'Заведующий',
  })
  assert(admin.ok, 'admin')
  const group = createCareGroupForUser(persistence, admin.value, {
    name: 'Старшая',
    capacity: 10,
    status: 'active',
  })
  assert(group.ok, 'admin can create group')

  const adminDash = getCompanyDashboardForUser(persistence, admin.value)
  assert(adminDash.ok && adminDash.value.care, 'administrator kindergarten dashboard')
  assert(adminDash.value.care.groups.length === 1, 'admin sees groups')
  assert(!adminDash.value.sales, 'admin has no sales dashboard')
  assert(!adminDash.value.companyPlans, 'admin has no plans')

  const cook = createUserForUser(persistence, owner, org, {
    firstName: 'Асель',
    lastName: 'Повар',
    role: 'office_employee',
    status: 'active',
    jobTitle: 'Повар',
  })
  assert(cook.ok && cook.value.accountEnabled === false, 'cook has no account')
  const cookDash = getCompanyDashboardForUser(persistence, cook.value)
  assert(!cookDash.ok && cookDash.error.code === 'ACCESS_DENIED', 'no dashboard without account')

  console.log('kindergarten-dashboard-access.verify: ok')
}

runKindergartenDashboardAccessChecks()
