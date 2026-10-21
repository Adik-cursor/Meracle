import type { BaseEntity } from './common'

export type BranchStatus = 'active' | 'inactive'

export type Branch = BaseEntity & {
  name: string
  code?: string
  status: BranchStatus
}
