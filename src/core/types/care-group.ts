import type { BaseEntity } from './common'

export type CareGroupStatus = 'active' | 'inactive'

export type CareGroup = BaseEntity & {
  name: string
  capacity: number
  status: CareGroupStatus
}
