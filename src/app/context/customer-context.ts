import { createContext, useContext } from 'react'
import type { Customer, CustomerStatus, CustomerType, Id } from '../../core/types'

export type CustomerDraft = {
  type: CustomerType
  contactId?: string
  companyId?: string
  status: CustomerStatus
  taxId?: string
}

export type CustomerContextValue = {
  customers: Customer[]
  createCustomer: (draft: CustomerDraft) => Customer | null
  updateCustomer: (id: Id, draft: CustomerDraft) => boolean
  setCustomerStatus: (id: Id, status: CustomerStatus) => void
  getCustomer: (id: Id) => Customer | undefined
}

export const CustomerContext = createContext<CustomerContextValue | null>(null)

export function useCustomers(): CustomerContextValue {
  const context = useContext(CustomerContext)

  if (!context) {
    throw new Error('useCustomers must be used within CustomerProvider')
  }

  return context
}
