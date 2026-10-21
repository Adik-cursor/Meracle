import type { Id, User, UserRole } from '../types'
import { createInMemoryPersistence } from '../repositories/in-memory/create-in-memory-persistence'
import type { Persistence } from '../repositories/persistence'
import { login } from './auth'
import { createCareGroupForUser } from './care-groups'
import { getCompanyDashboardForUser } from './company-dashboard'
import { seedEnabledBusinessModules } from './organization-modules'
import { newId, nowIso } from './primitives'
import { isUserAccountEnabled } from './user-account'
import {
  createUserForUser,
  disableAccountForUser,
  enableAccountForUser,
} from './users'

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
  extra?: Partial<User>,
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
    ...extra,
  }
  persistence.users.create(user)
  return user
}

export function runEmployeeAccountChecks(): void {
  const persistence = createInMemoryPersistence()
  const orgA = 'org-emp-acc-a'
  const orgB = 'org-emp-acc-b'
  addOrg(persistence, orgA, 'Ясмин')
  addOrg(persistence, orgB, 'Other')
  seedEnabledBusinessModules(persistence, orgA, 'seed', [
    'children',
    'attendance',
    'crm',
    'expenses',
    'analytics',
  ])
  seedEnabledBusinessModules(persistence, orgB, 'seed', ['children', 'attendance', 'crm'])

  const ownerA = addUser(persistence, orgA, 'owner')
  addUser(persistence, orgB, 'owner')
  const seniors = createCareGroupForUser(persistence, ownerA, {
    name: 'Старшая',
    capacity: 12,
    status: 'active',
  })
  assert(seniors.ok, 'care group')

  const educator = createUserForUser(persistence, ownerA, orgA, {
    firstName: 'Айгуль',
    lastName: 'Воспитатель',
    role: 'office_employee',
    status: 'active',
    phone: '+77010000001',
    jobTitle: 'Воспитатель',
    careGroupId: seniors.value.id,
    accountEnabled: false,
  })
  assert(educator.ok && educator.value.accountEnabled === false, 'employee without account')
  assert(!isUserAccountEnabled(educator.value), 'account disabled flag')
  assert(!login(persistence, educator.value.id).ok, 'no login without account')
  const dashDenied = getCompanyDashboardForUser(persistence, educator.value)
  assert(!dashDenied.ok, 'no dashboard without account')

  const withAccount = createUserForUser(persistence, ownerA, orgA, {
    firstName: 'Мадина',
    lastName: 'Админ',
    email: 'demo-user-004@example.com',
    role: 'kindergarten_admin',
    status: 'active',
    phone: '+77010000002',
    jobTitle: 'Заведующий',
    accountEnabled: true,
  })
  assert(withAccount.ok && isUserAccountEnabled(withAccount.value), 'employee with account')
  assert(login(persistence, withAccount.value.id).ok, 'admin can login')

  const later = enableAccountForUser(
    persistence,
    ownerA,
    orgA,
    educator.value.id,
    'demo-user-024@example.com',
  )
  assert(later.ok && later.value.accountEnabled === true, 'create account later')
  assert(later.value.id === educator.value.id, 'same employee record')
  assert(login(persistence, later.value.id).ok, 'login after enable')

  const disabled = disableAccountForUser(persistence, ownerA, orgA, later.value.id)
  assert(disabled.ok && disabled.value.accountEnabled === false, 'disable account')
  assert(disabled.value.firstName === 'Айгуль', 'name kept')
  assert(disabled.value.phone === '+77010000001', 'phone kept')
  assert(disabled.value.jobTitle === 'Воспитатель', 'job kept')
  assert(!login(persistence, later.value.id).ok, 'login blocked after disable')

  const ownerBlock = disableAccountForUser(persistence, ownerA, orgA, ownerA.id)
  assert(!ownerBlock.ok, 'cannot disable owner')

  const snap = persistence.capture()
  snap.restore()
  assert(persistence.users.getById(educator.value.id)?.accountEnabled === false, 'F5 no account')
  assert(persistence.users.getById(withAccount.value.id)?.accountEnabled === true, 'F5 with account')

  const dental = 'org-emp-acc-dental'
  addOrg(persistence, dental, 'Dental')
  seedEnabledBusinessModules(persistence, dental, 'seed', [
    'crm',
    'sales',
    'warehouse',
    'attendance',
  ])
  const dentalOwner = addUser(persistence, dental, 'owner')
  const courier = createUserForUser(persistence, dentalOwner, dental, {
    firstName: 'Иван',
    lastName: 'Курьер',
    role: 'office_employee',
    status: 'active',
    phone: '+77010000003',
    jobTitle: 'Курьер',
    accountEnabled: false,
  })
  assert(courier.ok && courier.value.accountEnabled === false, 'dental employee without account')
  assert(!login(persistence, courier.value.id).ok, 'dental courier cannot login')

  const manager = createUserForUser(persistence, dentalOwner, dental, {
    firstName: 'Алия',
    lastName: 'Менеджер',
    email: 'demo-user-007@example.com',
    role: 'office_employee',
    status: 'active',
    phone: '+77010000004',
    jobTitle: 'Менеджер',
    accountEnabled: true,
  })
  assert(manager.ok && isUserAccountEnabled(manager.value), 'dental manager has account')
  assert(login(persistence, manager.value.id).ok, 'dental manager login')

  const enabledCourier = enableAccountForUser(
    persistence,
    dentalOwner,
    dental,
    courier.value.id,
    'demo-user-016@example.com',
  )
  assert(enabledCourier.ok && enabledCourier.value.accountEnabled === true, 'enable dental later')

  const cross = enableAccountForUser(
    persistence,
    ownerA,
    orgA,
    courier.value.id,
    'demo-user-053@example.com',
  )
  assert(!cross.ok, 'cross-org enable denied')

  console.log('employee-account.verify: ok')
}

runEmployeeAccountChecks()
