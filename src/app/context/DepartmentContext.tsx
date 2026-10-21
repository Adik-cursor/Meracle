import { useMemo, type ReactNode } from 'react'
import type { DepartmentStatus, Id } from '../../core/types'
import {
  canAccessDepartment,
  createDepartmentForUser,
  listDepartmentsForUser,
  setDepartmentStatusForUser,
  updateDepartmentForUser,
} from '../../core/services'
import { useAccess } from './access-context'
import { useOrganization } from './organization-context'
import { usePersistence, usePersistenceVersion } from './persistence-context'
import {
  DepartmentContext,
  type DepartmentContextValue,
  type DepartmentDraft,
} from './department-context'

type DepartmentProviderProps = {
  children: ReactNode
}

export function DepartmentProvider({ children }: DepartmentProviderProps) {
  const { organization } = useOrganization()
  const { currentUser } = useAccess()
  const persistence = usePersistence()
  const version = usePersistenceVersion()

  const value = useMemo<DepartmentContextValue>(() => {
    void version
    const listed = listDepartmentsForUser(persistence, currentUser)
    const departments = listed.ok ? listed.value : []

    return {
      departments,
      getDepartment: (id: Id) => {
        const department = persistence.departments.getById(id)
        return department && canAccessDepartment(currentUser, department)
          ? department
          : undefined
      },
      getDepartmentsByBranch: (branchId: Id) =>
        departments.filter((department) => department.branchId === branchId),
      createDepartment: (draft: DepartmentDraft) =>
        createDepartmentForUser(
          persistence,
          currentUser,
          organization.id,
          draft,
        ).ok,
      updateDepartment: (id: Id, draft: DepartmentDraft) =>
        updateDepartmentForUser(
          persistence,
          currentUser,
          organization.id,
          id,
          draft,
        ).ok,
      setDepartmentStatus: (id: Id, status: DepartmentStatus) => {
        setDepartmentStatusForUser(
          persistence,
          currentUser,
          organization.id,
          id,
          status,
        )
      },
    }
  }, [currentUser, organization.id, persistence, version])

  return (
    <DepartmentContext.Provider value={value}>
      {children}
    </DepartmentContext.Provider>
  )
}
