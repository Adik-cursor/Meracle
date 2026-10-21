import type { BaseEntity, Id, IsoDateTime } from './common'
import type { OrganizationModuleStatus, PlatformModuleKey } from './platform-module'

export type OrganizationModuleConfig = BaseEntity & {
  moduleKey: PlatformModuleKey
  status: OrganizationModuleStatus
  enabledAt?: IsoDateTime
  disabledAt?: IsoDateTime
  updatedBy: Id
}
