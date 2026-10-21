import type { Id, IsoDateTime } from './common'

export type Session = {
  id: Id
  userId: Id
  organizationId: Id
  createdAt: IsoDateTime
}
