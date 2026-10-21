import type { BaseEntity } from './common'
import type { Locale } from './localization'
import type { OrganizationModules } from './modules'

export type OrganizationSettings = BaseEntity & {
  locale: Locale
  timezone: string
  currency: string
  modules: OrganizationModules
}
