import { useMemo, type ReactNode } from 'react'
import type { ContactStatus, Id } from '../../core/types'
import {
  createContactForUser,
  listContactsForUser,
} from '../../core/services'
import { nowIso } from '../../core/services/primitives'
import { useAccess } from './access-context'
import { useOrganization } from './organization-context'
import { usePersistence, usePersistenceVersion } from './persistence-context'
import {
  ContactContext,
  type ContactContextValue,
  type ContactDraft,
} from './contact-context'

type ContactProviderProps = {
  children: ReactNode
}

function toNullableText(value: string | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export function ContactProvider({ children }: ContactProviderProps) {
  const { organization } = useOrganization()
  const { currentUser } = useAccess()
  const persistence = usePersistence()
  const version = usePersistenceVersion()

  const value = useMemo<ContactContextValue>(() => {
    void version
    const listed = currentUser
      ? listContactsForUser(persistence, currentUser, organization.id)
      : undefined
    const contacts = listed?.ok
      ? listed.value
      : listed?.error.code === 'MODULE_NOT_ENABLED'
        ? persistence.contacts.list(organization.id)
        : []

    const getContact = (id: Id) => {
      const contact = persistence.contacts.getById(id)
      return contact?.organizationId === organization.id ? contact : undefined
    }

    const createContact = (draft: ContactDraft) => {
      const created = createContactForUser(persistence, currentUser, {
        firstName: draft.firstName,
        lastName: draft.lastName,
        email: draft.email,
        phone: draft.phone,
        status: draft.status,
      })
      return created.ok ? created.value : undefined
    }

    const updateContact = (id: Id, draft: ContactDraft) => {
      const firstName = draft.firstName.trim()
      const lastName = draft.lastName.trim()
      if (!firstName || !lastName) {
        return
      }

      const existing = getContact(id)
      if (!existing) {
        return
      }

      persistence.contacts.update(id, {
        firstName,
        lastName,
        email: toNullableText(draft.email),
        phone: toNullableText(draft.phone),
        status: draft.status,
        updatedAt: nowIso(),
      })
    }

    const setContactStatus = (
      id: Id,
      status: Extract<ContactStatus, 'active' | 'inactive'>,
    ) => {
      const existing = getContact(id)
      if (!existing) {
        return
      }

      persistence.contacts.update(id, {
        status,
        updatedAt: nowIso(),
      })
    }

    return {
      contacts,
      createContact,
      updateContact,
      setContactStatus,
      getContact,
    }
  }, [currentUser, organization.id, persistence, version])

  return (
    <ContactContext.Provider value={value}>{children}</ContactContext.Provider>
  )
}
