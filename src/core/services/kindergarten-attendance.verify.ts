import type { Id, User, UserRole } from '../types'
import { createInMemoryPersistence } from '../repositories/in-memory/create-in-memory-persistence'
import type { Persistence } from '../repositories/persistence'
import {
  listAttendanceEmployeesForUser,
  listAttendanceForDateForUser,
  listAttendanceForEmployeeForUser,
  markAttendanceBatchForUser,
  markAttendanceForUser,
} from './attendance'
import { getCareOperationsSnapshotForUser } from './care-analytics'
import { createCareGroupForUser } from './care-groups'
import { createChildForUser } from './children'
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

export function runKindergartenAttendanceChecks(): void {
  const persistence = createInMemoryPersistence()
  const orgA = 'org-att-a'
  const orgB = 'org-att-b'
  addOrg(persistence, orgA, 'A')
  addOrg(persistence, orgB, 'B')
  seedEnabledBusinessModules(persistence, orgA, 'seed', ['children', 'attendance'])
  seedEnabledBusinessModules(persistence, orgB, 'seed', ['children', 'attendance'])
  const ownerA = addUser(persistence, orgA, 'owner')
  const ownerB = addUser(persistence, orgB, 'owner')
  const teacher = addUser(persistence, orgA, 'sales_employee', { jobTitle: 'Воспитатель' })
  const accountant = addUser(persistence, orgA, 'accountant')
  const staffB = addUser(persistence, orgB, 'office_employee', { jobTitle: 'Воспитатель B' })
  const today = todayExpenseDateInput()

  const group = createCareGroupForUser(persistence, ownerA, {
    name: 'Старшая',
    capacity: 10,
    status: 'active',
  })
  assert(group.ok, 'group')
  const presentChild = createChildForUser(persistence, ownerA, {
    firstName: 'Ая',
    lastName: 'К',
    birthDate: '2019-09-01',
    groupId: group.value.id,
    status: 'active',
  })
  const absentChild = createChildForUser(persistence, ownerA, {
    firstName: 'Дани',
    lastName: 'М',
    birthDate: '2019-02-02',
    groupId: group.value.id,
    status: 'active',
  })
  assert(presentChild.ok && absentChild.ok, 'children')

  const present = markAttendanceForUser(persistence, teacher, {
    childId: presentChild.value.id,
    date: today,
    status: 'present',
  })
  const absent = markAttendanceForUser(persistence, teacher, {
    childId: absentChild.value.id,
    date: today,
    status: 'absent',
  })
  assert(present.ok && present.value?.status === 'present', 'mark present')
  assert(absent.ok && absent.value?.status === 'absent', 'mark absent')

  const changed = markAttendanceForUser(persistence, ownerA, {
    childId: presentChild.value.id,
    date: today,
    status: 'absent',
  })
  assert(changed.ok && changed.value?.status === 'absent', 'change status')
  assert(changed.value?.id === present.value?.id, 'child update keeps same record')

  const listed = listAttendanceForDateForUser(persistence, ownerA, today)
  assert(listed.ok && listed.value.filter((item) => item.childId).length === 2, 'two child records')

  const xorBoth = markAttendanceForUser(persistence, ownerA, {
    childId: presentChild.value.id,
    employeeId: teacher.id,
    date: today,
    status: 'present',
  })
  assert(!xorBoth.ok && xorBoth.error.code === 'INVALID_INPUT', 'child XOR employee')

  const staffPresent = markAttendanceForUser(persistence, ownerA, {
    employeeId: teacher.id,
    date: today,
    status: 'present',
  })
  assert(staffPresent.ok && staffPresent.value?.status === 'present', 'employee present')
  assert(!staffPresent.value?.childId, 'employee record has no childId')
  assert(staffPresent.value?.employeeId === teacher.id, 'employee id stored')

  const staffPresentAgain = markAttendanceForUser(persistence, ownerA, {
    employeeId: teacher.id,
    date: today,
    status: 'present',
  })
  assert(staffPresentAgain.ok && staffPresentAgain.value?.id === staffPresent.value?.id, 'no duplicate')

  const staffAbsent = markAttendanceForUser(persistence, ownerA, {
    employeeId: teacher.id,
    date: today,
    status: 'absent',
  })
  assert(staffAbsent.ok && staffAbsent.value?.status === 'absent', 'employee update')
  assert(staffAbsent.value?.id === staffPresent.value?.id, 'employee update in place')

  const employeeListed = listAttendanceForEmployeeForUser(persistence, ownerA, teacher.id)
  assert(employeeListed.ok && employeeListed.value.length === 1, 'one employee record')

  const employees = listAttendanceEmployeesForUser(persistence, ownerA)
  assert(employees.ok && employees.value.some((item) => item.id === teacher.id), 'org employees listed')
  assert(!employees.value.some((item) => item.id === staffB.id), 'other org employees hidden')

  const snapshot = getCareOperationsSnapshotForUser(persistence, ownerA, today)
  assert(snapshot.ok, 'care analytics snapshot')
  assert(snapshot.value.enrolled === 2, 'children enrolled')
  assert(snapshot.value.present === 0, 'both children absent after change')
  assert(snapshot.value.absent === 2, 'children absent tally')
  assert(snapshot.value.unmarked === 0, 'children all marked')
  assert(snapshot.value.staffEnrolled === 3, 'owner + teacher + accountant')
  assert(snapshot.value.staffPresent === 0, 'teacher now absent')
  assert(snapshot.value.staffAbsent === 1, 'one staff absent')
  assert(snapshot.value.staffUnmarked === 2, 'owner and accountant unmarked')
  assert(snapshot.value.staffAttendancePercent === 0, 'staff percent from marked only')

  const unmarked = markAttendanceForUser(persistence, ownerA, {
    employeeId: teacher.id,
    date: today,
    status: 'unmarked',
  })
  assert(unmarked.ok && unmarked.value === undefined, 'employee unmarked deletes record')
  const afterUnmark = listAttendanceForEmployeeForUser(persistence, ownerA, teacher.id)
  assert(afterUnmark.ok && afterUnmark.value.length === 0, 'unmarked has no row')

  assert(
    markAttendanceForUser(persistence, ownerA, {
      employeeId: teacher.id,
      date: today,
      status: 'present',
    }).ok,
    're-mark present after unmark',
  )

  const snap = persistence.capture()
  snap.restore()
  const after = listAttendanceForDateForUser(persistence, ownerA, today)
  assert(
    after.ok &&
      after.value.some((item) => item.childId === presentChild.value.id && item.status === 'absent'),
    'child attendance persists after snapshot restore',
  )
  assert(
    after.ok &&
      after.value.some((item) => item.employeeId === teacher.id && item.status === 'present'),
    'employee attendance persists after snapshot restore',
  )

  const crossChild = markAttendanceForUser(persistence, ownerB, {
    childId: presentChild.value.id,
    date: today,
    status: 'present',
  })
  assert(!crossChild.ok, 'cross-org child attendance denied')

  const crossEmployee = markAttendanceForUser(persistence, ownerB, {
    employeeId: teacher.id,
    date: today,
    status: 'absent',
  })
  assert(!crossEmployee.ok, 'cross-org employee attendance denied')

  const readB = listAttendanceForEmployeeForUser(persistence, ownerB, teacher.id)
  assert(!readB.ok, 'org B cannot read org A employee attendance')

  const readOnly = markAttendanceForUser(persistence, accountant, {
    childId: absentChild.value.id,
    date: today,
    status: 'present',
  })
  assert(!readOnly.ok && readOnly.error.code === 'ACCESS_DENIED', 'accountant cannot mark children')

  const readOnlyStaff = markAttendanceForUser(persistence, accountant, {
    employeeId: teacher.id,
    date: today,
    status: 'absent',
  })
  assert(!readOnlyStaff.ok && readOnlyStaff.error.code === 'ACCESS_DENIED', 'accountant cannot mark staff')

  const unmarkedChild = createChildForUser(persistence, ownerA, {
    firstName: 'Ару',
    lastName: 'Т',
    birthDate: '2020-03-03',
    groupId: group.value.id,
    status: 'attending',
  })
  assert(unmarkedChild.ok, 'third child unmarked')

  const beforeBatch = listAttendanceForDateForUser(persistence, ownerA, today)
  assert(beforeBatch.ok, 'list before batch')
  const existingPresentId = beforeBatch.value.find(
    (item) => item.childId === presentChild.value.id,
  )?.id

  const batchDenied = markAttendanceBatchForUser(persistence, accountant, [
    { childId: unmarkedChild.value.id, date: today, status: 'present' },
  ])
  assert(!batchDenied.ok && batchDenied.error.code === 'ACCESS_DENIED', 'batch requires manage')

  const batchPresent = markAttendanceBatchForUser(persistence, ownerA, [
    { childId: presentChild.value.id, date: today, status: 'present' },
    { childId: absentChild.value.id, date: today, status: 'present' },
    { childId: unmarkedChild.value.id, date: today, status: 'present' },
  ])
  assert(batchPresent.ok && batchPresent.value.count === 3, 'batch marks visible children')
  const afterBatch = listAttendanceForDateForUser(persistence, ownerA, today)
  assert(afterBatch.ok, 'list after batch')
  const childRows = afterBatch.value.filter((item) => item.childId)
  assert(childRows.length === 3, 'no duplicate child records after batch')
  assert(
    childRows.every((item) => item.status === 'present'),
    'batch present updates existing and creates missing',
  )
  assert(
    childRows.find((item) => item.childId === presentChild.value.id)?.id === existingPresentId,
    'batch updates existing child record in place',
  )

  const staffBatch = markAttendanceBatchForUser(persistence, ownerA, [
    { employeeId: ownerA.id, date: today, status: 'absent' },
    { employeeId: accountant.id, date: today, status: 'present' },
  ])
  assert(staffBatch.ok && staffBatch.value.count === 2, 'employee batch')
  const staffAfter = listAttendanceForDateForUser(persistence, ownerA, today)
  assert(
    staffAfter.ok &&
      staffAfter.value.filter((item) => item.employeeId).length === 3,
    'employee records created without duplicates',
  )

  const orgOff = 'org-att-off'
  addOrg(persistence, orgOff, 'Off')
  seedEnabledBusinessModules(persistence, orgOff, 'seed', ['children'])
  const ownerOff = addUser(persistence, orgOff, 'owner')
  const off = listAttendanceForDateForUser(persistence, ownerOff, today)
  assert(!off.ok && off.error.code === 'MODULE_NOT_ENABLED', 'attendance module off')

  console.log('kindergarten-attendance.verify: ok')
}

runKindergartenAttendanceChecks()
