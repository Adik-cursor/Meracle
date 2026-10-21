import type { Id, User, UserRole } from '../types'
import { createInMemoryPersistence } from '../repositories/in-memory/create-in-memory-persistence'
import type { Persistence } from '../repositories/persistence'
import { login } from './auth'
import { listAttendanceEmployeesForUser, markAttendanceForUser } from './attendance'
import { createCareGroupForUser } from './care-groups'
import { getCompanyDashboardForUser } from './company-dashboard'
import { todayExpenseDateInput } from './expenses'
import { seedEnabledBusinessModules } from './organization-modules'
import { newId, nowIso } from './primitives'
import { isUserAccountEnabled } from './user-account'
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

export function runKindergartenEmployeeAccountsChecks(): void {
  const persistence = createInMemoryPersistence()
  const orgA = 'org-acc-a'
  const orgB = 'org-acc-b'
  addOrg(persistence, orgA, 'Ясмин')
  addOrg(persistence, orgB, 'Sad B')
  seedEnabledBusinessModules(persistence, orgA, 'seed', [
    'children',
    'attendance',
    'crm',
    'expenses',
    'analytics',
  ])
  seedEnabledBusinessModules(persistence, orgB, 'seed', ['children', 'attendance', 'crm'])
  const ownerA = addUser(persistence, orgA, 'owner')
  const ownerB = addUser(persistence, orgB, 'owner')

  assert(isUserAccountEnabled(ownerA), 'owner account enabled')
  assert(login(persistence, ownerA.id).ok, 'owner can login')

  const seniors = createCareGroupForUser(persistence, ownerA, {
    name: 'Старшая',
    capacity: 12,
    status: 'active',
  })
  const nursery = createCareGroupForUser(persistence, ownerA, {
    name: 'Ясельная',
    capacity: 8,
    status: 'active',
  })
  const foreign = createCareGroupForUser(persistence, ownerB, {
    name: 'Старшая',
    capacity: 10,
    status: 'active',
  })
  assert(seniors.ok && nursery.ok && foreign.ok, 'groups')

  const admin = createUserForUser(persistence, ownerA, orgA, {
    firstName: 'Зарина',
    lastName: 'Ахметова',
    email: 'demo-user-004@example.com',
    role: 'kindergarten_admin',
    status: 'active',
    jobTitle: 'Заведующий',
  })
  assert(admin.ok, 'administrator created')
  assert(admin.value.role === 'kindergarten_admin', 'administrator role')
  assert(admin.value.accountEnabled === true, 'administrator account yes')
  assert(admin.value.jobTitle === 'Заведующий', 'administrator job title')
  assert(login(persistence, admin.value.id).ok, 'administrator can login')

  const educator = createUserForUser(persistence, admin.value, orgA, {
    firstName: 'Айдана',
    lastName: 'Каримова',
    role: 'office_employee',
    status: 'active',
    jobTitle: 'Воспитатель',
    careGroupId: seniors.value.id,
  })
  assert(educator.ok, 'educator without email')
  assert(educator.value.accountEnabled === false, 'educator no account')
  assert(educator.value.careGroupId === seniors.value.id, 'educator group')
  assert(!login(persistence, educator.value.id).ok, 'educator login blocked')
  assert(
    !getCompanyDashboardForUser(persistence, educator.value).ok,
    'educator cannot use dashboard as actor',
  )

  const nanny = createUserForUser(persistence, ownerA, orgA, {
    firstName: 'Мадина',
    lastName: 'Няня',
    role: 'office_employee',
    status: 'active',
    jobTitle: 'Няня',
    careGroupId: nursery.value.id,
  })
  assert(nanny.ok && nanny.value.accountEnabled === false, 'nanny no account')
  assert(nanny.value.careGroupId === nursery.value.id, 'nanny group')

  const cook = createUserForUser(persistence, ownerA, orgA, {
    firstName: 'Асель',
    lastName: 'Повар',
    role: 'office_employee',
    status: 'active',
    jobTitle: 'Повар',
  })
  assert(cook.ok && cook.value.accountEnabled === false && !cook.value.careGroupId, 'cook')

  const helper = createUserForUser(persistence, ownerA, orgA, {
    firstName: 'Бакыт',
    lastName: 'Помощник',
    role: 'office_employee',
    status: 'active',
    jobTitle: 'Помощник повара',
  })
  assert(helper.ok && helper.value.accountEnabled === false, 'cook helper')

  const cleaner = createUserForUser(persistence, ownerA, orgA, {
    firstName: 'Гульнар',
    lastName: 'Техничка',
    role: 'office_employee',
    status: 'active',
    jobTitle: 'Техничка',
  })
  assert(cleaner.ok && cleaner.value.accountEnabled === false, 'cleaner')

  const stolenGroup = createUserForUser(persistence, ownerA, orgA, {
    firstName: 'Чужая',
    lastName: 'Группа',
    role: 'office_employee',
    status: 'active',
    jobTitle: 'Воспитатель',
    careGroupId: foreign.value.id,
  })
  assert(!stolenGroup.ok, 'cross-org group rejected')

  const snap = persistence.capture()
  snap.restore()
  assert(persistence.users.getById(educator.value.id)?.accountEnabled === false, 'F5 no account')
  assert(persistence.users.getById(educator.value.id)?.careGroupId === seniors.value.id, 'F5 group')
  assert(persistence.users.getById(admin.value.id)?.accountEnabled === true, 'F5 admin account')

  const today = todayExpenseDateInput()
  const staffMark = markAttendanceForUser(persistence, admin.value, {
    employeeId: educator.value.id,
    date: today,
    status: 'present',
  })
  assert(staffMark.ok, 'admin can mark employee attendance without employee login')
  const staffList = listAttendanceEmployeesForUser(persistence, admin.value)
  assert(
    staffList.ok && staffList.value.some((user) => user.id === educator.value.id),
    'staff without account listed for attendance',
  )

  const listedB = listAttendanceEmployeesForUser(persistence, ownerB)
  assert(
    listedB.ok && listedB.value.every((user) => user.organizationId === orgB),
    'org isolation of employees',
  )

  const dental = 'org-acc-dental'
  addOrg(persistence, dental, 'Dental')
  seedEnabledBusinessModules(persistence, dental, 'seed')
  const dentalOwner = addUser(persistence, dental, 'owner')
  const dentalStaff = createUserForUser(persistence, dentalOwner, dental, {
    firstName: 'Алия',
    lastName: 'Менеджер',
    email: 'demo-user-007@example.com',
    role: 'office_employee',
    status: 'active',
    jobTitle: 'Администратор',
  })
  assert(dentalStaff.ok, 'dental staff created')
  assert(isUserAccountEnabled(dentalStaff.value), 'dental staff keeps account')
  assert(login(persistence, dentalStaff.value.id).ok, 'dental staff can login')

  console.log('kindergarten-employee-accounts.verify: ok')
}

runKindergartenEmployeeAccountsChecks()
