import type { AttendanceRecord } from '../types/attendance'
import type { Id } from '../types/common'

function optionalId(value: unknown): Id | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

export function migrateAttendanceRecords(records: AttendanceRecord[]): AttendanceRecord[] {
  const migrated: AttendanceRecord[] = []

  for (const record of records) {
    let childId = optionalId(record.childId)
    let employeeId = optionalId(record.employeeId)

    if (childId && employeeId) {
      employeeId = undefined
    }
    if (!childId && !employeeId) {
      continue
    }

    migrated.push({
      ...record,
      childId,
      employeeId,
      groupId: childId ? optionalId(record.groupId) : undefined,
    })
  }

  return migrated
}
