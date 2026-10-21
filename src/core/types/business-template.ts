import type { BaseEntity, Id } from './common'
import type { PlatformModuleKey } from './platform-module'

export type BusinessTemplate = BaseEntity & {
  businessTypeId: Id
  name: string
  description?: string
  moduleIds: PlatformModuleKey[]
  active: boolean
}
