import type { AttendanceRecord, AttendanceStatus, Id, User } from '../types'
import { fail, ok, type ServiceResult } from '../types/domain-error'
import type { Persistence } from '../repositories/persistence'
import { belongsToOrganization } from './catalog'
import { newId, nowIso, optionalText } from './primitives'
import { requireAttendanceManager, requireAttendanceReader, requireAttendanceSelf } from './care-access'
import { todayExpenseDateInput } from './expenses'

export type AttendanceMark = AttendanceStatus | 'unmarked'

export type AttendanceWrite = {
  childId?: Id
  employeeId?: Id
  date: string
  status: AttendanceMark
  note?: string
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime())
}

function hasId(value: Id | undefined): value is Id {
  return typeof value === 'string' && value.length > 0
}

export function isChildAttendance(
  record: Pick<AttendanceRecord, 'childId' | 'employeeId'>,
): boolean {
  return hasId(record.childId) && !hasId(record.employeeId)
}

export function isEmployeeAttendance(
  record: Pick<AttendanceRecord, 'childId' | 'employeeId'>,
): boolean {
  return hasId(record.employeeId) && !hasId(record.childId)
}

export type EmployeeWorkDayState = 'unmarked' | 'working' | 'completed'

export function employeeWorkDayState(
  record?: Pick<AttendanceRecord, 'status' | 'checkInAt' | 'checkOutAt'>,
): EmployeeWorkDayState {
  if (!record) {
    return 'unmarked'
  }
  if (record.checkOutAt) {
    return 'completed'
  }
  if (record.checkInAt || record.status === 'present') {
    return 'working'
  }
  return 'unmarked'
}

export function formatAttendanceClockTime(iso: string, locale: string): string {
  return new Date(iso).toLocaleTimeString(locale === 'kk' ? 'kk-KZ' : 'ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function tallyAttendanceRecords(records: AttendanceRecord[]): {
  present: number
  absent: number
  attendancePercent: number
} {
  const present = records.filter((item) => item.status === 'present').length
  const absent = records.filter((item) => item.status === 'absent').length
  const marked = present + absent
  return {
    present,
    absent,
    attendancePercent: marked > 0 ? Math.round((present / marked) * 100) : 0,
  }
}

function findChildRecord(
  persistence: Persistence,
  organizationId: Id,
  childId: Id,
  date: string,
): AttendanceRecord | undefined {
  return persistence.attendanceRecords
    .list(organizationId)
    .find((item) => item.date === date && item.childId === childId && !hasId(item.employeeId))
}

function findEmployeeRecord(
  persistence: Persistence,
  organizationId: Id,
  employeeId: Id,
  date: string,
): AttendanceRecord | undefined {
  return persistence.attendanceRecords
    .list(organizationId)
    .find((item) => item.date === date && item.employeeId === employeeId && !hasId(item.childId))
}

export function listAttendanceEmployeesForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
): ServiceResult<User[]> {
  const actor = requireAttendanceReader(persistence, currentUser)
  if (!actor.ok) {
    return actor
  }

  return ok(
    persistence.users
      .list(actor.value.organizationId)
      .filter((user) => user.status === 'active')
      .sort((left, right) =>
        `${left.lastName} ${left.firstName}`.localeCompare(
          `${right.lastName} ${right.firstName}`,
          'ru',
        ),
      ),
  )
}

export function listAttendanceForDateForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  date: string,
): ServiceResult<AttendanceRecord[]> {
  const actor = requireAttendanceReader(persistence, currentUser)
  if (!actor.ok) {
    return actor
  }
  if (!isIsoDate(date)) {
    return fail({ code: 'INVALID_INPUT' })
  }

  return ok(
    persistence.attendanceRecords
      .list(actor.value.organizationId)
      .filter((item) => item.date === date),
  )
}

export function listAttendanceForChildForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  childId: Id,
): ServiceResult<AttendanceRecord[]> {
  const actor = requireAttendanceReader(persistence, currentUser)
  if (!actor.ok) {
    return actor
  }

  const child = persistence.children.getById(childId)
  if (!child || !belongsToOrganization(child, actor.value.organizationId)) {
    return fail({ code: 'CHILD_NOT_FOUND' })
  }

  return ok(
    persistence.attendanceRecords
      .list(actor.value.organizationId)
      .filter((item) => item.childId === childId && !hasId(item.employeeId))
      .sort((left, right) => right.date.localeCompare(left.date)),
  )
}

export function listAttendanceForEmployeeForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  employeeId: Id,
): ServiceResult<AttendanceRecord[]> {
  const actor = requireAttendanceReader(persistence, currentUser)
  if (!actor.ok) {
    return actor
  }

  const employee = persistence.users.getById(employeeId)
  if (!employee || !belongsToOrganization(employee, actor.value.organizationId)) {
    return fail({ code: 'USER_NOT_FOUND' })
  }

  return ok(
    persistence.attendanceRecords
      .list(actor.value.organizationId)
      .filter((item) => item.employeeId === employeeId && !hasId(item.childId))
      .sort((left, right) => right.date.localeCompare(left.date)),
  )
}

export function markAttendanceForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  input: AttendanceWrite,
): ServiceResult<AttendanceRecord | undefined> {
  const actor = requireAttendanceManager(persistence, currentUser)
  if (!actor.ok) {
    return actor
  }
  if (!isIsoDate(input.date)) {
    return fail({ code: 'INVALID_INPUT' })
  }

  const hasChild = hasId(input.childId)
  const hasEmployee = hasId(input.employeeId)
  if (hasChild === hasEmployee) {
    return fail({ code: 'INVALID_INPUT' })
  }

  if (hasChild && input.childId) {
    return markChildAttendance(persistence, actor.value, input.childId, input)
  }
  if (hasEmployee && input.employeeId) {
    return markEmployeeAttendance(persistence, actor.value, input.employeeId, input)
  }

  return fail({ code: 'INVALID_INPUT' })
}

export function markAttendanceBatchForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  items: AttendanceWrite[],
): ServiceResult<{ count: number }> {
  const actor = requireAttendanceManager(persistence, currentUser)
  if (!actor.ok) {
    return actor
  }

  let count = 0
  for (const item of items) {
    const result = markAttendanceForUser(persistence, currentUser, item)
    if (!result.ok) {
      return result
    }
    count += 1
  }

  return ok({ count })
}

function markChildAttendance(
  persistence: Persistence,
  actor: User,
  childId: Id,
  input: AttendanceWrite,
): ServiceResult<AttendanceRecord | undefined> {
  const child = persistence.children.getById(childId)
  if (!child || !belongsToOrganization(child, actor.organizationId)) {
    return fail({ code: 'CHILD_NOT_FOUND' })
  }
  if (!child.groupId) {
    return fail({ code: 'CARE_GROUP_NOT_FOUND' })
  }

  const group = persistence.careGroups.getById(child.groupId)
  if (!group || group.organizationId !== actor.organizationId) {
    return fail({ code: 'CARE_GROUP_NOT_FOUND' })
  }

  const existing = findChildRecord(persistence, actor.organizationId, child.id, input.date)
  const now = nowIso()

  if (input.status === 'unmarked') {
    if (existing) {
      persistence.attendanceRecords.delete(existing.id)
    }
    return ok(undefined)
  }

  if (existing) {
    const updated = persistence.attendanceRecords.update(existing.id, {
      status: input.status,
      childId: child.id,
      employeeId: undefined,
      groupId: child.groupId,
      note: optionalText(input.note),
      markedBy: actor.id,
      updatedAt: now,
    })
    if (!updated) {
      return fail({ code: 'ATTENDANCE_NOT_FOUND' })
    }
    return ok(updated)
  }

  return ok(
    persistence.attendanceRecords.create({
      id: newId(),
      organizationId: actor.organizationId,
      childId: child.id,
      groupId: child.groupId,
      date: input.date,
      status: input.status,
      note: optionalText(input.note),
      markedBy: actor.id,
      createdAt: now,
      updatedAt: now,
    }),
  )
}

function markEmployeeAttendance(
  persistence: Persistence,
  actor: User,
  employeeId: Id,
  input: AttendanceWrite,
): ServiceResult<AttendanceRecord | undefined> {
  const employee = persistence.users.getById(employeeId)
  if (!employee || !belongsToOrganization(employee, actor.organizationId)) {
    return fail({ code: 'USER_NOT_FOUND' })
  }
  if (employee.status !== 'active') {
    return fail({ code: 'USER_INACTIVE' })
  }

  const existing = findEmployeeRecord(
    persistence,
    actor.organizationId,
    employee.id,
    input.date,
  )
  const now = nowIso()

  if (input.status === 'unmarked') {
    if (existing) {
      persistence.attendanceRecords.delete(existing.id)
    }
    return ok(undefined)
  }

  if (existing) {
    const updated = persistence.attendanceRecords.update(existing.id, {
      status: input.status,
      employeeId: employee.id,
      childId: undefined,
      groupId: undefined,
      note: optionalText(input.note),
      markedBy: actor.id,
      checkInAt: existing.checkInAt,
      checkOutAt: existing.checkOutAt,
      updatedAt: now,
    })
    if (!updated) {
      return fail({ code: 'ATTENDANCE_NOT_FOUND' })
    }
    return ok(updated)
  }

  return ok(
    persistence.attendanceRecords.create({
      id: newId(),
      organizationId: actor.organizationId,
      employeeId: employee.id,
      date: input.date,
      status: input.status,
      note: optionalText(input.note),
      markedBy: actor.id,
      createdAt: now,
      updatedAt: now,
    }),
  )
}

function requireOrgEmployee(
  persistence: Persistence,
  actor: User,
  employeeId: Id,
): ServiceResult<User> {
  const employee = persistence.users.getById(employeeId)
  if (!employee || !belongsToOrganization(employee, actor.organizationId)) {
    return fail({ code: 'USER_NOT_FOUND' })
  }
  if (employee.status !== 'active') {
    return fail({ code: 'USER_INACTIVE' })
  }
  return ok(employee)
}

function clockInEmployee(
  persistence: Persistence,
  actor: User,
  employeeId: Id,
): ServiceResult<AttendanceRecord> {
  const employee = requireOrgEmployee(persistence, actor, employeeId)
  if (!employee.ok) {
    return employee
  }

  const now = nowIso()
  const date = todayExpenseDateInput()
  const existing = findEmployeeRecord(
    persistence,
    actor.organizationId,
    employee.value.id,
    date,
  )

  if (existing?.checkOutAt || existing?.checkInAt || existing?.status === 'present') {
    return fail({ code: 'ALREADY_CHECKED_IN' })
  }

  if (existing) {
    const updated = persistence.attendanceRecords.update(existing.id, {
      status: 'present',
      employeeId: employee.value.id,
      childId: undefined,
      groupId: undefined,
      checkInAt: now,
      markedBy: actor.id,
      updatedAt: now,
    })
    if (!updated) {
      return fail({ code: 'ATTENDANCE_NOT_FOUND' })
    }
    return ok(updated)
  }

  return ok(
    persistence.attendanceRecords.create({
      id: newId(),
      organizationId: actor.organizationId,
      employeeId: employee.value.id,
      date,
      status: 'present',
      checkInAt: now,
      markedBy: actor.id,
      createdAt: now,
      updatedAt: now,
    }),
  )
}

function clockOutEmployee(
  persistence: Persistence,
  actor: User,
  employeeId: Id,
): ServiceResult<AttendanceRecord> {
  const employee = requireOrgEmployee(persistence, actor, employeeId)
  if (!employee.ok) {
    return employee
  }

  const now = nowIso()
  const date = todayExpenseDateInput()
  const existing = findEmployeeRecord(
    persistence,
    actor.organizationId,
    employee.value.id,
    date,
  )

  if (!existing || (!existing.checkInAt && existing.status !== 'present')) {
    return fail({ code: 'CHECK_IN_REQUIRED' })
  }
  if (existing.checkOutAt) {
    return fail({ code: 'ALREADY_CHECKED_OUT' })
  }

  const updated = persistence.attendanceRecords.update(existing.id, {
    status: 'present',
    employeeId: employee.value.id,
    childId: undefined,
    groupId: undefined,
    checkInAt: existing.checkInAt ?? existing.createdAt,
    checkOutAt: now,
    markedBy: actor.id,
    updatedAt: now,
  })
  if (!updated) {
    return fail({ code: 'ATTENDANCE_NOT_FOUND' })
  }
  return ok(updated)
}

export function checkInSelfForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
): ServiceResult<AttendanceRecord> {
  const actor = requireAttendanceSelf(persistence, currentUser)
  if (!actor.ok) {
    return actor
  }

  return clockInEmployee(persistence, actor.value, actor.value.id)
}

export function checkOutSelfForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
): ServiceResult<AttendanceRecord> {
  const actor = requireAttendanceSelf(persistence, currentUser)
  if (!actor.ok) {
    return actor
  }

  return clockOutEmployee(persistence, actor.value, actor.value.id)
}

export function checkInEmployeeForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  employeeId: Id,
): ServiceResult<AttendanceRecord> {
  const actor = requireAttendanceManager(persistence, currentUser)
  if (!actor.ok) {
    return actor
  }

  return clockInEmployee(persistence, actor.value, employeeId)
}

export function checkOutEmployeeForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  employeeId: Id,
): ServiceResult<AttendanceRecord> {
  const actor = requireAttendanceManager(persistence, currentUser)
  if (!actor.ok) {
    return actor
  }

  return clockOutEmployee(persistence, actor.value, employeeId)
}
