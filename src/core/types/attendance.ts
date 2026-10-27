import type { BaseEntity, Id } from './common'

export type AttendanceStatus = 'present' | 'absent'

export type AttendanceRecord = BaseEntity & {
  childId?: Id
  employeeId?: Id
  groupId?: Id
  date: string
  status: AttendanceStatus
  /** Только для сотрудников. Ставит Service через now(), не клиент. */
  checkInAt?: string
  /** Только для сотрудников. Ставит Service через now(), не клиент. */
  checkOutAt?: string
  /** Снимок, сделанный сотрудником камерой при открытии смены. */
  checkInPhoto?: string
  /** Снимок, сделанный сотрудником камерой при закрытии смены. */
  checkOutPhoto?: string
  note?: string
  markedBy: Id
}
