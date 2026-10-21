import type { BaseEntity, Id } from './common'

export type SupplyContractStatus = 'issued' | 'cancelled'

export type SupplyContractProfile = 'universal' | 'equipment' | 'implants'

export type SupplyContractScheduleRow = {
  dueDate: string
  plannedAmount: number
}

export type SupplyContract = BaseEntity & {
  saleId: Id
  customerId: Id
  number: string
  contractDate: string
  status: SupplyContractStatus
  profile: SupplyContractProfile
  createdBy: Id
  currency: string
  total: number
  advanceAmount: number
  remainingAmount: number
  fxRate?: string
  fxRateDate?: string
  correctionCoefficient?: string
  paymentTermsNote?: string
  deliveryAddress?: string
  schedule: SupplyContractScheduleRow[]
}

export function normalizeSupplyContractProfile(value: unknown): SupplyContractProfile {
  if (value === 'equipment' || value === 'implants' || value === 'universal') {
    return value
  }
  return 'universal'
}
