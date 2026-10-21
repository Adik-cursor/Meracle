import { useState } from 'react'
import { useContacts } from '../../context/contact-context'
import { useLocalization } from '../../context/localization-context'
import { ContactForm } from '../../../modules/crm/contacts/ContactForm'
import { contactDisplayName } from '../../../modules/crm/customers/customer-name'
import type { Contact } from '../../../core/types'
import type { ContactDraft } from '../../context/contact-context'

export function ContactsPage() {
  const { t } = useLocalization()
  const { contacts, createContact, updateContact, setContactStatus } =
    useContacts()
  const [formMode, setFormMode] = useState<'closed' | 'create' | 'edit'>(
    'closed',
  )
  const [editingContact, setEditingContact] = useState<Contact | null>(null)

  const closeForm = () => {
    setFormMode('closed')
    setEditingContact(null)
  }

  const selectedContact =
    formMode === 'edit' && editingContact
      ? contacts.find((contact) => contact.id === editingContact.id)
      : undefined

  const handleCreate = (draft: ContactDraft) => {
    if (createContact(draft)) {
      closeForm()
    }
  }

  const handleUpdate = (draft: ContactDraft) => {
    if (!selectedContact) {
      return
    }

    updateContact(selectedContact.id, draft)
    closeForm()
  }

  return (
    <section className="workspace-page contacts-page entity-directory-page">
      <div className="workspace-toolbar">
        <h2 className="workspace-toolbar__title">{t('navContacts')}</h2>
        {formMode === 'closed' && contacts.length > 0 ? (
          <button
            type="button"
            className="module-switch module-switch--on"
            onClick={() => setFormMode('create')}
          >
            {t('addContact')}
          </button>
        ) : null}
      </div>

      {formMode === 'create' ? (
        <ContactForm onSubmit={handleCreate} onCancel={closeForm} />
      ) : null}

      {formMode === 'edit' && selectedContact ? (
        <ContactForm
          key={`${selectedContact.id}-${selectedContact.updatedAt}`}
          contact={selectedContact}
          onSubmit={handleUpdate}
          onCancel={closeForm}
        />
      ) : null}

      {contacts.length === 0 && formMode === 'closed' ? (
        <div className="warehouse-empty settings-section">
          <p>{t('noContacts')}</p>
          <button
            type="button"
            className="module-switch module-switch--on"
            onClick={() => setFormMode('create')}
          >
            {t('addContact')}
          </button>
        </div>
      ) : null}

      {contacts.length > 0 ? (
        <div className="inventory-table-wrap settings-section">
          <table className="inventory-table">
            <thead>
              <tr>
                <th>{t('customerName')}</th>
                <th>{t('status')}</th>
                <th>{t('transferActions')}</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((contact) => {
                const isActive = contact.status === 'active'

                return (
                  <tr key={contact.id}>
                    <td>{contactDisplayName(contact)}</td>
                    <td>{isActive ? t('active') : t('inactive')}</td>
                    <td>
                      <div className="warehouse-card__actions">
                        <button
                          type="button"
                          className="module-switch"
                          onClick={() => {
                            setEditingContact(contact)
                            setFormMode('edit')
                          }}
                        >
                          {t('edit')}
                        </button>
                        <button
                          type="button"
                          className={
                            isActive
                              ? 'module-switch'
                              : 'module-switch module-switch--on'
                          }
                          onClick={() =>
                            setContactStatus(
                              contact.id,
                              isActive ? 'inactive' : 'active',
                            )
                          }
                        >
                          {isActive ? t('turnOff') : t('turnOn')}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  )
}
