import type { SaleReturnDetail } from '../../../core/services'
import type { PaymentMethod } from '../../../core/types'
import type { TranslationKey } from '../../../core/localization/translations'
import { useLocalization } from '../../../app/context/localization-context'
import { formatMoney } from '../pos-format'
import { Badge, Modal } from '../../../shared/ui'

const METHOD_LABEL: Record<PaymentMethod, TranslationKey> = {
  cash: 'paymentCash',
  card: 'paymentCard',
  bank_transfer: 'paymentBankTransfer',
  invoice: 'paymentInvoice',
  on_credit: 'paymentOnCredit',
  other: 'paymentOther',
}

const STATUS_LABEL: Record<string, TranslationKey> = {
  draft: 'returnStatusDraft',
  completed: 'returnCompleted',
  cancelled: 'returnStatusCancelled',
}

type SaleReturnDetailModalProps = {
  detail: SaleReturnDetail
  onClose: () => void
}

export function SaleReturnDetailModal({
  detail,
  onClose,
}: SaleReturnDetailModalProps) {
  const { t, locale } = useLocalization()
  const currency = detail.sale.currency
  const money = (value: number) => formatMoney(value, locale, currency)
  const when = (iso: string) =>
    new Date(iso).toLocaleString(locale === 'kk' ? 'kk-KZ' : 'ru-RU')
  const status = detail.saleReturn.status
  const reason = detail.saleReturn.reason?.trim()

  return (
    <Modal title={`${t('navSaleReturns')} №${detail.saleReturn.id.slice(-6)}`} onClose={onClose}>
      <div className="return-detail">
        <p className="return-detail__meta">
          {when(detail.saleReturn.createdAt)}
          {' · '}
          <Badge tone={status === 'completed' ? 'success' : status === 'cancelled' ? 'neutral' : 'info'}>
            {t(STATUS_LABEL[status] ?? 'status')}
          </Badge>
        </p>

        <section>
          <h3>{t('returnBasis')}</h3>
          <p>
            {t('returnReason')}: {reason ? reason : t('returnReasonMissing')}
          </p>
          {detail.saleReturn.note ? (
            <p>
              {t('returnComment')}: {detail.saleReturn.note}
            </p>
          ) : null}
        </section>

        <section>
          <h3>{t('referenceReceipt')}</h3>
          <p>
            {t('returnSale')}: {detail.sale.id.slice(-8)}
          </p>
          <p>
            {t('createdAt')}: {when(detail.sale.createdAt)}
          </p>
          <p>
            {t('customer')}: {detail.customerName ?? '—'}
          </p>
          <p>
            {t('responsible')}: {detail.cashierName ?? '—'}
          </p>
          <p>
            {t('inventoryWarehouse')}: {detail.warehouseName ?? '—'}
          </p>
        </section>

        <section>
          <h3>{t('returnedItems')}</h3>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('returnProduct')}</th>
                  <th>{t('sku')}</th>
                  <th className="is-num">{t('returnQuantity')}</th>
                  <th className="is-num">{t('price')}</th>
                  <th className="is-num">{t('returnTotal')}</th>
                </tr>
              </thead>
              <tbody>
                {detail.items.map((item) => (
                  <tr key={`${item.productId}-${item.quantity}-${item.total}`}>
                    <td>{item.productName}</td>
                    <td>{item.sku || '—'}</td>
                    <td className="is-num">{item.quantity}</td>
                    <td className="is-num">{money(item.unitPrice)}</td>
                    <td className="is-num">{money(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h3>{t('returnFinance')}</h3>
          <p>
            {t('returnTotal')}: {money(detail.saleReturn.total)}
          </p>
          <p>
            {t('refundedAmount')}: {money(detail.refundedAmount)}
          </p>
          {detail.refunds.length === 0 ? (
            <p>{t('refundNotLinked')}</p>
          ) : (
            detail.refunds.map((refund) => (
              <p key={refund.id}>
                {money(refund.amount)}
                {' · '}
                {refund.method ? t(METHOD_LABEL[refund.method as PaymentMethod]) : '—'}
                {' · '}
                {refund.status === 'completed' ? t('returnCompleted') : t('cancelPayment')}
                {' · '}
                {when(refund.createdAt)}
              </p>
            ))
          )}
        </section>

        <section>
          <h3>{t('linkedDocuments')}</h3>
          <p>
            {t('internalReceipt')}: {detail.returnReceiptNumber ?? t('receiptMissing')}
          </p>
          <p>
            {t('returnSale')}: {detail.saleReceiptNumber ?? t('receiptMissing')}
          </p>
        </section>
      </div>
    </Modal>
  )
}
