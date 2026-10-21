import type { Id, User, UserRole } from '../types'
import { createInMemoryPersistence } from '../repositories/in-memory/create-in-memory-persistence'
import type { Persistence } from '../repositories/persistence'
import {
  checkInEmployeeForUser,
  checkInSelfForUser,
  checkOutEmployeeForUser,
  checkOutSelfForUser,
  listAttendanceForDateForUser,
  listAttendanceForEmployeeForUser,
} from './attendance'
import { login } from './auth'
import { todayExpenseDateInput } from './expenses'
import { backfillAttendanceModuleConfig, seedEnabledBusinessModules } from './organization-modules'
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

function runForBusiness(
  label: string,
  modules: readonly ('children' | 'attendance' | 'crm' | 'sales' | 'rental' | 'warehouse')[],
): void {
  const persistence = createInMemoryPersistence()
  const orgA = `org-att-${label}-a`
  const orgB = `org-att-${label}-b`
  addOrg(persistence, orgA, `${label} A`)
  addOrg(persistence, orgB, `${label} B`)
  seedEnabledBusinessModules(persistence, orgA, 'seed', modules)
  seedEnabledBusinessModules(persistence, orgB, 'seed', modules)

  const ownerA = addUser(persistence, orgA, 'owner')
  const ownerB = addUser(persistence, orgB, 'owner')
  const manager = addUser(persistence, orgA, 'sales_manager')
  const noAccount = createUserForUser(persistence, ownerA, orgA, {
    firstName: 'Иван',
    lastName: 'Петров',
    role: 'office_employee',
    status: 'active',
    phone: '+77011111111',
    jobTitle: 'Водитель',
    accountEnabled: false,
  })
  assert(noAccount.ok, `${label} no-account employee`)
  const other = addUser(persistence, orgA, 'accountant')

  const selfIn = checkInSelfForUser(persistence, manager)
  assert(selfIn.ok && selfIn.value.checkInAt, `${label} self check-in sets server time`)
  assert(selfIn.value.date === todayExpenseDateInput(), `${label} clock date is server today`)
  assert(selfIn.value.employeeId === manager.id, `${label} self clocks current employee`)
  assert(!selfIn.value.childId, `${label} employee xor child`)

  const dupIn = checkInSelfForUser(persistence, manager)
  assert(!dupIn.ok && dupIn.error.code === 'ALREADY_CHECKED_IN', `${label} duplicate check-in`)

  const selfOut = checkOutSelfForUser(persistence, manager)
  assert(selfOut.ok && selfOut.value.checkOutAt, `${label} self check-out sets server time`)
  assert(selfOut.value.checkInAt === selfIn.value.checkInAt, `${label} check-in kept`)

  const dupOut = checkOutSelfForUser(persistence, manager)
  assert(!dupOut.ok && dupOut.error.code === 'ALREADY_CHECKED_OUT', `${label} duplicate check-out`)

  const spoof = checkInEmployeeForUser(persistence, manager, other.id)
  assert(!spoof.ok && spoof.error.code === 'ACCESS_DENIED', `${label} self cannot mark another`)

  const adminIn = checkInEmployeeForUser(persistence, ownerA, noAccount.value.id)
  assert(adminIn.ok && adminIn.value.checkInAt, `${label} admin marks employee without account`)
  assert(adminIn.value.employeeId === noAccount.value.id, `${label} admin target stored`)
  assert(!login(persistence, noAccount.value.id).ok, `${label} no-account still cannot login`)

  const staffSelf = checkInSelfForUser(persistence, noAccount.value)
  assert(!staffSelf.ok, `${label} no-account cannot self clock`)

  const adminOut = checkOutEmployeeForUser(persistence, ownerA, noAccount.value.id)
  assert(adminOut.ok && adminOut.value.checkOutAt, `${label} admin check-out`)

  const listed = listAttendanceForDateForUser(persistence, ownerA, todayExpenseDateInput())
  assert(listed.ok, `${label} list today`)
  assert(
    listed.value.filter((item) => item.employeeId === manager.id).length === 1,
    `${label} one record per employee per day`,
  )

  const cross = checkInEmployeeForUser(persistence, ownerB, noAccount.value.id)
  assert(!cross.ok, `${label} cross-org check-in denied`)
  const readCross = listAttendanceForEmployeeForUser(persistence, ownerB, noAccount.value.id)
  assert(!readCross.ok, `${label} cross-org read denied`)

  const snap = persistence.capture()
  snap.restore()
  const after = listAttendanceForEmployeeForUser(persistence, ownerA, manager.id)
  assert(
    after.ok &&
      after.value[0]?.checkInAt === selfIn.value.checkInAt &&
      after.value[0]?.checkOutAt === selfOut.value.checkOutAt,
    `${label} F5 persistence`,
  )
}

export function runUniversalAttendanceChecks(): void {
  runForBusiness('kindergarten', ['children', 'attendance', 'crm'])
  runForBusiness('dental', ['crm', 'sales', 'warehouse', 'attendance'])
  runForBusiness('rental', ['crm', 'sales', 'rental', 'attendance'])

  const persistence = createInMemoryPersistence()
  const orgOff = 'org-att-off'
  addOrg(persistence, orgOff, 'Off')
  seedEnabledBusinessModules(persistence, orgOff, 'seed', ['crm', 'sales'])
  const ownerOff = addUser(persistence, orgOff, 'owner')
  const gated = checkInSelfForUser(persistence, ownerOff)
  assert(!gated.ok && gated.error.code === 'MODULE_NOT_ENABLED', 'attendance module off')

  const orgFill = 'org-att-backfill'
  addOrg(persistence, orgFill, 'Fill')
  seedEnabledBusinessModules(persistence, orgFill, 'seed', ['crm', 'sales'])
  backfillAttendanceModuleConfig(persistence, 'seed')
  const ownerFill = addUser(persistence, orgFill, 'owner')
  const filled = checkInSelfForUser(persistence, ownerFill)
  assert(filled.ok, 'backfill enables attendance for sales orgs')

  console.log('universal-attendance.verify: ok')
}

runUniversalAttendanceChecks()
