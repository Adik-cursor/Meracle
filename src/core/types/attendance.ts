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
  note?: string
  markedBy: Id
}
