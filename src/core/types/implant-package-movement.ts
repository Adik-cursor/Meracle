import type { BaseEntity, Id } from './common'

export type ImplantPackageMovementType =
  | 'issued'
  | 'used'
  | 'returned'
  | 'replaced'
  | 'written_off'

export type ImplantPackageMovement = BaseEntity & {
  packageId: Id
  productId: Id
  warehouseId?: Id
  movementType: ImplantPackageMovementType
  quantity: number
  date: string
  performedBy: Id
  note?: string
}
