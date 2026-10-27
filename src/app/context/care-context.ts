import { createContext, useContext } from 'react'
import type { AttendanceRecord, CareCharge, CareGroup, Child, Id, Payment, User } from '../../core/types'
import type {
  AttendanceWrite,
  CareChargePaymentWrite,
  CareChargeWrite,
  CareGroupWrite,
  ChildFinanceSnapshot,
  ChildWrite,
  KindergartenFinanceQuery,
  KindergartenFinanceView,
} from '../../core/services'
import type { ServiceResult } from '../../core/types/domain-error'

export type CareContextValue = {
  groups: CareGroup[]
  childrenList: Child[]
  employees: User[]
  createGroup: (draft: CareGroupWrite) => ServiceResult<CareGroup>
  updateGroup: (id: Id, draft: CareGroupWrite) => ServiceResult<CareGroup>
  createChild: (draft: ChildWrite) => ServiceResult<Child>
  updateChild: (id: Id, draft: ChildWrite) => ServiceResult<Child>
  assignChild: (childId: Id, groupId: Id | undefined) => ServiceResult<Child>
  getChild: (id: Id) => Child | undefined
  getGroup: (id: Id) => CareGroup | undefined
  getChildParent: (childId: Id) => {
    customerId?: Id
    contactId?: Id
    fullName?: string
    phone?: string
  }
  listSiblings: (parentCustomerId: Id) => Child[]
  getChildFinance: (childId: Id) => ChildFinanceSnapshot | undefined
  createCareCharge: (draft: CareChargeWrite) => ServiceResult<CareCharge>
  createCarePayment: (draft: CareChargePaymentWrite) => ServiceResult<Payment>
  listPeriodFinance: (query: KindergartenFinanceQuery) => KindergartenFinanceView | undefined
  listAttendance: (date: string) => AttendanceRecord[]
  listChildAttendance: (childId: Id) => AttendanceRecord[]
  listGroupChildren: (groupId: Id) => Child[]
  markAttendance: (input: AttendanceWrite) => ServiceResult<AttendanceRecord | undefined>
  markAttendanceBatch: (items: AttendanceWrite[]) => ServiceResult<{ count: number }>
  checkInSelf: (photo?: string) => ServiceResult<AttendanceRecord>
  checkOutSelf: (photo?: string) => ServiceResult<AttendanceRecord>
  checkInEmployee: (employeeId: Id, photo?: string) => ServiceResult<AttendanceRecord>
  checkOutEmployee: (employeeId: Id, photo?: string) => ServiceResult<AttendanceRecord>
}

export const CareContext = createContext<CareContextValue | null>(null)

export function useCare(): CareContextValue {
  const context = useContext(CareContext)
  if (!context) {
    throw new Error('useCare must be used within CareProvider')
  }
  return context
}
