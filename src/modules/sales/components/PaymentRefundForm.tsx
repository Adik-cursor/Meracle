import { useState, type FormEvent } from 'react'
import { useLocalization } from '../../../app/context/localization-context'
import type { PaymentRefundDraft } from '../../../app/context/payment-refund-context'
import type { SaleReturnRecord } from '../../../app/context/sale-return-context'
import type { TranslationKey } from '../../../core/localization/translations'
import type { Payment, PaymentMethod } from '../../../core/types'

type PaymentRefundFormProps = {
  payments: Payment[]
  returns: SaleReturnRecord[]
  selectedPaymentId: string
  getRefundableAmount: (paymentId: string) => number
  getReturnRefundableAmount: (returnId: string) => number
  onPaymentChange: (paymentId: string) => void
  onSubmit: (draft: PaymentRefundDraft) => boolean
}

const METHOD_LABEL: Record<PaymentMethod, TranslationKey> = {
  cash: 'paymentCash',
  card: 'paymentCard',
  bank_transfer: 'paymentBankTransfer',
  invoice: 'paymentInvoice',
  on_credit: 'paymentOnCredit',
  other: 'paymentOther',
}

export function PaymentRefundForm({
  payments,
  returns,
  selectedPaymentId,
  getRefundableAmount,
  getReturnRefundableAmount,
  onPaymentChange,
  onSubmit,
}: PaymentRefundFormProps) {
  const { t } = useLocalization()
  const selectedPayment = payments.find((item) => item.id === selectedPaymentId)
  const refundable = selectedPayment
    ? getRefundableAmount(selectedPayment.id)
    : 0
  const [amountInput, setAmountInput] = useState(
    refundable > 0 ? String(refundable) : '',
  )
  const [returnId, setReturnId] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  const matchingReturns = selectedPayment
    ? returns.filter(
        (item) =>
          item.return.saleId === selectedPayment.saleId &&
          item.return.status !== 'cancelled',
      )
    : []

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!selectedPayment) {
      setError(t('selectPayment'))
      return
    }

    const amount = Number(amountInput)

    if (amountInput.trim() === '' || Number.isNaN(amount)) {
      setError(t('quantityMustBeNumber'))
      return
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setError(t('paymentAmountInvalid'))
      return
    }

    let available = refundable
    if (returnId) {
      available = Math.min(available, getReturnRefundableAmount(returnId))
    }

    if (amount > available) {
      setError(t('refundInsufficient'))
      return
    }

    const created = onSubmit({
      paymentId: selectedPayment.id,
      amount,
      returnId: returnId ? returnId : undefined,
      note: note.trim() || undefined,
    })

    if (!created) {
      setError(t('refundInsufficient'))
      return
    }

    setNote('')
    setReturnId('')
    setError(null)
  }

  if (payments.length === 0) {
    return (
      <div className="warehouse-empty settings-section">
        <p>{t('noRefundablePayments')}</p>
      </div>
    )
  }

  return (
    <form className="warehouse-form settings-section" onSubmit={handleSubmit}>
      <h2>{t('createPaymentRefund')}</h2>

      <label className="warehouse-field">
        <span className="settings-field__label">{t('payment')}</span>
        <select
          className="warehouse-input"
          name="paymentId"
          value={selectedPaymentId}
          onChange={(event) => {
            onPaymentChange(event.target.value)
            setReturnId('')
            setError(null)
            const next = payments.find((item) => item.id === event.target.value)
            setAmountInput(
              next ? String(getRefundableAmount(next.id)) : '',
            )
          }}
        >
          <option value="">{t('selectPayment')}</option>
          {payments.map((payment) => (
            <option key={payment.id} value={payment.id}>
              {payment.amount} {payment.currency} · {t(METHOD_LABEL[payment.method])}
            </option>
          ))}
        </select>
      </label>

      {selectedPayment ? (
        <>
          <p className="settings-field__value">
            {t('refundableAmount')}: {refundable} {selectedPayment.currency}
          </p>
          <label className="warehouse-field">
            <span className="settings-field__label">{t('returnTotal')}</span>
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
            <span className="settings-field__label">{t('saleReturn')}</span>
            <select
              className="warehouse-input"
              name="returnId"
              value={returnId}
              onChange={(event) => {
                setReturnId(event.target.value)
                setError(null)
              }}
            >
              <option value="">{t('refundNoLinkedReturn')}</option>
              {matchingReturns.map((item) => (
                <option key={item.return.id} value={item.return.id}>
                  {item.return.total} {selectedPayment.currency}
                </option>
              ))}
            </select>
          </label>
        </>
      ) : null}

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
        <button
          type="submit"
          className="module-switch module-switch--on"
          disabled={!selectedPayment || refundable <= 0}
        >
          {t('createPaymentRefund')}
        </button>
      </div>
    </form>
  )
}
