import type { BaseEntity, Id } from './common'

export type SaleInvoiceStatus = 'draft' | 'issued' | 'paid' | 'cancelled'

export type SaleInvoice = BaseEntity & {
  saleId: Id
  invoiceNumber: string
  invoiceDate: string
  customerId?: Id
  status: SaleInvoiceStatus
  currency: string
  subtotal: number
  discount: number
  total: number
  notes?: string
  createdBy: Id
}
