import type { Id, User, UserRole } from '../types'
import { createInMemoryPersistence } from '../repositories/in-memory/create-in-memory-persistence'
import type { Persistence } from '../repositories/persistence'
import { createCareGroupForUser } from './care-groups'
import { createChildForUser, listChildrenForGroupForUser } from './children'
import { seedEnabledBusinessModules } from './organization-modules'
import { newId, nowIso } from './primitives'

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

export function runKindergartenGroupMembersChecks(): void {
  const persistence = createInMemoryPersistence()
  const orgA = 'org-group-a'
  const orgB = 'org-group-b'
  addOrg(persistence, orgA, 'Ясмин')
  addOrg(persistence, orgB, 'Other')
  seedEnabledBusinessModules(persistence, orgA, 'seed', ['children', 'attendance', 'crm'])
  seedEnabledBusinessModules(persistence, orgB, 'seed', ['children', 'attendance', 'crm'])
  const ownerA = addUser(persistence, orgA, 'owner')
  const ownerB = addUser(persistence, orgB, 'owner')

  const nursery = createCareGroupForUser(persistence, ownerA, {
    name: 'Ясли',
    capacity: 20,
    status: 'active',
  })
  assert(nursery.ok, 'group created')
  const child = createChildForUser(persistence, ownerA, {
    firstName: 'Али',
    lastName: 'Нур',
    birthDate: '2024-03-01',
    groupId: nursery.value.id,
    status: 'attending',
    parentFullName: 'Айгуль Нур',
    parentPhone: '87001112233',
  })
  assert(child.ok && child.value.groupId === nursery.value.id, 'child belongs to group')

  const members = listChildrenForGroupForUser(persistence, ownerA, nursery.value.id)
  assert(members.ok && members.value.length === 1, 'child appears in group list')
  assert(members.value[0]?.id === child.value.id, 'same child record')
  assert(members.value[0]?.status === 'attending', 'attending child is listed')

  const cross = listChildrenForGroupForUser(persistence, ownerB, nursery.value.id)
  assert(!cross.ok, 'cross-org group members denied')

  const snap = persistence.capture()
  snap.restore()
  const after = listChildrenForGroupForUser(persistence, ownerA, nursery.value.id)
  assert(
    after.ok && after.value.some((item) => item.id === child.value.id),
    'F5 child stays in group',
  )

  console.log('kindergarten-group-members.verify: ok')
}

runKindergartenGroupMembersChecks()
