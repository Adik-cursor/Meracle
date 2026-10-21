import type { BaseEntity, Id } from './common'

export type DepartmentStatus = 'active' | 'inactive'

export type Department = BaseEntity & {
  branchId: Id
  name: string
  code?: string
  status: DepartmentStatus
}
