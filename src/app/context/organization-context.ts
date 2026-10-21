import { createContext, useContext } from 'react'
import type {
  Locale,
  Organization,
  OrganizationModules,
  OrganizationSettings,
} from '../../core/types'

export type OrganizationContextValue = {
  organization: Organization
  settings: OrganizationSettings
  modules: OrganizationModules
  locale: Locale
  setLocale: (locale: Locale) => void
}

export const OrganizationContext =
  createContext<OrganizationContextValue | null>(null)

export function useOrganization(): OrganizationContextValue {
  const context = useContext(OrganizationContext)

  if (!context) {
    throw new Error('useOrganization must be used within OrganizationProvider')
  }

  return context
}
