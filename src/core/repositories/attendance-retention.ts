import type { ListedEntityRepository } from './entity-repository'
import type { AttendanceRecord } from '../types/attendance'

export const EMPLOYEE_ATTENDANCE_RETENTION_DAYS = 30

export function employeeAttendanceCutoffDate(now = new Date()): string {
  const cutoff = new Date(now)
  cutoff.setDate(cutoff.getDate() - EMPLOYEE_ATTENDANCE_RETENTION_DAYS)
  const year = cutoff.getFullYear()
  const month = String(cutoff.getMonth() + 1).padStart(2, '0')
  const day = String(cutoff.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function pruneOldEmployeeAttendance(
  records: ListedEntityRepository<AttendanceRecord>,
  now = new Date(),
): void {
  const cutoff = employeeAttendanceCutoffDate(now)
  for (const record of records.listAll()) {
    if (record.employeeId && record.date < cutoff) {
      records.delete(record.id)
    }
  }
}
