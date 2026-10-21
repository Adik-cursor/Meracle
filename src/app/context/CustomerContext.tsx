import { useMemo, type ReactNode } from 'react'
import type { CustomerStatus, Id } from '../../core/types'
import {
  createCustomerForUser,
  setCustomerStatus as setCustomerStatusService,
  updateCustomerForUser,
} from '../../core/services'
import { useAccess } from './access-context'
import { useCompanies } from './company-context'
import { useContacts } from './contact-context'
import { useOrganization } from './organization-context'
import { usePersistence, usePersistenceVersion } from './persistence-context'
import {
  CustomerContext,
  type CustomerContextValue,
  type CustomerDraft,
} from './customer-context'

type CustomerProviderProps = {
  children: ReactNode
}

export function CustomerProvider({ children }: CustomerProviderProps) {
  const { organization } = useOrganization()
  const { currentUser } = useAccess()
  const { getContact } = useContacts()
  const { getCompany } = useCompanies()
  const persistence = usePersistence()
  const version = usePersistenceVersion()

  const value = useMemo<CustomerContextValue>(() => {
    void version
    const lookup = { getContact, getCompany }

    return {
      customers: persistence.customers.list(organization.id),
      getCustomer: (id: Id) => {
        const customer = persistence.customers.getById(id)
        return customer?.organizationId === organization.id ? customer : undefined
      },
      createCustomer: (draft: CustomerDraft) => {
        const created = createCustomerForUser(persistence, currentUser, draft, lookup)
        return created.ok ? created.value : null
      },
      updateCustomer: (id: Id, draft: CustomerDraft) =>
        updateCustomerForUser(persistence, currentUser, id, draft, lookup).ok,
      setCustomerStatus: (id: Id, status: CustomerStatus) => {
        setCustomerStatusService(persistence, organization.id, id, status)
      },
    }
  }, [
    currentUser,
    getCompany,
    getContact,
    organization.id,
    persistence,
    version,
  ])

  return (
    <CustomerContext.Provider value={value}>
      {children}
    </CustomerContext.Provider>
  )
}
