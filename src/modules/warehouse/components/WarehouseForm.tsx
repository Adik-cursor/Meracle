import { useState, type FormEvent } from 'react'
import { useBranches } from '../../../app/context/branch-context'
import { useLocalization } from '../../../app/context/localization-context'
import type { Warehouse } from '../../../core/types'
import type { WarehouseDraft, WarehouseFormMode } from '../warehouse.types'
import { Button } from '../../../shared/ui'

type WarehouseFormProps = {
  mode: WarehouseFormMode
  warehouse?: Warehouse
  onSubmit: (draft: WarehouseDraft) => void
  onCancel: () => void
}

export function WarehouseForm({
  mode,
  warehouse,
  onSubmit,
  onCancel,
}: WarehouseFormProps) {
  const { t } = useLocalization()
  const { branches } = useBranches()
  const [name, setName] = useState(warehouse?.name ?? '')
  const [description, setDescription] = useState(warehouse?.description ?? '')
  const [address, setAddress] = useState(warehouse?.address ?? '')
  const [status, setStatus] = useState(warehouse?.status ?? 'active')
  const [branchId, setBranchId] = useState(warehouse?.branchId ?? '')
  const [nameError, setNameError] = useState(false)
  const [branchError, setBranchError] = useState(false)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextNameError = !name.trim()
    const nextBranchError = !branchId || branches.length === 0
    setNameError(nextNameError)
    setBranchError(nextBranchError)

    if (nextNameError || nextBranchError) {
      return
    }

    onSubmit({
      name: name.trim(),
      description: description.trim() || undefined,
      address: address.trim() || undefined,
      status,
      branchId,
    })
  }

  return (
    <form className="warehouse-form settings-section" onSubmit={handleSubmit}>
      <h2>{mode === 'create' ? t('newWarehouse') : t('editWarehouse')}</h2>

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
          <span className="warehouse-field__error">{t('nameRequired')}</span>
        ) : null}
      </label>

      <label className="warehouse-field">
        <span className="settings-field__label">{t('navBranches')}</span>
        {branches.length === 0 ? (
          <p className="warehouse-field__error">{t('createBranchFirst')}</p>
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
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        )}
        {branchError && branches.length > 0 ? (
          <span className="warehouse-field__error">{t('branchRequired')}</span>
        ) : null}
      </label>

      <label className="warehouse-field">
        <span className="settings-field__label">{t('description')}</span>
        <textarea
          className="warehouse-input warehouse-input--area"
          name="description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
        />
      </label>

      <label className="warehouse-field">
        <span className="settings-field__label">{t('address')}</span>
        <input
          className="warehouse-input"
          type="text"
          name="address"
          value={address}
          onChange={(event) => setAddress(event.target.value)}
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
        <Button type="button" onClick={onCancel}>
          {t('cancel')}
        </Button>
        <Button variant="primary" type="submit" disabled={branches.length === 0}>
          {mode === 'create' ? t('create') : t('save')}
        </Button>
      </div>
    </form>
  )
}
