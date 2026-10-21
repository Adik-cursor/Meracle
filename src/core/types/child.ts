import type { BaseEntity, Id } from './common'

export type ChildStatus = 'attending' | 'temporarily_absent' | 'withdrawn'

export type Child = BaseEntity & {
  firstName: string
  lastName: string
  birthDate: string
  groupId?: Id
  status: ChildStatus
  parentContactId?: Id
  parentCustomerId?: Id
  notes?: string
}
