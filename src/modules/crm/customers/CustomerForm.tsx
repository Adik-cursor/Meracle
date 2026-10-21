import { useState, type FormEvent } from 'react'
import { useContacts } from '../../../app/context/contact-context'
import { useLocalization } from '../../../app/context/localization-context'
import { useOrganization } from '../../../app/context/organization-context'
import { usesCareCrmComposition } from '../../../app/routes/app.routes'
import type { CustomerDraft } from '../../../app/context/customer-context'
import type { Company, Contact, Customer } from '../../../core/types'
import { contactDisplayName } from './customer-name'

type CustomerFormProps = {
  customer?: Customer
  contacts: Contact[]
  companies: Company[]
  onSubmit: (draft: CustomerDraft) => boolean
  onCancel: () => void
  onGoToContacts: () => void
  onGoToCompanies: () => void
}

export function CustomerForm({
  customer,
  contacts,
  companies,
  onSubmit,
  onCancel,
  onGoToContacts,
  onGoToCompanies,
}: CustomerFormProps) {
  const { t } = useLocalization()
  const { modules } = useOrganization()
  const parentMode = usesCareCrmComposition(modules)
  const { createContact } = useContacts()
  const [type, setType] = useState(parentMode ? 'contact' : (customer?.type ?? 'contact'))
  const [contactId, setContactId] = useState(customer?.contactId ?? '')
  const [companyId, setCompanyId] = useState(customer?.companyId ?? '')
  const [status, setStatus] = useState(customer?.status ?? 'active')
  const [taxId, setTaxId] = useState(customer?.taxId ?? '')
  const [error, setError] = useState<string | null>(null)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')

  const taxIdLabel = type === 'company' ? t('bin') : t('iin')

  const draftWithTax = (base: CustomerDraft): CustomerDraft | null => {
    const digits = taxId.replace(/\s+/g, '')
    if (digits && !/^\d{12}$/.test(digits)) {
      setError(t('CUSTOMER_TAX_ID_INVALID'))
      return null
    }
    return { ...base, taxId: digits || undefined }
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (parentMode) {
      let nextContactId = contactId
      if (!nextContactId) {
        if (!firstName.trim() || !lastName.trim()) {
          setError(t('titleRequired'))
          return
        }
        const created = createContact({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim() || undefined,
          status: 'active',
        })
        if (!created) {
          setError(t('customerReferenceRequired'))
          return
        }
        nextContactId = created.id
      }
      const draft = draftWithTax({ type: 'contact', contactId: nextContactId, status })
      if (!draft) {
        return
      }
      const saved = onSubmit(draft)
      if (!saved) {
        setError(t('customerReferenceRequired'))
      }
      return
    }

    const draft: CustomerDraft | null =
      type === 'contact'
        ? draftWithTax({ type: 'contact', contactId, status })
        : draftWithTax({ type: 'company', companyId, status })

    if (!draft) {
      return
    }

    if (type === 'contact' && !contactId) {
      setError(t('customerSelectContact'))
      return
    }

    if (type === 'company' && !companyId) {
      setError(t('customerSelectCompany'))
      return
    }

    const saved = onSubmit(draft)

    if (!saved) {
      setError(t('customerReferenceRequired'))
    }
  }

  return (
    <form className="warehouse-form settings-section" onSubmit={handleSubmit}>
      <h2>{customer ? (parentMode ? t('edit') : t('editCustomer')) : parentMode ? t('addParent') : t('newCustomer')}</h2>

      {parentMode ? null : (
      <label className="warehouse-field">
        <span className="settings-field__label">{t('customerType')}</span>
        <select
          className="warehouse-input"
          name="type"
          value={type}
          onChange={(event) => {
            const nextType =
              event.target.value === 'company' ? 'company' : 'contact'
            setType(nextType)
            setError(null)
          }}
        >
          <option value="contact">{t('customerPerson')}</option>
          <option value="company">{t('customerCompany')}</option>
        </select>
      </label>
      )}

      <label className="warehouse-field">
        <span className="settings-field__label">{taxIdLabel}</span>
        <input
          className="warehouse-input"
          name="taxId"
          inputMode="numeric"
          autoComplete="off"
          value={taxId}
          placeholder="123456789012"
          onChange={(event) => {
            setTaxId(event.target.value)
            setError(null)
          }}
        />
      </label>

      {parentMode ? (
        <>
          {contacts.length > 0 ? (
            <label className="warehouse-field">
              <span className="settings-field__label">{t('existingParentContact')}</span>
              <select
                className="warehouse-input"
                name="contactId"
                value={contactId}
                onChange={(event) => {
                  setContactId(event.target.value)
                  setError(null)
                }}
              >
                <option value="">{t('newParentContact')}</option>
                {contacts.map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {contactDisplayName(contact)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {contactId ? null : (
            <>
              <label className="warehouse-field">
                <span className="settings-field__label">{t('inquiryParent')}</span>
                <input
                  className="warehouse-input"
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  placeholder={t('firstName')}
                />
              </label>
              <label className="warehouse-field">
                <input
                  className="warehouse-input"
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  placeholder={t('lastName')}
                />
              </label>
              <label className="warehouse-field">
                <span className="settings-field__label">{t('inquiryPhone')}</span>
                <input
                  className="warehouse-input"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                />
              </label>
            </>
          )}
        </>
      ) : type === 'contact' ? (
        contacts.length === 0 ? (
          <div className="warehouse-empty">
            <p>{t('createContactFirst')}</p>
            <button
              type="button"
              className="module-switch module-switch--on"
              onClick={onGoToContacts}
            >
              {t('navContacts')}
            </button>
          </div>
        ) : (
          <label className="warehouse-field">
            <span className="settings-field__label">{t('navContacts')}</span>
            <select
              className="warehouse-input"
              name="contactId"
              value={contactId}
              onChange={(event) => {
                setContactId(event.target.value)
                setError(null)
              }}
            >
              <option value="">{t('customerSelectContact')}</option>
              {contacts.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contactDisplayName(contact)}
                </option>
              ))}
            </select>
          </label>
        )
      ) : companies.length === 0 ? (
        <div className="warehouse-empty">
          <p>{t('createCompanyFirst')}</p>
          <button
            type="button"
            className="module-switch module-switch--on"
            onClick={onGoToCompanies}
          >
            {t('navCompanies')}
          </button>
        </div>
      ) : (
        <label className="warehouse-field">
          <span className="settings-field__label">{t('navCompanies')}</span>
          <select
            className="warehouse-input"
            name="companyId"
            value={companyId}
            onChange={(event) => {
              setCompanyId(event.target.value)
              setError(null)
            }}
          >
            <option value="">{t('customerSelectCompany')}</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </label>
      )}

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

      {error ? <p className="warehouse-field__error">{error}</p> : null}

      <div className="warehouse-form__actions">
        <button
          type="submit"
          className="module-switch module-switch--on"
          disabled={
            parentMode
              ? false
              : type === 'contact'
                ? contacts.length === 0
                : companies.length === 0
          }
        >
          {customer ? t('save') : t('create')}
        </button>
        <button type="button" className="module-switch" onClick={onCancel}>
          {t('cancel')}
        </button>
      </div>
    </form>
  )
}
