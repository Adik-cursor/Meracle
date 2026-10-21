import type { CareGroup, Child, Id, User } from '../types'
import { ok, type ServiceResult } from '../types/domain-error'
import type { Persistence } from '../repositories/persistence'
import {
  isChildAttendance,
  isEmployeeAttendance,
  listAttendanceEmployeesForUser,
  listAttendanceForDateForUser,
} from './attendance'
import { listCareGroupsForUser } from './care-groups'
import { childOccupiesPlace, listChildrenForUser } from './children'
import { isModuleEnabledForUser } from './organization-modules'
import { hasEffectiveCarePermission } from './access'

export type CareGroupOccupancy = {
  id: Id
  name: string
  childCount: number
  capacity: number
  freePlaces: number
  occupancyPercent: number
  full: boolean
}

export type CareAttendanceTally = {
  enrolled: number
  present: number
  absent: number
  unmarked: number
  attendancePercent: number
}

export type CareOperationsSnapshot = {
  enrolled: number
  present: number
  absent: number
  unmarked: number
  freePlaces: number
  attendancePercent: number
  staffEnrolled: number
  staffPresent: number
  staffAbsent: number
  staffUnmarked: number
  staffAttendancePercent: number
  groups: CareGroupOccupancy[]
  childrenIncluded: boolean
  attendanceIncluded: boolean
}

function occupancyForGroup(group: CareGroup, children: Child[]): CareGroupOccupancy {
  const childCount = children.filter(
    (child) => childOccupiesPlace(child) && child.groupId === group.id,
  ).length
  const freePlaces = Math.max(0, group.capacity - childCount)
  const occupancyPercent =
    group.capacity > 0 ? Math.round((childCount / group.capacity) * 100) : 0
  return {
    id: group.id,
    name: group.name,
    childCount,
    capacity: group.capacity,
    freePlaces,
    occupancyPercent,
    full: childCount >= group.capacity,
  }
}

function tally(
  enrolled: number,
  present: number,
  absent: number,
  included: boolean,
): CareAttendanceTally {
  const unmarked = included ? Math.max(0, enrolled - present - absent) : 0
  const marked = present + absent
  return {
    enrolled,
    present: included ? present : 0,
    absent: included ? absent : 0,
    unmarked,
    attendancePercent: marked > 0 ? Math.round((present / marked) * 100) : 0,
  }
}

export function getCareOperationsSnapshotForUser(
  persistence: Persistence,
  currentUser: User | null | undefined,
  date: string,
): ServiceResult<CareOperationsSnapshot> {
  const childrenIncluded = Boolean(
    currentUser &&
      isModuleEnabledForUser(persistence, currentUser, 'children') &&
      hasEffectiveCarePermission(currentUser, 'children.read'),
  )
  const attendanceIncluded = Boolean(
    currentUser &&
      isModuleEnabledForUser(persistence, currentUser, 'attendance') &&
      hasEffectiveCarePermission(currentUser, 'attendance.read'),
  )

  const emptyStaff = tally(0, 0, 0, false)

  let groups: CareGroup[] = []
  let activeChildren: Child[] = []
  if (childrenIncluded) {
    const listedGroups = listCareGroupsForUser(persistence, currentUser)
    const listedChildren = listChildrenForUser(persistence, currentUser)
    if (!listedGroups.ok) {
      return listedGroups
    }
    if (!listedChildren.ok) {
      return listedChildren
    }
    groups = listedGroups.value.filter((group) => group.status === 'active')
    activeChildren = listedChildren.value.filter((child) => childOccupiesPlace(child))
  }

  const occupancy = groups.map((group) => occupancyForGroup(group, activeChildren))
  const freePlaces = occupancy.reduce((sum, group) => sum + group.freePlaces, 0)

  let childPresent = 0
  let childAbsent = 0
  let staff = emptyStaff
  if (attendanceIncluded) {
    const records = listAttendanceForDateForUser(persistence, currentUser, date)
    if (!records.ok) {
      return records
    }
    const employees = listAttendanceEmployeesForUser(persistence, currentUser)
    if (!employees.ok) {
      return employees
    }

    const byChild = new Map(
      records.value.filter(isChildAttendance).map((item) => [item.childId as Id, item.status]),
    )
    childPresent = activeChildren.filter((child) => byChild.get(child.id) === 'present').length
    childAbsent = activeChildren.filter((child) => byChild.get(child.id) === 'absent').length

    const byEmployee = new Map(
      records.value
        .filter(isEmployeeAttendance)
        .map((item) => [item.employeeId as Id, item.status]),
    )
    const staffPresent = employees.value.filter(
      (user) => byEmployee.get(user.id) === 'present',
    ).length
    const staffAbsent = employees.value.filter(
      (user) => byEmployee.get(user.id) === 'absent',
    ).length
    staff = tally(employees.value.length, staffPresent, staffAbsent, true)
  }

  const children = tally(activeChildren.length, childPresent, childAbsent, attendanceIncluded)

  return ok({
    enrolled: children.enrolled,
    present: children.present,
    absent: children.absent,
    unmarked: children.unmarked,
    freePlaces,
    attendancePercent: children.attendancePercent,
    staffEnrolled: staff.enrolled,
    staffPresent: staff.present,
    staffAbsent: staff.absent,
    staffUnmarked: staff.unmarked,
    staffAttendancePercent: staff.attendancePercent,
    groups: occupancy,
    childrenIncluded,
    attendanceIncluded,
  })
}
