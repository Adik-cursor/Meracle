import type { BaseEntity, Id } from './common'

export type RentalUnitStatus =
  | 'available'
  | 'reserved'
  | 'issued'
  | 'inspection'
  | 'unavailable'

export const RENTAL_UNIT_STATUSES: readonly RentalUnitStatus[] = [
  'available',
  'reserved',
  'issued',
  'inspection',
  'unavailable',
]

export type RentalUnit = BaseEntity & {
  productId: Id
  warehouseId: Id
  code: string
  status: RentalUnitStatus
  note?: string
}

export function isRentalUnitStatus(value: string): value is RentalUnitStatus {
  return RENTAL_UNIT_STATUSES.includes(value as RentalUnitStatus)
}
