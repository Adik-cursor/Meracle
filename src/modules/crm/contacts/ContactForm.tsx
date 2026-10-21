import { useState, type FormEvent } from 'react'
import { useLocalization } from '../../../app/context/localization-context'
import type { Contact } from '../../../core/types'
import type { ContactDraft } from '../../../app/context/contact-context'

type ContactFormProps = {
  contact?: Contact
  onSubmit: (draft: ContactDraft) => void
  onCancel: () => void
}

export function ContactForm({ contact, onSubmit, onCancel }: ContactFormProps) {
  const { t } = useLocalization()
  const [firstName, setFirstName] = useState(contact?.firstName ?? '')
  const [lastName, setLastName] = useState(contact?.lastName ?? '')
  const [email, setEmail] = useState(contact?.email ?? '')
  const [phone, setPhone] = useState(contact?.phone ?? '')
  const [status, setStatus] = useState<'active' | 'inactive'>(
    contact?.status === 'inactive' ? 'inactive' : 'active',
  )
  const [errorKey, setErrorKey] = useState<
    'firstNameRequired' | 'lastNameRequired' | null
  >(null)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!firstName.trim()) {
      setErrorKey('firstNameRequired')
      return
    }

    if (!lastName.trim()) {
      setErrorKey('lastNameRequired')
      return
    }

    onSubmit({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      status,
    })
  }

  return (
    <form className="warehouse-form settings-section" onSubmit={handleSubmit}>
      <h2>{contact ? t('editContact') : t('newContact')}</h2>

      <label className="warehouse-field">
        <span className="settings-field__label">{t('firstName')}</span>
        <input
          className="warehouse-input"
          type="text"
          name="firstName"
          value={firstName}
          onChange={(event) => {
            setFirstName(event.target.value)
            if (errorKey) {
              setErrorKey(null)
            }
          }}
        />
      </label>

      <label className="warehouse-field">
        <span className="settings-field__label">{t('lastName')}</span>
        <input
          className="warehouse-input"
          type="text"
          name="lastName"
          value={lastName}
          onChange={(event) => {
            setLastName(event.target.value)
            if (errorKey) {
              setErrorKey(null)
            }
          }}
        />
      </label>

      <label className="warehouse-field">
        <span className="settings-field__label">{t('email')}</span>
        <input
          className="warehouse-input"
          type="text"
          name="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>

      <label className="warehouse-field">
        <span className="settings-field__label">{t('phone')}</span>
        <input
          className="warehouse-input"
          type="text"
          name="phone"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
        />
      </label>

      <label className="warehouse-field">
        <span className="settings-field__label">{t('status')}</span>
        <select
          className="warehouse-input"
          name="status"
          value={status}
          onChange={(event) =>
            setStatus(event.target.value === 'inactive' ? 'inactive' : 'active')
          }
        >
          <option value="active">{t('active')}</option>
          <option value="inactive">{t('inactive')}</option>
        </select>
      </label>

      {errorKey ? (
        <p className="warehouse-field__error">{t(errorKey)}</p>
      ) : null}

      <div className="warehouse-form__actions">
        <button type="submit" className="module-switch module-switch--on">
          {contact ? t('save') : t('create')}
        </button>
        <button type="button" className="module-switch" onClick={onCancel}>
          {t('cancel')}
        </button>
      </div>
    </form>
  )
}
