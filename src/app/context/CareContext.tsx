import { useMemo, type ReactNode } from 'react'
import {
  assignChildToGroupForUser,
  checkInEmployeeForUser,
  checkInSelfForUser,
  checkOutEmployeeForUser,
  checkOutSelfForUser,
  createCareChargeForUser,
  createCareChargePaymentForUser,
  createCareGroupForUser,
  createChildForUser,
  getChildFinanceForUser,
  getChildParentForUser,
  listAttendanceEmployeesForUser,
  listAttendanceForChildForUser,
  listAttendanceForDateForUser,
  listCareGroupsForUser,
  listChildrenByParentForUser,
  listChildrenForGroupForUser,
  listChildrenForUser,
  listKindergartenFinanceForUser,
  markAttendanceBatchForUser,
  markAttendanceForUser,
  updateCareGroupForUser,
  updateChildForUser,
} from '../../core/services'
import { useAccess } from './access-context'
import { useOrganization } from './organization-context'
import { CareContext, type CareContextValue } from './care-context'
import { usePersistence, usePersistenceVersion } from './persistence-context'

export function CareProvider({ children }: { children: ReactNode }) {
  const { currentUser } = useAccess()
  const { modules } = useOrganization()
  const persistence = usePersistence()
  const version = usePersistenceVersion()

  const value = useMemo<CareContextValue>(() => {
    void version
    const childrenOn = modules.children === true
    const groups = childrenOn
      ? listCareGroupsForUser(persistence, currentUser)
      : { ok: true as const, value: [] }
    const listed = childrenOn
      ? listChildrenForUser(persistence, currentUser)
      : { ok: true as const, value: [] }
    const employees = listAttendanceEmployeesForUser(persistence, currentUser)

    return {
      groups: groups.ok ? groups.value : [],
      childrenList: listed.ok ? listed.value : [],
      employees: employees.ok ? employees.value : [],
      createGroup: (draft) => createCareGroupForUser(persistence, currentUser, draft),
      updateGroup: (id, draft) =>
        updateCareGroupForUser(persistence, currentUser, id, draft),
      createChild: (draft) => createChildForUser(persistence, currentUser, draft),
      updateChild: (id, draft) => updateChildForUser(persistence, currentUser, id, draft),
      assignChild: (childId, groupId) =>
        assignChildToGroupForUser(persistence, currentUser, childId, groupId),
      getChild: (id) => {
        const child = persistence.children.getById(id)
        return child && currentUser && child.organizationId === currentUser.organizationId
          ? child
          : undefined
      },
      getGroup: (id) => {
        const group = persistence.careGroups.getById(id)
        return group && currentUser && group.organizationId === currentUser.organizationId
          ? group
          : undefined
      },
      getChildParent: (childId) => {
        const parent = getChildParentForUser(persistence, currentUser, childId)
        return parent.ok ? parent.value : {}
      },
      listSiblings: (parentCustomerId) => {
        const siblings = listChildrenByParentForUser(
          persistence,
          currentUser,
          parentCustomerId,
        )
        return siblings.ok ? siblings.value : []
      },
      getChildFinance: (childId) => {
        const finance = getChildFinanceForUser(persistence, currentUser, childId)
        return finance.ok ? finance.value : undefined
      },
      createCareCharge: (draft) =>
        createCareChargeForUser(persistence, currentUser, draft),
      createCarePayment: (draft) =>
        createCareChargePaymentForUser(persistence, currentUser, draft),
      listPeriodFinance: (query) => {
        const listed = listKindergartenFinanceForUser(persistence, currentUser, query)
        return listed.ok ? listed.value : undefined
      },
      listAttendance: (date) => {
        const records = listAttendanceForDateForUser(persistence, currentUser, date)
        return records.ok ? records.value : []
      },
      listChildAttendance: (childId) => {
        const records = listAttendanceForChildForUser(persistence, currentUser, childId)
        return records.ok ? records.value : []
      },
      listGroupChildren: (groupId) => {
        const listed = listChildrenForGroupForUser(persistence, currentUser, groupId)
        return listed.ok ? listed.value : []
      },
      markAttendance: (input) => markAttendanceForUser(persistence, currentUser, input),
      markAttendanceBatch: (items) =>
        markAttendanceBatchForUser(persistence, currentUser, items),
      checkInSelf: () => checkInSelfForUser(persistence, currentUser),
      checkOutSelf: () => checkOutSelfForUser(persistence, currentUser),
      checkInEmployee: (employeeId) =>
        checkInEmployeeForUser(persistence, currentUser, employeeId),
      checkOutEmployee: (employeeId) =>
        checkOutEmployeeForUser(persistence, currentUser, employeeId),
    }
  }, [currentUser, modules.children, persistence, version])

  return <CareContext.Provider value={value}>{children}</CareContext.Provider>
}
