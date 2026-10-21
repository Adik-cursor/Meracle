import type { BaseEntity, Id } from './common'

export type WarehouseStatus = 'active' | 'inactive'

export type Warehouse = BaseEntity & {
  name: string
  description?: string
  address?: string
  status: WarehouseStatus
  /** Филиал той же организации. Обязателен. */
  branchId: Id
}
