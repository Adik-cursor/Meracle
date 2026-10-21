import type { Id, User, UserRole } from '../types'
import { createInMemoryPersistence } from '../repositories/in-memory/create-in-memory-persistence'
import type { Persistence } from '../repositories/persistence'
import {
  createChildForUser,
  getChildForUser,
  getChildParentForUser,
  listChildrenByParentForUser,
  updateChildForUser,
} from './children'
import { createPersonCustomerInOrganization } from './contacts'
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

export function runKindergartenParentsChecks(): void {
  const persistence = createInMemoryPersistence()
  const orgA = 'org-parent-a'
  const orgB = 'org-parent-b'
  addOrg(persistence, orgA, 'Sad A')
  addOrg(persistence, orgB, 'Sad B')
  seedEnabledBusinessModules(persistence, orgA, 'seed', ['children', 'attendance', 'crm'])
  seedEnabledBusinessModules(persistence, orgB, 'seed', ['children', 'attendance', 'crm'])

  const ownerA = addUser(persistence, orgA, 'owner')
  const ownerB = addUser(persistence, orgB, 'owner')
  const warehouse = addUser(persistence, orgA, 'warehouse_manager')
  const accountant = addUser(persistence, orgA, 'accountant')

  const first = createChildForUser(persistence, ownerA, {
    firstName: 'Анна',
    lastName: 'Иванова',
    birthDate: '2020-03-01',
    status: 'attending',
    parentFullName: 'Иванов Алексей',
    parentPhone: '87001112233',
  })
  assert(first.ok, 'create first child with parent')
  assert(first.value.parentCustomerId && first.value.parentContactId, 'parent is customer+contact')

  const customersAfterFirst = persistence.customers.list(orgA).length
  const contactsAfterFirst = persistence.contacts.list(orgA).length

  const second = createChildForUser(persistence, ownerA, {
    firstName: 'Максим',
    lastName: 'Иванов',
    birthDate: '2021-06-01',
    status: 'attending',
    parentFullName: 'Иванов Алексей',
    parentPhone: '+7 (700) 111-22-33',
  })
  assert(second.ok, 'create sibling with same phone')
  assert(
    second.value.parentCustomerId === first.value.parentCustomerId &&
      second.value.parentContactId === first.value.parentContactId,
    'duplicate phone reuses the same parent customer/contact',
  )
  assert(
    persistence.customers.list(orgA).length === customersAfterFirst,
    'no extra customer for matching phone',
  )
  assert(
    persistence.contacts.list(orgA).length === contactsAfterFirst,
    'no extra contact for matching phone',
  )

  const siblings = listChildrenByParentForUser(
    persistence,
    ownerA,
    first.value.parentCustomerId as string,
  )
  assert(
    siblings.ok &&
      siblings.value.length === 2 &&
      siblings.value.some((item) => item.id === first.value.id) &&
      siblings.value.some((item) => item.id === second.value.id),
    'one parent → multiple children',
  )

  const parentView = getChildParentForUser(persistence, ownerA, first.value.id)
  assert(
    parentView.ok &&
      parentView.value.customerId === first.value.parentCustomerId &&
      parentView.value.contactId === first.value.parentContactId &&
      Boolean(parentView.value.fullName) &&
      Boolean(parentView.value.phone),
    'child → parent view',
  )

  const otherParent = createPersonCustomerInOrganization(persistence, orgB, {
    fullName: 'Петров Пётр',
    phone: '87009998877',
  })
  assert(otherParent.ok, 'parent in org B')
  const crossBind = updateChildForUser(persistence, ownerA, first.value.id, {
    firstName: first.value.firstName,
    lastName: first.value.lastName,
    birthDate: first.value.birthDate,
    status: first.value.status,
    parentCustomerId: otherParent.value.customer.id,
  })
  assert(!crossBind.ok, 'cannot bind parent from another organization')

  const stolenParent = getChildParentForUser(persistence, ownerB, first.value.id)
  assert(!stolenParent.ok, 'org B cannot read parent of child A')
  const stolenSiblings = listChildrenByParentForUser(
    persistence,
    ownerB,
    first.value.parentCustomerId as string,
  )
  assert(!stolenSiblings.ok, 'org B cannot list children of parent A')

  const readAccountant = getChildParentForUser(persistence, accountant, first.value.id)
  assert(readAccountant.ok, 'accountant can read parent')
  const manageAccountant = updateChildForUser(persistence, accountant, first.value.id, {
    firstName: first.value.firstName,
    lastName: first.value.lastName,
    birthDate: first.value.birthDate,
    status: first.value.status,
    parentCustomerId: first.value.parentCustomerId,
    parentContactId: first.value.parentContactId,
  })
  assert(
    !manageAccountant.ok && manageAccountant.error.code === 'ACCESS_DENIED',
    'accountant cannot change parent',
  )

  const warehouseRead = getChildForUser(persistence, warehouse, first.value.id)
  assert(!warehouseRead.ok && warehouseRead.error.code === 'ACCESS_DENIED', 'warehouse rbac')

  const snapshot = persistence.capture()
  snapshot.restore()
  const restored = getChildForUser(persistence, ownerA, first.value.id)
  assert(
    restored.ok &&
      restored.value.parentCustomerId === first.value.parentCustomerId &&
      restored.value.parentContactId === first.value.parentContactId,
    'parent link persists after restore',
  )
  const restoredSiblings = listChildrenByParentForUser(
    persistence,
    ownerA,
    first.value.parentCustomerId as string,
  )
  assert(restoredSiblings.ok && restoredSiblings.value.length === 2, 'siblings persist')

  const orgOff = 'org-parent-off'
  addOrg(persistence, orgOff, 'Off')
  seedEnabledBusinessModules(persistence, orgOff, 'seed', ['crm'])
  const ownerOff = addUser(persistence, orgOff, 'owner')
  const gated = createChildForUser(persistence, ownerOff, {
    firstName: 'X',
    lastName: 'Y',
    birthDate: '2020-01-01',
    status: 'attending',
    parentFullName: 'Z Z',
    parentPhone: '87000000000',
  })
  assert(!gated.ok && gated.error.code === 'MODULE_NOT_ENABLED', 'children module gating')

  console.log('kindergarten-parents.verify: ok')
}

runKindergartenParentsChecks()
