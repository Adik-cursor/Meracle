import { createContext, useContext } from 'react'
import type {
  BusinessTemplate,
  BusinessType,
  Id,
  PlatformModuleKey,
  User,
} from '../../core/types'
import type {
  CreateCompanyOrganizationWrite,
  PlatformCompanyPeopleView,
  PlatformOrganizationView,
  UserWrite,
} from '../../core/services'

export type PlatformLogRow = {
  id: Id
  organizationId: Id
  actorUserId: Id
  moduleKey: string
  previousValue: string
  nextValue: string
  createdAt: string
  field?: string
}

export type PlatformContextValue = {
  denied: boolean
  organizations: PlatformOrganizationView[] | null
  logs: PlatformLogRow[] | null
  businessTypes: BusinessType[]
  businessTemplates: BusinessTemplate[]
  getOrganization: (id: Id) => PlatformOrganizationView | undefined
  setModuleEnabled: (
    organizationId: Id,
    moduleKey: PlatformModuleKey,
    enabled: boolean,
  ) => boolean
  createCompany: (draft: CreateCompanyOrganizationWrite) => boolean
  suspendCompany: (organizationId: Id) => boolean
  reactivateCompany: (organizationId: Id) => boolean
  archiveCompany: (organizationId: Id) => boolean
  restoreCompany: (organizationId: Id) => boolean
  getCompanyPeople: (organizationId: Id) => PlatformCompanyPeopleView | undefined
  createCompanyUser: (organizationId: Id, draft: UserWrite) => boolean
  getCompanyUser: (organizationId: Id, userId: Id) => User | undefined
  actorName: (userId: Id) => string
  organizationName: (organizationId: Id) => string
}

export const PlatformContext = createContext<PlatformContextValue | null>(null)

export function usePlatform(): PlatformContextValue {
  const context = useContext(PlatformContext)

  if (!context) {
    throw new Error('usePlatform must be used within PlatformProvider')
  }

  return context
}
