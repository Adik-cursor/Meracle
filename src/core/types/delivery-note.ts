import type { BaseEntity, Id } from './common'
import type { PartySnapshot } from './party-snapshot'

export type DeliveryNoteItemSnapshot = {
  index: number
  name: string
  sku: string
  unit: string
  quantity: number
  price: number
  total: number
  vatLabel: string
}

export type DeliveryNote = BaseEntity & {
  saleId: Id
  documentNumber: string
  documentDate: string
  customerId: Id
  currency: string
  total: number
  contractLabel: string
  shipper: PartySnapshot
  consignee: PartySnapshot
  items: DeliveryNoteItemSnapshot[]
  performerName: string
  createdBy: Id
}
