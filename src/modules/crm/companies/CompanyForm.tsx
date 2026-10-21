import { useState, type FormEvent } from 'react'
import { useLocalization } from '../../../app/context/localization-context'
import type { Company } from '../../../core/types'
import type { CompanyDraft } from '../../../app/context/company-context'

type CompanyFormProps = {
  company?: Company
  onSubmit: (draft: CompanyDraft) => void
  onCancel: () => void
}

export function CompanyForm({ company, onSubmit, onCancel }: CompanyFormProps) {
  const { t } = useLocalization()
  const [name, setName] = useState(company?.name ?? '')
  const [website, setWebsite] = useState(company?.website ?? '')
  const [status, setStatus] = useState<'active' | 'inactive'>(
    company?.status === 'inactive' ? 'inactive' : 'active',
  )
  const [nameError, setNameError] = useState(false)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!name.trim()) {
      setNameError(true)
      return
    }

    onSubmit({
      name: name.trim(),
      website: website.trim() || undefined,
      status,
    })
  }

  return (
    <form className="warehouse-form settings-section" onSubmit={handleSubmit}>
      <h2>{company ? t('editCompany') : t('newCompany')}</h2>

      <label className="warehouse-field">
        <span className="settings-field__label">{t('name')}</span>
        <input
          className="warehouse-input"
          type="text"
          name="name"
          value={name}
          onChange={(event) => {
            setName(event.target.value)
            if (nameError) {
              setNameError(false)
            }
          }}
        />
        {nameError ? (
          <span className="warehouse-field__error">{t('nameRequired')}</span>
        ) : null}
      </label>

      <label className="warehouse-field">
        <span className="settings-field__label">{t('website')}</span>
        <input
          className="warehouse-input"
          type="text"
          name="website"
          value={website}
          onChange={(event) => setWebsite(event.target.value)}
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

      <div className="warehouse-form__actions">
        <button type="submit" className="module-switch module-switch--on">
          {company ? t('save') : t('create')}
        </button>
        <button type="button" className="module-switch" onClick={onCancel}>
          {t('cancel')}
        </button>
      </div>
    </form>
  )
}
