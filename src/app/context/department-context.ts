import { createContext, useContext } from 'react'
import type { Department, DepartmentStatus, Id } from '../../core/types'

export type DepartmentDraft = {
  name: string
  code?: string
  branchId: Id
}

export type DepartmentContextValue = {
  departments: Department[]
  getDepartment: (id: Id) => Department | undefined
  getDepartmentsByBranch: (branchId: Id) => Department[]
  createDepartment: (draft: DepartmentDraft) => boolean
  updateDepartment: (id: Id, draft: DepartmentDraft) => boolean
  setDepartmentStatus: (id: Id, status: DepartmentStatus) => void
}

export const DepartmentContext = createContext<DepartmentContextValue | null>(
  null,
)

export function useDepartments(): DepartmentContextValue {
  const context = useContext(DepartmentContext)

  if (!context) {
    throw new Error('useDepartments must be used within DepartmentProvider')
  }

  return context
}
