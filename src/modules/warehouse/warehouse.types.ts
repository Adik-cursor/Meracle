import type { Warehouse, WarehouseStatus } from '../../core/types'

export type WarehouseDraft = Pick<Warehouse, 'name' | 'status' | 'branchId'> & {
  description?: string
  address?: string
}

export type WarehouseFormMode = 'create' | 'edit'

export type { Warehouse, WarehouseStatus }
