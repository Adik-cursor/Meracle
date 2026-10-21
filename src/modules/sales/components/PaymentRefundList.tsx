import { useAccess } from '../../../app/context/access-context'
import { useLocalization } from '../../../app/context/localization-context'
import type { Payment, PaymentRefund, PaymentMethod } from '../../../core/types'
import type { TranslationKey } from '../../../core/localization/translations'

type PaymentRefundListProps = {
  payments: Payment[]
  refunds: PaymentRefund[]
  getRefundedAmount: (paymentId: string) => number
  getRefundableAmount: (paymentId: string) => number
  onRefundPayment: (paymentId: string) => void
  onCancelRefund: (refundId: string) => void
}

const METHOD_LABEL: Record<PaymentMethod, TranslationKey> = {
  cash: 'paymentCash',
  card: 'paymentCard',
  bank_transfer: 'paymentBankTransfer',
  invoice: 'paymentInvoice',
  on_credit: 'paymentOnCredit',
  other: 'paymentOther',
}

function formatDate(isoDate: string, locale: string): string {
  const date = new Date(isoDate)

  if (Number.isNaN(date.getTime())) {
    return isoDate
  }

  return date.toLocaleString(locale === 'kk' ? 'kk-KZ' : 'ru-RU')
}

export function PaymentRefundList({
  payments,
  refunds,
  getRefundedAmount,
  getRefundableAmount,
  onRefundPayment,
  onCancelRefund,
}: PaymentRefundListProps) {
  const { locale, t } = useLocalization()
  const { hasFinancialAccess } = useAccess()

  return (
    <>
      <div className="inventory-table-wrap settings-section">
        <table className="inventory-table">
          <thead>
            <tr>
              <th>{t('payment')}</th>
              <th>{t('paymentMethod')}</th>
              <th>{t('paymentAmount')}</th>
              <th>{t('refundedAmount')}</th>
              <th>{t('refundableAmount')}</th>
              <th>{t('transferActions')}</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((payment) => {
              const refundable = getRefundableAmount(payment.id)

              return (
                <tr key={payment.id}>
                  <td>{formatDate(payment.createdAt, locale)}</td>
                  <td>{t(METHOD_LABEL[payment.method])}</td>
                  <td>
                    {payment.amount} {payment.currency}
                  </td>
                  <td>
                    {getRefundedAmount(payment.id)} {payment.currency}
                  </td>
                  <td>
                    {refundable} {payment.currency}
                  </td>
                  <td>
                    {refundable > 0 && hasFinancialAccess('refunds.create') ? (
                      <button
                        type="button"
                        className="module-switch module-switch--on"
                        onClick={() => onRefundPayment(payment.id)}
                      >
                        {t('createPaymentRefund')}
                      </button>
                    ) : null}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {refunds.length > 0 ? (
        <div className="inventory-table-wrap settings-section">
          <table className="inventory-table">
            <thead>
              <tr>
                <th>{t('movementDate')}</th>
                <th>{t('returnTotal')}</th>
                <th>{t('status')}</th>
                <th>{t('saleReturn')}</th>
                <th>{t('paymentNote')}</th>
                <th>{t('transferActions')}</th>
              </tr>
            </thead>
            <tbody>
              {refunds.map((refund) => (
                <tr key={refund.id}>
                  <td>{formatDate(refund.createdAt, locale)}</td>
                  <td>
                    {refund.amount} {refund.currency}
                  </td>
                  <td>
                    {refund.status === 'completed'
                      ? t('returnCompleted')
                      : t('returnStatusCancelled')}
                  </td>
                  <td>
                    {refund.returnId
                      ? t('saleReturn')
                      : t('refundNoLinkedReturn')}
                  </td>
                  <td>{refund.note ?? ''}</td>
                  <td>
                    {refund.status === 'completed' &&
                    hasFinancialAccess('refunds.cancel') ? (
                      <button
                        type="button"
                        className="module-switch"
                        onClick={() => onCancelRefund(refund.id)}
                      >
                        {t('cancel')}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  )
}
