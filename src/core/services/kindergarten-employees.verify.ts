import type { Id, User, UserRole } from '../types'
import { createInMemoryPersistence } from '../repositories/in-memory/create-in-memory-persistence'
import type { Persistence } from '../repositories/persistence'
import { KINDERGARTEN_JOB_TITLES } from '../config/kindergarten-job-titles'
import { listAttendanceEmployeesForUser } from './attendance'
import { createCareGroupForUser } from './care-groups'
import {
  createUserForUser,
  filterUsersForUser,
  searchUsersForUser,
  updateUserForUser,
} from './users'
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

export function runKindergartenEmployeesChecks(): void {
  assert(KINDERGARTEN_JOB_TITLES.length === 6, '1 kindergarten job titles count')
  assert(KINDERGARTEN_JOB_TITLES.includes('Заведующий'), '1 director title')
  assert(KINDERGARTEN_JOB_TITLES.includes('Воспитатель'), '1 educator title')
  assert(KINDERGARTEN_JOB_TITLES.includes('Няня'), '1 nanny title')
  assert(KINDERGARTEN_JOB_TITLES.includes('Повар'), '1 cook title')
  assert(KINDERGARTEN_JOB_TITLES.includes('Помощник повара'), '1 cook helper title')
  assert(KINDERGARTEN_JOB_TITLES.includes('Техничка'), '1 cleaner title')

  const persistence = createInMemoryPersistence()
  const orgA = 'org-emp-a'
  const orgB = 'org-emp-b'
  addOrg(persistence, orgA, 'Ясмин')
  addOrg(persistence, orgB, 'Sad B')
  seedEnabledBusinessModules(persistence, orgA, 'seed', [
    'children',
    'attendance',
    'crm',
    'expenses',
  ])
  seedEnabledBusinessModules(persistence, orgB, 'seed', ['children', 'attendance', 'crm'])
  const ownerA = addUser(persistence, orgA, 'owner')
  const ownerB = addUser(persistence, orgB, 'owner')

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
  assert(seniors.ok && nursery.ok && foreign.ok, '8 live groups')

  const noEducator = createUserForUser(persistence, ownerA, orgA, {
    firstName: 'Айдана',
    lastName: 'Каримова',
    email: 'demo-user-005@example.com',
    role: 'office_employee',
    status: 'active',
    jobTitle: 'Воспитатель',
  })
  assert(
    !noEducator.ok && noEducator.error.code === 'CARE_GROUP_REQUIRED',
    '2 educator requires CareGroup',
  )

  const noNanny = createUserForUser(persistence, ownerA, orgA, {
    firstName: 'Мадина',
    lastName: 'Няня',
    email: 'demo-user-031@example.com',
    role: 'office_employee',
    status: 'active',
    jobTitle: 'Няня',
  })
  assert(!noNanny.ok && noNanny.error.code === 'CARE_GROUP_REQUIRED', '3 nanny requires CareGroup')

  const director = createUserForUser(persistence, ownerA, orgA, {
    firstName: 'Зарина',
    lastName: 'Директор',
    email: 'demo-user-028@example.com',
    role: 'office_employee',
    status: 'active',
    jobTitle: 'Заведующий',
  })
  assert(director.ok && !director.value.careGroupId, '4 director without group')
  assert(director.value.role === 'office_employee', '4 job title is not a role')
  assert(director.value.jobTitle === 'Заведующий', '4 director job title stored')
  assert(director.value.accountEnabled === true, '4 director has account')

  const cook = createUserForUser(persistence, ownerA, orgA, {
    firstName: 'Асель',
    lastName: 'Повар',
    email: 'demo-user-015@example.com',
    role: 'office_employee',
    status: 'active',
    jobTitle: 'Повар',
  })
  assert(cook.ok && !cook.value.careGroupId, '5 cook without group')
  assert(cook.value.accountEnabled === false, '5 cook has no account')

  const helper = createUserForUser(persistence, ownerA, orgA, {
    firstName: 'Бакыт',
    lastName: 'Помощник',
    email: 'demo-user-029@example.com',
    role: 'office_employee',
    status: 'active',
    jobTitle: 'Помощник повара',
  })
  assert(helper.ok && !helper.value.careGroupId, '6 cook helper without group')

  const cleaner = createUserForUser(persistence, ownerA, orgA, {
    firstName: 'Гульнар',
    lastName: 'Техничка',
    email: 'demo-user-012@example.com',
    role: 'office_employee',
    status: 'active',
    jobTitle: 'Техничка',
  })
  assert(cleaner.ok && !cleaner.value.careGroupId, '7 cleaner without group')

  const cross = createUserForUser(persistence, ownerA, orgA, {
    firstName: 'Чужая',
    lastName: 'Группа',
    email: 'demo-user-019@example.com',
    role: 'office_employee',
    status: 'active',
    jobTitle: 'Воспитатель',
    careGroupId: foreign.value.id,
  })
  assert(
    !cross.ok &&
      (cross.error.code === 'ORGANIZATION_MISMATCH' ||
        cross.error.code === 'CARE_GROUP_NOT_FOUND'),
    '9 cross-org CareGroup rejected',
  )

  const educator = createUserForUser(persistence, ownerA, orgA, {
    firstName: 'Айдана',
    lastName: 'Каримова',
    email: 'demo-user-005@example.com',
    role: 'office_employee',
    status: 'active',
    phone: '+77011112233',
    jobTitle: 'Воспитатель',
    careGroupId: seniors.value.id,
  })
  assert(educator.ok, '10 create educator')
  assert(educator.value.careGroupId === seniors.value.id, '10 educator group saved')

  const snap = persistence.capture()
  snap.restore()
  const afterRefresh = persistence.users.getById(educator.value.id)
  assert(afterRefresh?.jobTitle === 'Воспитатель', '10 F5 job title')
  assert(afterRefresh?.careGroupId === seniors.value.id, '10 F5 careGroupId')

  const moved = updateUserForUser(persistence, ownerA, orgA, educator.value.id, {
    firstName: educator.value.firstName,
    lastName: educator.value.lastName,
    email: educator.value.email,
    phone: educator.value.phone,
    role: educator.value.role,
    status: educator.value.status,
    jobTitle: 'Воспитатель',
    careGroupId: nursery.value.id,
  })
  assert(moved.ok && moved.value.careGroupId === nursery.value.id, '11 edit group')
  const snapMove = persistence.capture()
  snapMove.restore()
  assert(
    persistence.users.getById(educator.value.id)?.careGroupId === nursery.value.id,
    '11 F5 after edit',
  )

  const toCook = updateUserForUser(persistence, ownerA, orgA, educator.value.id, {
    firstName: educator.value.firstName,
    lastName: educator.value.lastName,
    email: educator.value.email,
    role: educator.value.role,
    status: educator.value.status,
    jobTitle: 'Повар',
  })
  assert(toCook.ok && !toCook.value.careGroupId, 'educator to cook clears group')

  const backToEducator = updateUserForUser(persistence, ownerA, orgA, educator.value.id, {
    firstName: educator.value.firstName,
    lastName: educator.value.lastName,
    email: educator.value.email,
    role: educator.value.role,
    status: educator.value.status,
    jobTitle: 'Воспитатель',
  })
  assert(
    !backToEducator.ok && backToEducator.error.code === 'CARE_GROUP_REQUIRED',
    'cook to educator requires group',
  )

  const restored = updateUserForUser(persistence, ownerA, orgA, educator.value.id, {
    firstName: educator.value.firstName,
    lastName: educator.value.lastName,
    email: educator.value.email,
    phone: educator.value.phone,
    role: educator.value.role,
    status: educator.value.status,
    jobTitle: 'Воспитатель',
    careGroupId: seniors.value.id,
  })
  assert(restored.ok, 'restore educator group')

  const listed = filterUsersForUser(persistence, ownerA, {})
  assert(
    listed.ok && listed.value.some((user) => user.careGroupId === seniors.value.id),
    '12 list shows group field',
  )

  const searched = searchUsersForUser(persistence, ownerA, 'айдана')
  assert(searched.ok && searched.value.some((user) => user.id === educator.value.id), '13 search name')
  const searchedJob = searchUsersForUser(persistence, ownerA, 'воспитатель')
  assert(
    searchedJob.ok && searchedJob.value.some((user) => user.id === educator.value.id),
    '13 search job title',
  )
  const searchedPhone = searchUsersForUser(persistence, ownerA, '77011112233')
  assert(
    searchedPhone.ok && searchedPhone.value.some((user) => user.id === educator.value.id),
    '13 search phone',
  )

  const byGroup = filterUsersForUser(persistence, ownerA, { careGroupId: seniors.value.id })
  assert(
    byGroup.ok &&
      byGroup.value.every((user) => user.careGroupId === seniors.value.id) &&
      byGroup.value.some((user) => user.id === educator.value.id),
    '14 group filter',
  )

  const byJob = filterUsersForUser(persistence, ownerA, { jobTitle: 'Повар' })
  assert(byJob.ok && byJob.value.every((user) => user.jobTitle === 'Повар'), '14 job filter')

  const attendanceStaff = listAttendanceEmployeesForUser(persistence, ownerA)
  assert(
    attendanceStaff.ok && attendanceStaff.value.some((user) => user.id === educator.value.id),
    '15 employee attendance list still works',
  )

  const dental = 'org-dental-emp'
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
  assert(dentalStaff.ok && !dentalStaff.value.careGroupId, 'dental employee unchanged')

  console.log('kindergarten-employees.verify: ok')
}

runKindergartenEmployeesChecks()
