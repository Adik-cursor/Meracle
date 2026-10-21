import { useState, type FormEvent } from 'react'
import { useLocalization } from '../../../app/context/localization-context'
import type { BranchDraft } from '../../../app/context/branch-context'
import type { Branch } from '../../../core/types'

type BranchFormProps = {
  branch?: Branch
  onSubmit: (draft: BranchDraft) => boolean
  onCancel: () => void
}

export function BranchForm({ branch, onSubmit, onCancel }: BranchFormProps) {
  const { t } = useLocalization()
  const [name, setName] = useState(branch?.name ?? '')
  const [code, setCode] = useState(branch?.code ?? '')
  const [nameError, setNameError] = useState(false)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextNameError = !name.trim()
    setNameError(nextNameError)

    if (nextNameError) {
      return
    }

    const saved = onSubmit({
      name: name.trim(),
      code: code.trim() || undefined,
    })

    if (saved) {
      onCancel()
    }
  }

  return (
    <form className="warehouse-form settings-section" onSubmit={handleSubmit}>
      <h2>{branch ? t('editBranch') : t('addBranch')}</h2>

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
          aria-invalid={nameError ? true : undefined}
        />
        {nameError ? (
          <span className="warehouse-field__error">{t('titleRequired')}</span>
        ) : null}
      </label>

      <label className="warehouse-field">
        <span className="settings-field__label">{t('code')}</span>
        <input
          className="warehouse-input"
          type="text"
          name="code"
          value={code}
          onChange={(event) => setCode(event.target.value)}
        />
      </label>

      <div className="warehouse-form__actions">
        <button type="submit" className="module-switch module-switch--on">
          {t('save')}
        </button>
        <button type="button" className="module-switch" onClick={onCancel}>
          {t('cancel')}
        </button>
      </div>
    </form>
  )
}
