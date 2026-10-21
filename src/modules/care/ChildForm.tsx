import { useState, type FormEvent } from 'react'
import { useContacts } from '../../app/context/contact-context'
import { useCustomers } from '../../app/context/customer-context'
import { useLocalization } from '../../app/context/localization-context'
import { todayExpenseDateInput, type ChildWrite } from '../../core/services'
import type { CareGroup, Child, ChildStatus } from '../../core/types'
import { getCustomerDisplayName } from '../crm/customers/customer-name'
import { Button, Input, Modal, Select } from '../../shared/ui'
import type { TranslationKey } from '../../core/localization/translations'
import type { ServiceResult } from '../../core/types/domain-error'

export function ChildForm({
  initial,
  groups,
  defaultGroupId,
  onClose,
  onSave,
}: {
  initial?: Child
  groups: CareGroup[]
  defaultGroupId?: string
  onClose: () => void
  onSave: (draft: ChildWrite) => ServiceResult<Child>
}) {
  const { t } = useLocalization()
  const { contacts } = useContacts()
  const { customers } = useCustomers()
  const [firstName, setFirstName] = useState(initial?.firstName ?? '')
  const [lastName, setLastName] = useState(initial?.lastName ?? '')
  const [birthDate, setBirthDate] = useState(initial?.birthDate ?? '')
  const [groupId, setGroupId] = useState(initial?.groupId ?? defaultGroupId ?? '')
  const [status, setStatus] = useState<ChildStatus>(initial?.status ?? 'attending')
  const [parentMode, setParentMode] = useState<'existing' | 'new'>(
    initial?.parentCustomerId || initial?.parentContactId ? 'existing' : 'existing',
  )
  const [parentCustomerId, setParentCustomerId] = useState(initial?.parentCustomerId ?? '')
  const [parentFullName, setParentFullName] = useState('')
  const [parentPhone, setParentPhone] = useState('')
  const [error, setError] = useState<TranslationKey | null>(null)

  const parentCustomers = customers.filter((customer) => customer.type === 'contact' && customer.contactId)

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const result = onSave({
      firstName,
      lastName,
      birthDate,
      groupId: groupId || undefined,
      status,
      parentCustomerId:
        parentMode === 'existing' ? parentCustomerId || initial?.parentCustomerId : undefined,
      parentContactId:
        parentMode === 'existing' && !parentCustomerId ? initial?.parentContactId : undefined,
      parentFullName: parentMode === 'new' ? parentFullName : undefined,
      parentPhone: parentMode === 'new' ? parentPhone : undefined,
      notes: initial?.notes,
    })
    if (!result.ok) {
      setError(result.error.code as TranslationKey)
      return
    }
    onClose()
  }

  return (
    <Modal title={initial ? t('careEditChild') : t('careAddChild')} onClose={onClose}>
      <form className="care-form" onSubmit={handleSubmit}>
        <label>
          <span>{t('careLastName')}</span>
          <Input value={lastName} onChange={(event) => setLastName(event.target.value)} required />
        </label>
        <label>
          <span>{t('careFirstName')}</span>
          <Input value={firstName} onChange={(event) => setFirstName(event.target.value)} required />
        </label>
        <label>
          <span>{t('careBirthDate')}</span>
          <Input
            type="date"
            value={birthDate}
            max={todayExpenseDateInput()}
            onChange={(event) => setBirthDate(event.target.value)}
            required
          />
        </label>
        <label>
          <span>{t('careGroup')}</span>
          <Select value={groupId} onChange={(event) => setGroupId(event.target.value)}>
            <option value="">{t('careNoGroup')}</option>
            {groups
              .filter((group) => group.status === 'active')
              .map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
          </Select>
        </label>
        <label>
          <span>{t('careParent')}</span>
          <Select
            value={parentMode}
            onChange={(event) => setParentMode(event.target.value as 'existing' | 'new')}
          >
            <option value="existing">{t('careParentExisting')}</option>
            <option value="new">{t('careParentNew')}</option>
          </Select>
        </label>
        {parentMode === 'existing' ? (
          <label>
            <span>{t('careParent')}</span>
            <Select
              value={parentCustomerId}
              onChange={(event) => setParentCustomerId(event.target.value)}
            >
              <option value="">{t('careParentUnset')}</option>
              {parentCustomers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {getCustomerDisplayName(customer, contacts, [])}
                </option>
              ))}
            </Select>
          </label>
        ) : (
          <>
            <label>
              <span>{t('careParentName')}</span>
              <Input
                value={parentFullName}
                onChange={(event) => setParentFullName(event.target.value)}
                required
              />
            </label>
            <label>
              <span>{t('careParentPhone')}</span>
              <Input
                value={parentPhone}
                onChange={(event) => setParentPhone(event.target.value)}
                required
              />
            </label>
          </>
        )}
        {parentMode === 'existing' && parentCustomerId ? (
          <label>
            <span>{t('careParentPhone')}</span>
            <Input
              value={
                contacts.find(
                  (item) =>
                    item.id ===
                    parentCustomers.find((customer) => customer.id === parentCustomerId)?.contactId,
                )?.phone ?? ''
              }
              readOnly
            />
          </label>
        ) : null}
        <label>
          <span>{t('status')}</span>
          <Select
            value={status}
            onChange={(event) => setStatus(event.target.value as ChildStatus)}
          >
            <option value="attending">{t('careStatusAttending')}</option>
            <option value="temporarily_absent">{t('careStatusTemporarilyAbsent')}</option>
            <option value="withdrawn">{t('careStatusWithdrawn')}</option>
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
