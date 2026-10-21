import type { OrganizationModules } from './modules'
import type { Organization } from './organization'
import type { OrganizationSettings } from './organization-settings'

export type OrganizationContextState = {
  organization: Organization
  settings: OrganizationSettings
  modules: OrganizationModules
}
