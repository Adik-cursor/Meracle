import type { TranslationKey } from '../../../core/localization/translations'
import type { SaleReturnRecord } from '../../../app/context/sale-return-context'
import type { SaleReturnStatus } from '../../../core/types'
import { useAccess } from '../../../app/context/access-context'
import { useInternalReceipts } from '../../../app/context/internal-receipt-context'
import { useLocalization } from '../../../app/context/localization-context'
import { Badge, Button } from '../../../shared/ui'

type SaleReturnCardProps = {
  record: SaleReturnRecord
  saleLabel: string
  warehouseName: string
  productNames: string
  quantity: number
  onComplete: (id: string) => void
  onCancel: (id: string) => void
  onDetails: (id: string) => void
  completeError: boolean
}

const STATUS_LABEL_KEY: Record<SaleReturnStatus, TranslationKey> = {
  draft: 'returnStatusDraft',
  completed: 'returnCompleted',
  cancelled: 'returnStatusCancelled',
}

function formatDate(isoDate: string, locale: string): string {
  const date = new Date(isoDate)

  if (Number.isNaN(date.getTime())) {
    return isoDate
  }

  return date.toLocaleString(locale === 'kk' ? 'kk-KZ' : 'ru-RU')
}

export function SaleReturnCard({
  record,
  saleLabel,
  warehouseName,
  productNames,
  quantity,
  onComplete,
  onCancel,
  onDetails,
  completeError,
}: SaleReturnCardProps) {
  const { locale, t } = useLocalization()
  const { hasFinancialAccess } = useAccess()
  const { getBySaleReturnId } = useInternalReceipts()
  const { return: saleReturn } = record
  const canAdvance = saleReturn.status === 'draft'
  const returnReceipt = getBySaleReturnId(saleReturn.id)

  return (
    <tr>
      <td>{formatDate(saleReturn.createdAt, locale)}</td>
      <td>
        {saleLabel}
        {returnReceipt ? (
          <div className="pos-history__note">
            {t('internalReceipt')} {returnReceipt.receiptNumber}
            {returnReceipt.referenceReceiptId ? (
              <>
                {' · '}
                {t('returnReceiptTitle')}
              </>
            ) : null}
          </div>
        ) : null}
      </td>
      <td>{warehouseName}</td>
      <td>{productNames}</td>
      <td>{quantity}</td>
      <td className="is-num">{saleReturn.total}</td>
      <td>
        <Badge tone={saleReturn.status === 'completed' ? 'success' : saleReturn.status === 'cancelled' ? 'neutral' : 'info'}>
          {t(STATUS_LABEL_KEY[saleReturn.status])}
        </Badge>
      </td>
      <td>
        <div className="warehouse-card__actions table-actions">
          <Button type="button" onClick={() => onDetails(saleReturn.id)}>
            {t('returnDetails')}
          </Button>
          {canAdvance && hasFinancialAccess('returns.complete') ? (
            <Button type="button" variant="primary" onClick={() => onComplete(saleReturn.id)}>
              {t('completeReturn')}
            </Button>
          ) : null}
          {canAdvance && !hasFinancialAccess('returns.complete') ? (
            <p className="warehouse-field__error">{t('ACCESS_DENIED')}</p>
          ) : null}
          {canAdvance && hasFinancialAccess('returns.create') ? (
            <Button type="button" onClick={() => onCancel(saleReturn.id)}>
              {t('cancelReturn')}
            </Button>
          ) : null}
        </div>
        {completeError ? (
          <p className="warehouse-field__error">{t('returnInvalidQuantity')}</p>
        ) : null}
      </td>
    </tr>
  )
}
