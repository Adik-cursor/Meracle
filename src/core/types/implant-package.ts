import type { BaseEntity, Id } from './common'

export type ImplantPackageStatus = 'draft' | 'active' | 'completed' | 'cancelled'

export type ImplantPackage = BaseEntity & {
  customerId: Id
  name: string
  price: number
  currency: string
  totalImplants: number
  status: ImplantPackageStatus
  startDate: string
  endDate?: string
  responsibleEmployeeId?: Id
  contractId?: Id
  notes?: string
}

export type ImplantPackageBalance = {
  total: number
  issued: number
  used: number
  returned: number
  remaining: number
  paid: number
  debt: number
}
