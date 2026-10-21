import type { BaseEntity, Id } from './common'

export type AccessChangeLog = BaseEntity & {
  actorUserId: Id
  targetUserId?: Id
  targetOrganizationId?: Id
  field: string
  previousValue: string
  nextValue: string
  reason?: string
}
