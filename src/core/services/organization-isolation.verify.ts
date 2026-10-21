import type { Id, User, UserRole } from '../types'
import { createInMemoryPersistence } from '../repositories/in-memory/create-in-memory-persistence'
import type { Persistence } from '../repositories/persistence'
import { getCareOperationsSnapshotForUser } from './care-analytics'
import { createCareChargeForUser, createCareChargePaymentForUser } from './care-finance'
import { createCareGroupForUser, listCareGroupsForUser } from './care-groups'
import { createChildForUser, listChildrenForGroupForUser, listChildrenForUser } from './children'
import { getCompanyDashboardForUser } from './company-dashboard'
import { currentMotivationPeriodKey } from './employee-motivation'
import { createExpenseForUser, listExpensesForUser, todayExpenseDateInput } from './expenses'
import { getEmployeeCompensationForUser } from './employee-compensation'
import { listUsersForUser } from './users'
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

export function runOrganizationIsolationChecks(): void {
  const persistence = createInMemoryPersistence()
  const orgA = 'org-iso-a'
  const orgB = 'org-iso-b'
  addOrg(persistence, orgA, 'A')
  addOrg(persistence, orgB, 'B')
  seedEnabledBusinessModules(persistence, orgA, 'seed', [
    'children',
    'attendance',
    'crm',
    'expenses',
    'analytics',
  ])
  seedEnabledBusinessModules(persistence, orgB, 'seed', [
    'children',
    'attendance',
    'crm',
    'expenses',
    'analytics',
  ])
  const ownerA = addUser(persistence, orgA, 'owner')
  const ownerB = addUser(persistence, orgB, 'owner')
  const period = currentMotivationPeriodKey()

  const groupA = createCareGroupForUser(persistence, ownerA, {
    name: 'Ясли A',
    capacity: 10,
    status: 'active',
  })
  const groupB = createCareGroupForUser(persistence, ownerB, {
    name: 'Ясли B',
    capacity: 10,
    status: 'active',
  })
  assert(groupA.ok && groupB.ok, 'groups')
  const childA = createChildForUser(persistence, ownerA, {
    firstName: 'Али',
    lastName: 'A',
    birthDate: '2020-01-01',
    groupId: groupA.value.id,
    status: 'attending',
    parentFullName: 'Parent A',
    parentPhone: '87001110001',
  })
  const childB = createChildForUser(persistence, ownerB, {
    firstName: 'Бек',
    lastName: 'B',
    birthDate: '2020-01-01',
    groupId: groupB.value.id,
    status: 'attending',
    parentFullName: 'Parent B',
    parentPhone: '87001110002',
  })
  assert(childA.ok && childB.ok, 'children')

  const listedA = listChildrenForUser(persistence, ownerA)
  assert(listedA.ok && listedA.value.every((item) => item.organizationId === orgA), 'children A only')
  const groupsA = listCareGroupsForUser(persistence, ownerA)
  assert(groupsA.ok && groupsA.value.every((item) => item.organizationId === orgA), 'groups A only')
  assert(
    !listChildrenForGroupForUser(persistence, ownerA, groupB.value.id).ok,
    'cannot list other org group members',
  )

  const chargeA = createCareChargeForUser(persistence, ownerA, {
    childId: childA.value.id,
    amount: 150_000,
    period,
  })
  const chargeB = createCareChargeForUser(persistence, ownerB, {
    childId: childB.value.id,
    amount: 90_000,
    period,
  })
  assert(chargeA.ok && chargeB.ok, 'charges')
  assert(
    createCareChargePaymentForUser(persistence, ownerA, {
      childId: childA.value.id,
      careChargeId: chargeA.value.id,
      amount: 150_000,
    }).ok,
    'pay A',
  )
  assert(
    createCareChargePaymentForUser(persistence, ownerB, {
      childId: childB.value.id,
      careChargeId: chargeB.value.id,
      amount: 90_000,
    }).ok,
    'pay B',
  )
  assert(
    !createCareChargePaymentForUser(persistence, ownerA, {
      childId: childB.value.id,
      careChargeId: chargeB.value.id,
      amount: 1_000,
    }).ok,
    'cannot pay other org charge',
  )

  const dashA = getCompanyDashboardForUser(persistence, ownerA, period)
  const dashB = getCompanyDashboardForUser(persistence, ownerB, period)
  assert(dashA.ok && dashA.value.care?.paidAmount === 150_000, 'A paid isolated')
  assert(dashB.ok && dashB.value.care?.paidAmount === 90_000, 'B paid isolated')

  const snapA = getCareOperationsSnapshotForUser(persistence, ownerA, todayExpenseDateInput())
  const snapB = getCareOperationsSnapshotForUser(persistence, ownerB, todayExpenseDateInput())
  assert(snapA.ok && snapA.value.enrolled === 1, 'analytics A children')
  assert(snapB.ok && snapB.value.enrolled === 1, 'analytics B children')
  assert(
    snapA.value.groups.every((group) => group.id === groupA.value.id),
    'analytics A groups only',
  )

  assert(
    createExpenseForUser(persistence, ownerA, orgA, {
      category: 'rent',
      description: 'A rent',
      amount: 10_000,
      date: todayExpenseDateInput(),
    }).ok,
    'expense A',
  )
  assert(
    createExpenseForUser(persistence, ownerB, orgB, {
      category: 'rent',
      description: 'B rent',
      amount: 20_000,
      date: todayExpenseDateInput(),
    }).ok,
    'expense B',
  )
  const expensesA = listExpensesForUser(persistence, ownerA)
  const expensesB = listExpensesForUser(persistence, ownerB)
  assert(expensesA.ok && expensesA.value.every((item) => item.organizationId === orgA), 'expenses A only')
  assert(expensesB.ok && expensesB.value.every((item) => item.organizationId === orgB), 'expenses B only')
  assert(expensesA.value.reduce((sum, item) => sum + item.amount, 0) === 10_000, 'expense amount A')
  assert(expensesB.value.reduce((sum, item) => sum + item.amount, 0) === 20_000, 'expense amount B')

  const usersA = listUsersForUser(persistence, ownerA)
  const usersB = listUsersForUser(persistence, ownerB)
  assert(usersA.ok && usersA.value.every((item) => item.organizationId === orgA), 'employees A only')
  assert(usersB.ok && usersB.value.every((item) => item.organizationId === orgB), 'employees B only')

  const crossPayroll = getEmployeeCompensationForUser(persistence, ownerB, ownerA.id, period)
  assert(!crossPayroll.ok, 'payroll isolated by organization')

  console.log('organization-isolation.verify: ok')
}

runOrganizationIsolationChecks()
