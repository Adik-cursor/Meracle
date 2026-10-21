import type { Id, User, UserRole } from '../types'
import { createInMemoryPersistence } from '../repositories/in-memory/create-in-memory-persistence'
import type { Persistence } from '../repositories/persistence'
import { markAttendanceForUser } from './attendance'
import { createCareGroupForUser, listCareGroupsForUser } from './care-groups'
import {
  assignChildToGroupForUser,
  createChildForUser,
  getChildForUser,
  listChildrenForUser,
  searchChildrenForUser,
  updateChildForUser,
} from './children'
import { todayExpenseDateInput } from './expenses'
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

export function runKindergartenChildrenChecks(): void {
  const persistence = createInMemoryPersistence()
  const orgA = 'org-care-a'
  const orgB = 'org-care-b'
  addOrg(persistence, orgA, 'Sad A')
  addOrg(persistence, orgB, 'Sad B')
  seedEnabledBusinessModules(persistence, orgA, 'seed', ['children', 'attendance', 'crm'])
  seedEnabledBusinessModules(persistence, orgB, 'seed', ['children', 'attendance', 'crm'])

  const ownerA = addUser(persistence, orgA, 'owner')
  const ownerB = addUser(persistence, orgB, 'owner')
  const warehouse = addUser(persistence, orgA, 'warehouse_manager')
  const accountant = addUser(persistence, orgA, 'accountant')

  const group = createCareGroupForUser(persistence, ownerA, {
    name: 'Средняя группа',
    capacity: 1,
    status: 'active',
  })
  assert(group.ok, 'create group')

  const snapGroup = persistence.capture()
  snapGroup.restore()
  const groupsAfter = listCareGroupsForUser(persistence, ownerA)
  assert(
    groupsAfter.ok && groupsAfter.value.some((item) => item.id === group.value.id),
    'group persists after snapshot restore',
  )

  const child = createChildForUser(persistence, ownerA, {
    firstName: 'Али',
    lastName: 'Нур',
    birthDate: '2020-05-01',
    status: 'attending',
    parentFullName: 'Айгуль Нур',
    parentPhone: '87001112233',
  })
  assert(child.ok, 'create child with parent')
  assert(child.value.parentContactId && child.value.parentCustomerId, 'parent customer+contact linked')
  assert(child.value.status === 'attending', 'legacy-compatible attending status')

  const samePhone = createChildForUser(persistence, ownerA, {
    firstName: 'Ая',
    lastName: 'Нур',
    birthDate: '2021-01-01',
    status: 'withdrawn',
    parentFullName: 'Айгуль Нур',
    parentPhone: '+7 (700) 111-22-33',
  })
  assert(samePhone.ok, 'second child with same parent phone')
  assert(
    samePhone.value.parentContactId === child.value.parentContactId,
    'parent contact is reused, not duplicated',
  )

  const assigned = assignChildToGroupForUser(
    persistence,
    ownerA,
    child.value.id,
    group.value.id,
  )
  assert(assigned.ok && assigned.value.groupId === group.value.id, 'assign to group')

  const overflow = createChildForUser(persistence, ownerA, {
    firstName: 'Дани',
    lastName: 'М',
    birthDate: '2020-02-02',
    groupId: group.value.id,
    status: 'attending',
  })
  assert(!overflow.ok && overflow.error.code === 'CARE_GROUP_FULL', 'capacity blocks extra attending child')

  const listed = listChildrenForUser(persistence, ownerA)
  assert(listed.ok && listed.value.length === 2, 'owner lists own children')

  const found = searchChildrenForUser(persistence, ownerA, { query: 'али' })
  assert(found.ok && found.value.some((item) => item.id === child.value.id), 'search by name')

  const byGroup = searchChildrenForUser(persistence, ownerA, { groupId: group.value.id })
  assert(byGroup.ok && byGroup.value.length === 1, 'filter by group')

  const byStatus = searchChildrenForUser(persistence, ownerA, { status: 'withdrawn' })
  assert(byStatus.ok && byStatus.value.length === 1, 'filter by status')

  const renamed = updateChildForUser(persistence, ownerA, child.value.id, {
    firstName: 'Алихан',
    lastName: 'Нур',
    birthDate: '2020-05-01',
    groupId: group.value.id,
    status: 'temporarily_absent',
    parentCustomerId: child.value.parentCustomerId,
    parentContactId: child.value.parentContactId,
  })
  assert(renamed.ok && renamed.value.firstName === 'Алихан', 'edit child')
  assert(renamed.value.status === 'temporarily_absent', 'status update')

  const snapshot = persistence.capture()
  snapshot.restore()
  const afterRestore = getChildForUser(persistence, ownerA, child.value.id)
  assert(
    afterRestore.ok &&
      afterRestore.value.firstName === 'Алихан' &&
      afterRestore.value.groupId === group.value.id &&
      afterRestore.value.status === 'temporarily_absent',
    'snapshot restore keeps edited child',
  )

  const today = todayExpenseDateInput()
  const marked = markAttendanceForUser(persistence, ownerA, {
    childId: child.value.id,
    date: today,
    status: 'present',
  })
  assert(marked.ok && marked.value?.status === 'present', 'attendance linked to child')

  const other = listChildrenForUser(persistence, ownerB)
  assert(other.ok && other.value.length === 0, 'cross-org isolation')
  const stolen = getChildForUser(persistence, ownerB, child.value.id)
  assert(!stolen.ok, 'cross-org read denied')
  const stolenUpdate = updateChildForUser(persistence, ownerB, child.value.id, {
    firstName: 'X',
    lastName: 'Y',
    birthDate: '2020-01-01',
    status: 'attending',
  })
  assert(!stolenUpdate.ok, 'cross-org write denied')

  const createDenied = createChildForUser(persistence, warehouse, {
    firstName: 'X',
    lastName: 'Y',
    birthDate: '2020-01-01',
    status: 'attending',
  })
  assert(!createDenied.ok && createDenied.error.code === 'ACCESS_DENIED', 'rbac manage')

  const readAccountant = listChildrenForUser(persistence, accountant)
  assert(readAccountant.ok, 'accountant can read children')
  const manageAccountant = createCareGroupForUser(persistence, accountant, {
    name: 'Нет',
    capacity: 10,
    status: 'active',
  })
  assert(
    !manageAccountant.ok && manageAccountant.error.code === 'ACCESS_DENIED',
    'accountant cannot manage',
  )

  const orgOff = 'org-care-off'
  addOrg(persistence, orgOff, 'Off')
  seedEnabledBusinessModules(persistence, orgOff, 'seed', ['crm'])
  const ownerOff = addUser(persistence, orgOff, 'owner')
  const moduleOff = listCareGroupsForUser(persistence, ownerOff)
  assert(
    !moduleOff.ok && moduleOff.error.code === 'MODULE_NOT_ENABLED',
    'children module off',
  )

  const legacy = persistence.children.create({
    id: newId(),
    organizationId: orgA,
    firstName: 'Legacy',
    lastName: 'Kid',
    birthDate: '2019-01-01',
    status: 'active' as never,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  })
  const migrated = persistence.capture()
  migrated.restore()
  const legacyChild = persistence.children.getById(legacy.id)
  assert(legacyChild?.status === 'attending', 'legacy active status migrates')

  console.log('kindergarten-children.verify: ok')
}

runKindergartenChildrenChecks()
