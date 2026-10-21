import { useState, type FormEvent } from 'react'
import { useLocalization } from '../../app/context/localization-context'
import type { CareGroupWrite } from '../../core/services'
import type { CareGroup } from '../../core/types'
import { Button, Input, Modal, Select } from '../../shared/ui'
import type { TranslationKey } from '../../core/localization/translations'
import type { ServiceResult } from '../../core/types/domain-error'

export function GroupForm({
  initial,
  onClose,
  onSave,
}: {
  initial?: CareGroup
  onClose: () => void
  onSave: (draft: CareGroupWrite) => ServiceResult<CareGroup>
}) {
  const { t } = useLocalization()
  const [name, setName] = useState(initial?.name ?? '')
  const [capacity, setCapacity] = useState(String(initial?.capacity ?? 20))
  const [status, setStatus] = useState(initial?.status ?? 'active')
  const [error, setError] = useState<TranslationKey | null>(null)

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const parsed = Number(capacity)
    const result = onSave({
      name,
      capacity: parsed,
      status,
    })
    if (!result.ok) {
      setError(result.error.code as TranslationKey)
      return
    }
    onClose()
  }

  return (
    <Modal title={initial ? t('careEditGroup') : t('careCreateGroup')} onClose={onClose}>
      <form className="care-form" onSubmit={handleSubmit}>
        <label>
          <span>{t('careGroupName')}</span>
          <Input value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
        <label>
          <span>{t('careCapacity')}</span>
          <Input
            type="number"
            min="1"
            value={capacity}
            onChange={(event) => setCapacity(event.target.value)}
            required
          />
        </label>
        <label>
          <span>{t('status')}</span>
          <Select
            value={status}
            onChange={(event) => setStatus(event.target.value as CareGroup['status'])}
          >
            <option value="active">{t('active')}</option>
            <option value="inactive">{t('inactive')}</option>
          </Select>
        </label>
        {error ? <p className="field__error">{t(error)}</p> : null}
        <div className="care-form__actions">
          <Button type="button" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button type="submit" variant="primary">
            {t('save')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
