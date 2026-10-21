import type { Department } from '../../types'
import type { DepartmentRepository } from '../department-repository'
import { createInMemoryEntityRepository } from './in-memory-entity-repository'

export function createInMemoryDepartmentRepository(
  onChange: () => void,
): DepartmentRepository & {
  snapshot: () => Department[]
  restore: (items: Department[]) => void
} {
  const inner = createInMemoryEntityRepository<Department>(onChange, 'end')

  return {
    getById: inner.getById,
    list: inner.list,
    create: inner.create,
    update: inner.update,
    listByBranchId: (organizationId, branchId) =>
      inner
        .list(organizationId)
        .filter((department) => department.branchId === branchId),
    snapshot: inner.snapshot,
    restore: inner.restore,
  }
}
