import { useState, type FormEvent } from 'react'
import { useLocalization } from '../../../app/context/localization-context'
import { useOrganization } from '../../../app/context/organization-context'
import { usesCareCrmComposition } from '../../../app/routes/app.routes'
import type { DealDraft } from '../../../app/context/deal-context'
import type { Company, Contact, Deal, DealStatus, User } from '../../../core/types'
import type { TranslationKey } from '../../../core/localization/translations'
import { contactDisplayName } from '../customers/customer-name'
import { userDisplayName } from '../users/user-name'
import { KINDERGARTEN_INQUIRY_TITLE_KEYS, isInquiryTitleKey } from './inquiry-types'

const DEAL_FORM_STATUSES: DealStatus[] = [
  'new',
  'in_progress',
  'won',
  'lost',
]

const DEAL_STATUS_LABEL: Record<DealStatus, TranslationKey> = {
  new: 'dealStatusNew',
  in_progress: 'dealStatusInProgress',
  won: 'dealStatusWon',
  lost: 'dealStatusLost',
}

type DealFormProps = {
  deal?: Deal
  contacts: Contact[]
  companies: Company[]
  users: User[]
  onSubmit: (draft: DealDraft, extras?: { comment?: string }) => boolean
  onCancel: () => void
}

export function DealForm({
  deal,
  contacts,
  companies,
  users,
  onSubmit,
  onCancel,
}: DealFormProps) {
  const { t } = useLocalization()
  const { modules } = useOrganization()
  const inquiryMode = usesCareCrmComposition(modules)
  const [title, setTitle] = useState(
    deal?.title ?? (inquiryMode ? 'inquiryEnrollment' : ''),
  )
  const [comment, setComment] = useState('')
  const [amount, setAmount] = useState(
    deal?.amount === null || deal?.amount === undefined ? '' : String(deal.amount),
  )
  const [companyId, setCompanyId] = useState(deal?.companyId ?? '')
  const [contactId, setContactId] = useState(deal?.contactId ?? '')
  const [assignedUserId, setAssignedUserId] = useState(deal?.assignedUserId ?? '')
  const [status, setStatus] = useState<DealStatus>(deal?.status ?? 'new')
  const [titleError, setTitleError] = useState(false)
  const [amountError, setAmountError] = useState(false)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextTitleError = !title.trim()
    const trimmedAmount = amount.trim()
    const parsedAmount = trimmedAmount === '' ? null : Number(trimmedAmount)
    const nextAmountError =
      !inquiryMode &&
      parsedAmount !== null &&
      (!Number.isFinite(parsedAmount) || parsedAmount < 0)

    setTitleError(nextTitleError)
    setAmountError(nextAmountError)

    if (nextTitleError || nextAmountError) {
      return
    }

    const saved = onSubmit(
      {
        title: title.trim(),
        amount: inquiryMode ? null : parsedAmount,
        companyId: inquiryMode ? null : companyId || null,
        contactId: contactId || null,
        assignedUserId: assignedUserId || undefined,
        status,
      },
      inquiryMode && comment.trim() ? { comment: comment.trim() } : undefined,
    )

    if (saved) {
      onCancel()
    }
  }

  return (
    <form className="warehouse-form settings-section" onSubmit={handleSubmit}>
      <h2>{deal ? (inquiryMode ? t('editInquiry') : t('editDeal')) : inquiryMode ? t('newInquiry') : t('newDeal')}</h2>

      {inquiryMode ? (
        <label className="warehouse-field">
          <span className="settings-field__label">{t('inquiryType')}</span>
          <select
            className="warehouse-input"
            name="title"
            value={title}
            onChange={(event) => {
              setTitle(event.target.value)
              if (titleError) {
                setTitleError(false)
              }
            }}
            aria-invalid={titleError ? true : undefined}
          >
            {title && !isInquiryTitleKey(title) ? (
              <option value={title}>{title}</option>
            ) : null}
            {KINDERGARTEN_INQUIRY_TITLE_KEYS.map((key) => (
              <option key={key} value={key}>
                {t(key)}
              </option>
            ))}
          </select>
          {titleError ? (
            <span className="warehouse-field__error">{t('titleRequired')}</span>
          ) : null}
        </label>
      ) : (
        <label className="warehouse-field">
          <span className="settings-field__label">{t('dealTitle')}</span>
          <input
            className="warehouse-input"
            type="text"
            name="title"
            value={title}
            onChange={(event) => {
              setTitle(event.target.value)
              if (titleError) {
                setTitleError(false)
              }
            }}
            aria-invalid={titleError ? true : undefined}
          />
          {titleError ? (
            <span className="warehouse-field__error">{t('titleRequired')}</span>
          ) : null}
        </label>
      )}

      {inquiryMode ? null : (
      <label className="warehouse-field">
        <span className="settings-field__label">{t('dealCompany')}</span>
        <select
          className="warehouse-input"
          name="companyId"
          value={companyId}
          onChange={(event) => setCompanyId(event.target.value)}
        >
          <option value="">{t('dealPartyNone')}</option>
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.name}
            </option>
          ))}
        </select>
      </label>
      )}

      <label className="warehouse-field">
        <span className="settings-field__label">
          {inquiryMode ? t('inquiryParent') : t('dealContact')}
        </span>
        <select
          className="warehouse-input"
          name="contactId"
          value={contactId}
          onChange={(event) => setContactId(event.target.value)}
        >
          <option value="">{t('dealPartyNone')}</option>
          {contacts.map((contact) => (
            <option key={contact.id} value={contact.id}>
              {contactDisplayName(contact)}
            </option>
          ))}
        </select>
      </label>

      <label className="warehouse-field">
        <span className="settings-field__label">{t('dealAssignee')}</span>
        {users.length === 0 ? (
          <p className="workspace-muted">{t('noUsers')}</p>
        ) : (
          <select
            className="warehouse-input"
            name="assignedUserId"
            value={assignedUserId}
            onChange={(event) => setAssignedUserId(event.target.value)}
          >
            <option value="">{t('dealUnassigned')}</option>
            {users
              .filter(
                (user) =>
                  user.status === 'active' || user.id === assignedUserId,
              )
              .map((user) => (
                <option key={user.id} value={user.id}>
                  {userDisplayName(user)}
                </option>
              ))}
          </select>
        )}
      </label>

      {inquiryMode ? (
        <label className="warehouse-field">
          <span className="settings-field__label">{t('inquiryComment')}</span>
          <textarea
            className="warehouse-input"
            name="comment"
            rows={3}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
          />
        </label>
      ) : (
      <label className="warehouse-field">
        <span className="settings-field__label">{t('dealAmount')}</span>
        <input
          className="warehouse-input"
          type="number"
          name="amount"
          min="0"
          step="any"
          value={amount}
          onChange={(event) => {
            setAmount(event.target.value)
            if (amountError) {
              setAmountError(false)
            }
          }}
          aria-invalid={amountError ? true : undefined}
        />
        {amountError ? (
          <span className="warehouse-field__error">{t('amountInvalid')}</span>
        ) : null}
      </label>
      )}

      <label className="warehouse-field">
        <span className="settings-field__label">{t('status')}</span>
        <select
          className="warehouse-input"
          name="status"
          value={status}
          onChange={(event) => setStatus(event.target.value as DealStatus)}
        >
          {DEAL_FORM_STATUSES.map((item) => (
            <option key={item} value={item}>
              {t(DEAL_STATUS_LABEL[item])}
            </option>
          ))}
        </select>
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
