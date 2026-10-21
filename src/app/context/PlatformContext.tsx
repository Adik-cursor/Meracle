import { useMemo, type ReactNode } from 'react'
import type { Id, PlatformModuleKey } from '../../core/types'
import {
  createCompanyOrganizationForPlatformUser,
  createUserForPlatformUser,
  disableModuleForPlatformUser,
  enableModuleForPlatformUser,
  archiveCompanyForPlatformUser,
  getCompanyPeopleForPlatformUser,
  getCompanyUserForPlatformUser,
  getOrganizationModulesForPlatformUser,
  isPlatformOwner,
  listBusinessTemplatesForPlatformUser,
  listBusinessTypesForPlatformUser,
  listPlatformModuleLogsForUser,
  listPlatformOrganizationsForUser,
  reactivateCompanyForPlatformUser,
  restoreCompanyForPlatformUser,
  suspendCompanyForPlatformUser,
} from '../../core/services'
import { useAccess } from './access-context'
import { usePersistence, usePersistenceVersion } from './persistence-context'
import { userDisplayName } from '../../modules/crm/users/user-name'
import {
  PlatformContext,
  type PlatformContextValue,
} from './platform-context'

type PlatformProviderProps = {
  children: ReactNode
}

export function PlatformProvider({ children }: PlatformProviderProps) {
  const { currentUser } = useAccess()
  const persistence = usePersistence()
  const version = usePersistenceVersion()

  const value = useMemo<PlatformContextValue>(() => {
    void version
    const denied = Boolean(currentUser) && !isPlatformOwner(currentUser)
    const listed = listPlatformOrganizationsForUser(persistence, currentUser)
    const logs = listPlatformModuleLogsForUser(persistence, currentUser)
    const types = listBusinessTypesForPlatformUser(persistence, currentUser)
    const templates = listBusinessTemplatesForPlatformUser(
      persistence,
      currentUser,
    )

    return {
      denied,
      organizations: listed.ok ? listed.value : denied ? [] : null,
      logs: logs.ok ? logs.value : denied ? [] : null,
      businessTypes: types.ok ? types.value : [],
      businessTemplates: templates.ok ? templates.value : [],
      getOrganization: (id: Id) => {
        const result = getOrganizationModulesForPlatformUser(
          persistence,
          currentUser,
          id,
        )
        return result.ok ? result.value : undefined
      },
      setModuleEnabled: (organizationId, moduleKey: PlatformModuleKey, enabled) => {
        const result = enabled
          ? enableModuleForPlatformUser(
              persistence,
              currentUser,
              organizationId,
              moduleKey,
            )
          : disableModuleForPlatformUser(
              persistence,
              currentUser,
              organizationId,
              moduleKey,
            )
        return result.ok
      },
      createCompany: (draft) =>
        createCompanyOrganizationForPlatformUser(
          persistence,
          currentUser,
          draft,
        ).ok,
      suspendCompany: (organizationId) =>
        suspendCompanyForPlatformUser(persistence, currentUser, organizationId).ok,
      reactivateCompany: (organizationId) =>
        reactivateCompanyForPlatformUser(persistence, currentUser, organizationId).ok,
      archiveCompany: (organizationId) =>
        archiveCompanyForPlatformUser(persistence, currentUser, organizationId).ok,
      restoreCompany: (organizationId) =>
        restoreCompanyForPlatformUser(persistence, currentUser, organizationId).ok,
      getCompanyPeople: (organizationId: Id) => {
        const result = getCompanyPeopleForPlatformUser(
          persistence,
          currentUser,
          organizationId,
        )
        return result.ok ? result.value : undefined
      },
      createCompanyUser: (organizationId, draft) =>
        createUserForPlatformUser(
          persistence,
          currentUser,
          organizationId,
          draft,
        ).ok,
      getCompanyUser: (organizationId, userId) => {
        const result = getCompanyUserForPlatformUser(
          persistence,
          currentUser,
          organizationId,
          userId,
        )
        return result.ok ? result.value : undefined
      },
      actorName: (userId: Id) => {
        const user = persistence.users.getById(userId)
        return user ? userDisplayName(user) : userId
      },
      organizationName: (organizationId: Id) => {
        const organization = persistence.organizations.getById(organizationId)
        return organization ? organization.name : organizationId
      },
    }
  }, [currentUser, persistence, version])

  return (
    <PlatformContext.Provider value={value}>{children}</PlatformContext.Provider>
  )
}
