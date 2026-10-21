import type { TranslationKey } from '../../../core/localization/translations'
import type { SaleRecord } from '../../../app/context/sales-context'
import { useAccess } from '../../../app/context/access-context'
import { usePayments } from '../../../app/context/payment-context'
import { useLocalization } from '../../../app/context/localization-context'
import type { SalePaymentStatus } from '../../../core/types'
import { Badge, Button } from '../../../shared/ui'

type SaleBoardCardProps = {
  record: SaleRecord
  warehouseName: string
  customerName: string
  onConfirm: (id: string) => void
  onComplete: (id: string) => void
  onCancel: (id: string) => void
  actionError: string | null
}

const PAYMENT_STATUS_LABEL: Record<SalePaymentStatus, TranslationKey> = {
  unpaid: 'paymentUnpaid',
  partially_paid: 'paymentPartial',
  paid: 'paymentPaid',
}

function formatDate(isoDate: string, locale: string): string {
  const date = new Date(isoDate)
  if (Number.isNaN(date.getTime())) {
    return isoDate
  }
  return date.toLocaleDateString(locale === 'kk' ? 'kk-KZ' : 'ru-RU')
}

function shortId(id: string): string {
  return `#${id.slice(-4).toUpperCase()}`
}

export function SaleBoardCard({
  record,
  warehouseName,
  customerName,
  onConfirm,
  onComplete,
  onCancel,
  actionError,
}: SaleBoardCardProps) {
  const { locale, t } = useLocalization()
  const { hasFinancialAccess } = useAccess()
  const { getSalePaidAmount, getSalePaymentStatus } = usePayments()
  const { sale, items, financialView } = record
  const canReadAmount = financialView?.canReadAmount === true
  const paymentStatus = getSalePaymentStatus(sale.id)
  const paidAmount = getSalePaidAmount(sale.id)

  return (
    <article className="kanban-card">
      <div className="kanban-card__top">
        <strong>{shortId(sale.id)}</strong>
        <span className="kanban-card__date">{formatDate(sale.createdAt, locale)}</span>
      </div>
      <p className="kanban-card__name">{customerName}</p>
      <p className="kanban-card__meta">{warehouseName}</p>
      {canReadAmount ? (
        <p className="kanban-card__amount">
          {sale.total.toLocaleString(locale === 'kk' ? 'kk-KZ' : 'ru-RU')}{' '}
          {sale.currency}
        </p>
      ) : null}
      <div className="kanban-card__meta-row">
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
        <span>
          {t('saleItemsCount')}: {items.length}
        </span>
      </div>
      {canReadAmount && paidAmount > 0 ? (
        <p className="kanban-card__meta">
          {t('paidAmount')}: {paidAmount} {sale.currency}
        </p>
      ) : null}
      <div className="warehouse-card__actions">
        {sale.status === 'draft' && hasFinancialAccess('sales.confirm') ? (
          <Button variant="primary" onClick={() => onConfirm(sale.id)}>
            {t('saleConfirm')}
          </Button>
        ) : null}
        {sale.status === 'confirmed' && hasFinancialAccess('sales.complete') ? (
          <Button variant="primary" onClick={() => onComplete(sale.id)}>
            {t('saleComplete')}
          </Button>
        ) : null}
        {(sale.status === 'draft' || sale.status === 'confirmed') &&
        hasFinancialAccess('sales.update') ? (
          <Button variant="danger" onClick={() => onCancel(sale.id)}>
            {t('saleCancel')}
          </Button>
        ) : null}
      </div>
      {actionError ? <p className="field__error">{actionError}</p> : null}
    </article>
  )
}
