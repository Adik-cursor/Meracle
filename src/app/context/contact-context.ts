import { createContext, useContext } from 'react'
import type { Contact, ContactStatus, Id } from '../../core/types'

export type ContactDraft = {
  firstName: string
  lastName: string
  email?: string
  phone?: string
  status: Extract<ContactStatus, 'active' | 'inactive'>
}

export type ContactContextValue = {
  contacts: Contact[]
  createContact: (draft: ContactDraft) => Contact | undefined
  updateContact: (id: Id, draft: ContactDraft) => void
  setContactStatus: (
    id: Id,
    status: Extract<ContactStatus, 'active' | 'inactive'>,
  ) => void
  getContact: (id: Id) => Contact | undefined
}

export const ContactContext = createContext<ContactContextValue | null>(null)

export function useContacts(): ContactContextValue {
  const context = useContext(ContactContext)

  if (!context) {
    throw new Error('useContacts must be used within ContactProvider')
  }

  return context
}
