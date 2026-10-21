import { useLocalization } from '../../../app/context/localization-context'
import type { Locale, PaymentMethod, SaleInvoice } from '../../../core/types'
import { Badge, Button } from '../../../shared/ui'
import { formatMoney } from '../pos-format'

type PosSuccessProps = {
  saleId: string
  total: number
  change: number
  method: PaymentMethod
  locale: Locale
  currency: string
  receiptNumber: string
  customerName?: string
  paidAmount?: number
  remainingAmount?: number
  invoice: SaleInvoice | null
  onOpenInvoice: () => void
  onOpenReceipt: () => void
  onPrintReceipt: () => void
  onOpenSale: () => void
  onOpenDebt?: () => void
  onNewSale: () => void
}

function methodKey(method: PaymentMethod) {
  if (method === 'cash') {
    return 'paymentCash' as const
  }
  if (method === 'card') {
    return 'paymentCard' as const
  }
  if (method === 'bank_transfer') {
    return 'paymentBankTransfer' as const
  }
  if (method === 'invoice') {
    return 'paymentInvoice' as const
  }
  if (method === 'on_credit') {
    return 'paymentOnCredit' as const
  }
  return 'paymentOther' as const
}

function invoiceStatusKey(status: SaleInvoice['status']) {
  if (status === 'issued') return 'invoiceStatusIssued' as const
  if (status === 'paid') return 'invoiceStatusPaid' as const
  if (status === 'cancelled') return 'invoiceStatusCancelled' as const
  return 'transferStatusDraft' as const
}

export function PosSuccess({
  saleId,
  total,
  change,
  method,
  locale,
  currency,
  receiptNumber,
  customerName,
  paidAmount,
  remainingAmount,
  invoice,
  onOpenInvoice,
  onOpenReceipt,
  onPrintReceipt,
  onOpenSale,
  onOpenDebt,
  onNewSale,
}: PosSuccessProps) {
  const { t } = useLocalization()
  const onCredit = method === 'on_credit'
  const received = onCredit ? (paidAmount ?? 0) : total
  const debt = onCredit ? (remainingAmount ?? total) : 0

  return (
    <div className="pos-success">
      <header className="pos-success__head">
        <span className="pos-success__check" aria-hidden="true">✓</span>
        <div>
          <h2 className="pos-success__title">
            {onCredit ? t('saleOnCreditCreated') : t('posSaleCompleted')}
          </h2>
          <p className="pos-success__number">
            {t('posSaleNumber')} {saleId.slice(-4).toUpperCase()}
            {!onCredit ? ` · ${t('receiptNumberLabel')} ${receiptNumber}` : ''}
          </p>
        </div>
        <strong className="pos-success__total">{formatMoney(total, locale, currency)}</strong>
      </header>
      <dl className="pos-success__details">
        <div>
          <dt>{t('paymentMethod')}</dt>
          <dd>{t(methodKey(method))}</dd>
        </div>
        <div>
          <dt>{t('posReceived')}</dt>
          <dd>{formatMoney(received, locale, currency)}</dd>
        </div>
        {onCredit ? (
          <div className="pos-success__detail--accent">
            <dt>{t('debtAmount')}</dt>
            <dd>{formatMoney(debt, locale, currency)}</dd>
          </div>
        ) : (
          <div>
            <dt>{t('posChange')}</dt>
            <dd>{formatMoney(change, locale, currency)}</dd>
          </div>
        )}
        {customerName ? (
          <div className="pos-success__detail--wide">
            <dt>{t('navCustomers')}</dt>
            <dd>{customerName}</dd>
          </div>
        ) : null}
        {invoice ? (
          <div className="pos-success__detail--wide">
            <dt>{t('documents')}</dt>
            <dd>
              {t('invoice')} №{invoice.invoiceNumber}
              <Badge tone={invoice.status === 'paid' ? 'success' : invoice.status === 'cancelled' ? 'danger' : 'info'}>
                {t(invoiceStatusKey(invoice.status))}
              </Badge>
            </dd>
          </div>
        ) : null}
      </dl>
      <div className="pos-success__actions">
        {invoice ? (
          <Button onClick={onOpenInvoice}>{t('openInvoice')}</Button>
        ) : null}
        {onCredit ? (
          <>
            <Button variant="primary" onClick={onOpenSale}>
              {t('openSale')}
            </Button>
            {onOpenDebt ? (
              <Button onClick={onOpenDebt}>{t('openDebt')}</Button>
            ) : null}
          </>
        ) : (
          <>
            <Button variant="primary" onClick={onOpenReceipt}>
              {t('openReceipt')}
            </Button>
            <Button onClick={onPrintReceipt}>{t('printReceipt')}</Button>
          </>
        )}
        <Button className="pos-pay" onClick={onNewSale}>
          {t('posNewSale')}
        </Button>
      </div>
    </div>
  )
}
