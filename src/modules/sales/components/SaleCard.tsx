import { useState } from 'react'
import type { TranslationKey } from '../../../core/localization/translations'
import type { SaleRecord } from '../../../app/context/sales-context'
import { useAccess } from '../../../app/context/access-context'
import { usePayments } from '../../../app/context/payment-context'
import { useLocalization } from '../../../app/context/localization-context'
import type { PaymentMethod, SalePaymentStatus, SaleStatus } from '../../../core/types'
import { PaymentForm } from './PaymentForm'
import { Badge } from '../../../shared/ui'

type SaleCardProps = {
  record: SaleRecord
  warehouseName: string
  customerName: string | null
  productNameById: Record<string, string>
  onConfirm: (id: string) => void
  onComplete: (id: string) => void
  onCancel: (id: string) => void
  actionError: string | null
}

const STATUS_LABEL_KEY: Record<SaleStatus, TranslationKey> = {
  draft: 'saleStatusDraft',
  confirmed: 'saleStatusConfirmed',
  completed: 'saleStatusCompleted',
  cancelled: 'saleStatusCancelled',
}

const PAYMENT_STATUS_LABEL: Record<SalePaymentStatus, TranslationKey> = {
  unpaid: 'paymentUnpaid',
  partially_paid: 'paymentPartial',
  paid: 'paymentPaid',
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

export function SaleCard({
  record,
  warehouseName,
  customerName,
  productNameById,
  onConfirm,
  onComplete,
  onCancel,
  actionError,
}: SaleCardProps) {
  const { locale, t } = useLocalization()
  const { hasFinancialAccess } = useAccess()
  const {
    createPayment,
    cancelPayment,
    getSalePayments,
    getSalePaidAmount,
    getSaleDueAmount,
    getSalePaymentStatus,
  } = usePayments()
  const [formOpen, setFormOpen] = useState(false)
  const { sale, items, financialView } = record
  const canReadAmount = financialView?.canReadAmount === true
  const productNames = items
    .map((item) => productNameById[item.productId] ?? item.productId)
    .join(', ')
  const paidAmount = getSalePaidAmount(sale.id)
  const dueAmount = getSaleDueAmount(sale.id)
  const paymentStatus = getSalePaymentStatus(sale.id)
  const salePayments = getSalePayments(sale.id)
  const canAddPayment =
    hasFinancialAccess('payments.create') &&
    sale.status !== 'cancelled' &&
    sale.total > 0 &&
    dueAmount > 0

  return (
    <>
      <tr>
        <td>{formatDate(sale.createdAt, locale)}</td>
        <td>{warehouseName}</td>
        <td>{customerName ?? t('customerNotSelected')}</td>
              <td>
                <Badge
                  tone={
                    sale.status === 'completed'
                      ? 'success'
                      : sale.status === 'cancelled'
                        ? 'danger'
                        : sale.status === 'confirmed'
                          ? 'info'
                          : 'neutral'
                  }
                >
                  {t(STATUS_LABEL_KEY[sale.status])}
                </Badge>
              </td>
              <td className="is-num">
                {canReadAmount ? `${sale.total} ${sale.currency}` : ''}
              </td>
              <td className="is-num">
                {canReadAmount ? `${paidAmount} ${sale.currency}` : ''}
              </td>
              <td className="is-num">
                {canReadAmount ? `${dueAmount} ${sale.currency}` : ''}
              </td>
              <td>
                <Badge
                  tone={
                    paymentStatus === 'paid'
                      ? 'success'
                      : paymentStatus === 'unpaid'
                        ? 'danger'
                        : 'warning'
                  }
                >
                  {t(PAYMENT_STATUS_LABEL[paymentStatus])}
                </Badge>
                {sale.settlementMethod === 'on_credit' ? (
                  <div>
                    {t('paymentMethod')}: {t(METHOD_LABEL.on_credit)}
                  </div>
                ) : null}
              </td>
        <td>{productNames}</td>
        <td>
          <div className="warehouse-card__actions">
            {sale.status === 'draft' && hasFinancialAccess('sales.confirm') ? (
              <button
                type="button"
                className="module-switch module-switch--on"
                onClick={() => onConfirm(sale.id)}
              >
                {t('saleConfirm')}
              </button>
            ) : null}
            {sale.status === 'confirmed' && hasFinancialAccess('sales.complete') ? (
              <button
                type="button"
                className="module-switch module-switch--on"
                onClick={() => onComplete(sale.id)}
              >
                {t('saleComplete')}
              </button>
            ) : null}
            {(sale.status === 'draft' || sale.status === 'confirmed') &&
            hasFinancialAccess('sales.update') ? (
              <button
                type="button"
                className="module-switch"
                onClick={() => onCancel(sale.id)}
              >
                {t('saleCancel')}
              </button>
            ) : null}
            {canAddPayment ? (
              <button
                type="button"
                className="module-switch module-switch--on"
                onClick={() => setFormOpen(true)}
              >
                {t('addPayment')}
              </button>
            ) : null}
          </div>
          {actionError ? (
            <p className="warehouse-field__error">{actionError}</p>
          ) : null}
        </td>
      </tr>
      {salePayments.length > 0 || formOpen ? (
        <tr>
          <td colSpan={10}>
            {salePayments.length > 0 ? (
              <table className="inventory-table">
                <thead>
                  <tr>
                    <th>{t('payment')}</th>
                    <th>{t('paymentAmount')}</th>
                    <th>{t('paymentMethod')}</th>
                    <th>{t('status')}</th>
                    <th>{t('paymentNote')}</th>
                    <th>{t('transferActions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {salePayments.map((payment) => (
                    <tr key={payment.id}>
                      <td>{formatDate(payment.createdAt, locale)}</td>
                      <td>
                        {payment.amount} {payment.currency}
                      </td>
                      <td>{t(METHOD_LABEL[payment.method])}</td>
                      <td>
                        {payment.status === 'completed'
                          ? t('paidAmount')
                          : t('paymentCancelled')}
                      </td>
                      <td>{payment.note ?? ''}</td>
                      <td>
                        {payment.status === 'completed' &&
                        hasFinancialAccess('payments.cancel') ? (
                          <button
                            type="button"
                            className="module-switch"
                            onClick={() => cancelPayment(payment.id)}
                          >
                            {t('cancelPayment')}
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
            {formOpen && canAddPayment ? (
              <PaymentForm
                dueAmount={dueAmount}
                currency={sale.currency}
                onSubmit={(draft) => {
                  const created = createPayment({
                    ...draft,
                    saleId: sale.id,
                  })

                  if (created) {
                    setFormOpen(false)
                  }

                  return created
                }}
                onCancel={() => setFormOpen(false)}
              />
            ) : null}
          </td>
        </tr>
      ) : null}
    </>
  )
}
