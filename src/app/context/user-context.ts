import { createContext, useContext } from 'react'
import type { Id, ServiceResult, User, UserRole, UserStatus } from '../../core/types'
import type { AccessChangeLog } from '../../core/types/access-change-log'
import type {
  PermissionOverrideDomain,
  PermissionOverrideEffect,
} from '../../core/types/permission-override'
import type { UserListFilter } from '../../core/services'

export type UserDraft = {
  firstName: string
  lastName: string
  email?: string
  role: UserRole
  status: UserStatus
  phone?: string
  avatarUrl?: string
  jobTitle?: string
  accountEnabled?: boolean
  careGroupId?: Id
  managerId?: Id
  branchId?: Id
  departmentId?: Id
  warehouseId?: Id
  salaryAmount?: number
}

export type FirstOwnerDraft = {
  firstName: string
  lastName: string
  email: string
}

export type UserContextValue = {
  users: User[]
  hasOrganizationUsers: boolean
  getUser: (id: Id) => User | undefined
  getUserAccess: (
    id: Id,
  ) =>
    | { ok: true; user: User }
    | {
        ok: false
        code: 'USER_NOT_FOUND' | 'ACCESS_DENIED' | 'CURRENT_USER_REQUIRED'
      }
  createUser: (draft: UserDraft) => boolean
  createFirstOwner: (draft: FirstOwnerDraft) => ServiceResult<User>
  updateUser: (id: Id, draft: UserDraft) => boolean
  setUserStatus: (id: Id, status: Extract<UserStatus, 'active' | 'disabled'>) => void
  enableAccount: (id: Id, email?: string) => boolean
  disableAccount: (id: Id) => boolean
  searchUsers: (query: string) => User[]
  filterUsers: (filter: UserListFilter) => User[]
  setPermissionOverride: (
    userId: Id,
    domain: PermissionOverrideDomain,
    permission: string,
    effect: PermissionOverrideEffect,
    reason?: string,
  ) => boolean
  removePermissionOverride: (
    userId: Id,
    domain: PermissionOverrideDomain,
    permission: string,
  ) => boolean
  accessChangeLogs: AccessChangeLog[]
}

export const UserContext = createContext<UserContextValue | null>(null)

export function useUsers(): UserContextValue {
  const context = useContext(UserContext)

  if (!context) {
    throw new Error('useUsers must be used within UserProvider')
  }

  return context
}
