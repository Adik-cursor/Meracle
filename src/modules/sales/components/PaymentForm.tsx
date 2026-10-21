import { useState, type FormEvent } from 'react'
import { useLocalization } from '../../../app/context/localization-context'
import type { PaymentDraft } from '../../../app/context/payment-context'
import type { PaymentMethod } from '../../../core/types'
import type { TranslationKey } from '../../../core/localization/translations'

type PaymentFormProps = {
  dueAmount: number
  currency: string
  onSubmit: (draft: Omit<PaymentDraft, 'saleId'>) => boolean
  onCancel: () => void
}

const METHOD_LABEL: Record<PaymentMethod, TranslationKey> = {
  cash: 'paymentCash',
  card: 'paymentCard',
  bank_transfer: 'paymentBankTransfer',
  invoice: 'paymentInvoice',
  on_credit: 'paymentOnCredit',
  other: 'paymentOther',
}

const METHODS: PaymentMethod[] = ['cash', 'card', 'bank_transfer', 'other']

export function PaymentForm({
  dueAmount,
  currency,
  onSubmit,
  onCancel,
}: PaymentFormProps) {
  const { t } = useLocalization()
  const [amountInput, setAmountInput] = useState(String(dueAmount))
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const amount = Number(amountInput)

    if (amountInput.trim() === '' || Number.isNaN(amount)) {
      setError(t('quantityMustBeNumber'))
      return
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setError(t('paymentAmountInvalid'))
      return
    }

    if (amount > dueAmount) {
      setError(t('paymentExceedsDue'))
      return
    }

    const created = onSubmit({
      amount,
      method,
      note: note.trim() || undefined,
    })

    if (!created) {
      setError(t('paymentExceedsDue'))
    }
  }

  return (
    <form className="warehouse-form" onSubmit={handleSubmit}>
      <h2>{t('addPayment')}</h2>

      <label className="warehouse-field">
        <span className="settings-field__label">{t('paymentAmount')}</span>
        <input
          className="warehouse-input"
          type="number"
          name="amount"
          min="0"
          step="any"
          value={amountInput}
          onChange={(event) => {
            setAmountInput(event.target.value)
            setError(null)
          }}
        />
      </label>

      <label className="warehouse-field">
        <span className="settings-field__label">{t('paymentMethod')}</span>
        <select
          className="warehouse-input"
          name="method"
          value={method}
          onChange={(event) =>
            setMethod(
              METHODS.find((value) => value === event.target.value) ?? 'cash',
            )
          }
        >
          {METHODS.map((value) => (
            <option key={value} value={value}>
              {t(METHOD_LABEL[value])}
            </option>
          ))}
        </select>
      </label>

      <label className="warehouse-field">
        <span className="settings-field__label">{t('paymentNote')}</span>
        <input
          className="warehouse-input"
          type="text"
          name="note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>

      {error ? <p className="warehouse-field__error">{error}</p> : null}

      <div className="warehouse-form__actions">
        <button type="submit" className="module-switch module-switch--on">
          {t('create')}
        </button>
        <button type="button" className="module-switch" onClick={onCancel}>
          {t('cancel')}
        </button>
      </div>
      <p className="settings-field__value">
        {t('paymentDue')}: {dueAmount} {currency}
      </p>
    </form>
  )
}
