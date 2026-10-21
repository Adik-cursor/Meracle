import { useState, type FormEvent } from 'react'
import { useLocalization } from '../../../app/context/localization-context'
import type { DepartmentDraft } from '../../../app/context/department-context'
import type { Branch, Department } from '../../../core/types'

type DepartmentFormProps = {
  department?: Department
  branches: Branch[]
  onSubmit: (draft: DepartmentDraft) => boolean
  onCancel: () => void
}

export function DepartmentForm({
  department,
  branches,
  onSubmit,
  onCancel,
}: DepartmentFormProps) {
  const { t } = useLocalization()
  const [name, setName] = useState(department?.name ?? '')
  const [code, setCode] = useState(department?.code ?? '')
  const [branchId, setBranchId] = useState(department?.branchId ?? '')
  const [nameError, setNameError] = useState(false)
  const [branchError, setBranchError] = useState(false)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextNameError = !name.trim()
    const nextBranchError = !branchId
    setNameError(nextNameError)
    setBranchError(nextBranchError)

    if (nextNameError || nextBranchError) {
      return
    }

    const saved = onSubmit({
      name: name.trim(),
      code: code.trim() || undefined,
      branchId,
    })

    if (saved) {
      onCancel()
    }
  }

  return (
    <form className="warehouse-form settings-section" onSubmit={handleSubmit}>
      <h2>{department ? t('editDepartment') : t('addDepartment')}</h2>

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

      <label className="warehouse-field">
        <span className="settings-field__label">{t('navBranches')}</span>
        {branches.length === 0 ? (
          <p className="workspace-muted">{t('noBranches')}</p>
        ) : (
          <select
            className="warehouse-input"
            name="branchId"
            value={branchId}
            onChange={(event) => {
              setBranchId(event.target.value)
              if (branchError) {
                setBranchError(false)
              }
            }}
            aria-invalid={branchError ? true : undefined}
          >
            <option value="">{t('dealPartyNone')}</option>
            {branches.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        )}
        {branchError ? (
          <span className="warehouse-field__error">{t('branchRequired')}</span>
        ) : null}
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
