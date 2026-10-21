import { useMemo, useState, type ReactNode } from 'react'
import { defaultOrganization, defaultOrganizationSettings } from '../../core/config/default-organization'
import { DEFAULT_COMPANY_ORGANIZATION_ID } from '../../core/config/platform'
import { navModulesForOrganization } from '../../core/services'
import type { Locale, Organization } from '../../core/types'
import { useAuth } from './auth-context'
import { usePersistence, usePersistenceVersion } from './persistence-context'
import {
  OrganizationContext,
  type OrganizationContextValue,
} from './organization-context'

type OrganizationProviderProps = {
  children: ReactNode
}

function resolveOrganization(
  organizations: { getById: (id: string) => Organization | undefined },
  organizationId: string,
): Organization {
  return (
    organizations.getById(organizationId) ?? {
      ...defaultOrganization,
      id: organizationId,
      organizationId,
    }
  )
}

export function OrganizationProvider({ children }: OrganizationProviderProps) {
  const persistence = usePersistence()
  const version = usePersistenceVersion()
  const { currentUser } = useAuth()
  const [locale, setLocaleState] = useState<Locale>(
    defaultOrganizationSettings.locale,
  )

  const value = useMemo<OrganizationContextValue>(() => {
    void version
    const organizationId =
      currentUser?.organizationId ?? DEFAULT_COMPANY_ORGANIZATION_ID
    const organization = resolveOrganization(
      persistence.organizations,
      organizationId,
    )
    const modules = navModulesForOrganization(persistence, organization.id)
    const settings = {
      ...defaultOrganizationSettings,
      organizationId: organization.id,
      locale,
      timezone: organization.timezone ?? defaultOrganizationSettings.timezone,
      currency: organization.currency ?? defaultOrganizationSettings.currency,
      modules,
    }

    return {
      organization,
      settings,
      modules,
      locale,
      setLocale: setLocaleState,
    }
  }, [currentUser, locale, persistence, version])

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  )
}
