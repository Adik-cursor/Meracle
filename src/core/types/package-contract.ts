import type { BaseEntity, Id } from './common'

export type PackageContractStatus = 'draft' | 'issued' | 'signed' | 'cancelled'

export type PackageContract = BaseEntity & {
  packageId: Id
  customerId: Id
  contractNumber: string
  contractDate: string
  status: PackageContractStatus
  templateId?: Id
  fileId?: Id
}
