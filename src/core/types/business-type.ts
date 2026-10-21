import type { BaseEntity } from './common'

export type BusinessType = BaseEntity & {
  name: string
  description?: string
  active: boolean
}
