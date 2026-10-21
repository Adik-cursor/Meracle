import { useMemo, type ReactNode } from 'react'
import type { Id, UserStatus } from '../../core/types'
import {
  createFirstOwner,
  createUserForUser,
  getUserForUser,
  filterUsersForUser,
  listAccessChangeLogsForUser,
  listUsersForUser,
  removeUserPermissionOverrideForUser,
  searchUsersForUser,
  setUserPermissionOverrideForUser,
  setUserStatusForUser,
  enableAccountForUser,
  disableAccountForUser,
  updateUserForUser,
} from '../../core/services'
import { useAccess } from './access-context'
import { useOrganization } from './organization-context'
import { usePersistence, usePersistenceVersion } from './persistence-context'
import { UserContext, type FirstOwnerDraft, type UserContextValue, type UserDraft } from './user-context'

type UserProviderProps = {
  children: ReactNode
}

export function UserProvider({ children }: UserProviderProps) {
  const { organization } = useOrganization()
  const { currentUser } = useAccess()
  const persistence = usePersistence()
  const version = usePersistenceVersion()

  const value = useMemo<UserContextValue>(() => {
    void version
    const listed = listUsersForUser(persistence, currentUser)

    return {
      users: listed.ok ? listed.value : [],
      hasOrganizationUsers:
        persistence.users.list(organization.id).length > 0,
      getUser: (id: Id) => {
        const result = getUserForUser(persistence, currentUser, id)
        return result.ok ? result.value : undefined
      },
      getUserAccess: (id: Id) => {
        const result = getUserForUser(persistence, currentUser, id)
        if (result.ok) {
          return { ok: true as const, user: result.value }
        }

        const code = result.error.code
        if (
          code === 'USER_NOT_FOUND' ||
          code === 'ACCESS_DENIED' ||
          code === 'CURRENT_USER_REQUIRED'
        ) {
          return { ok: false as const, code }
        }

        return { ok: false as const, code: 'ACCESS_DENIED' as const }
      },
      createUser: (draft: UserDraft) =>
        createUserForUser(persistence, currentUser, organization.id, draft).ok,
      createFirstOwner: (draft: FirstOwnerDraft) =>
        createFirstOwner(persistence, organization.id, draft),
      updateUser: (id: Id, draft: UserDraft) =>
        updateUserForUser(persistence, currentUser, organization.id, id, draft)
          .ok,
      setUserStatus: (
        id: Id,
        status: Extract<UserStatus, 'active' | 'disabled'>,
      ) => {
        setUserStatusForUser(
          persistence,
          currentUser,
          organization.id,
          id,
          status,
        )
      },
      enableAccount: (id: Id, email?: string) =>
        enableAccountForUser(
          persistence,
          currentUser,
          organization.id,
          id,
          email,
        ).ok,
      disableAccount: (id: Id) =>
        disableAccountForUser(persistence, currentUser, organization.id, id).ok,
      searchUsers: (query: string) => {
        const result = searchUsersForUser(persistence, currentUser, query)
        return result.ok ? result.value : []
      },
      filterUsers: (filter) => {
        const result = filterUsersForUser(persistence, currentUser, filter)
        return result.ok ? result.value : []
      },
      setPermissionOverride: (
        userId: Id,
        domain,
        permission,
        effect,
        reason,
      ) =>
        setUserPermissionOverrideForUser(
          persistence,
          currentUser,
          organization.id,
          userId,
          domain,
          permission,
          effect,
          reason,
        ).ok,
      removePermissionOverride: (userId, domain, permission) =>
        removeUserPermissionOverrideForUser(
          persistence,
          currentUser,
          organization.id,
          userId,
          domain,
          permission,
        ).ok,
      accessChangeLogs: (() => {
        const listed = listAccessChangeLogsForUser(persistence, currentUser)
        return listed.ok ? listed.value : []
      })(),
    }
  }, [currentUser, organization.id, persistence, version])

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>
}
