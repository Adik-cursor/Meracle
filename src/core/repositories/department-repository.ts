import type { Department, Id } from '../types'
import type { EntityRepository } from './entity-repository'

export type DepartmentRepository = EntityRepository<Department> & {
  listByBranchId: (organizationId: Id, branchId: Id) => Department[]
}
