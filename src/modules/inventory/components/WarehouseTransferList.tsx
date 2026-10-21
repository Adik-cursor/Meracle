import type { WarehouseTransfer } from '../../../core/types'
import type { TranslationKey } from '../../../core/localization/translations'
import { useLocalization } from '../../../app/context/localization-context'
import { Badge } from '../../../shared/ui'

type WarehouseTransferListProps = {
  items: WarehouseTransfer[]
  warehouseNameById: Record<string, string>
  productNameById: Record<string, string>
  onSubmitTransfer: (id: string) => void
  onCompleteTransfer: (id: string) => boolean
  onCancelTransfer: (id: string) => void
  completeErrorId: string | null
}

const STATUS_LABEL_KEY: Record<WarehouseTransfer['status'], TranslationKey> = {
  draft: 'transferStatusDraft',
  pending: 'transferStatusPending',
  completed: 'transferStatusCompleted',
  cancelled: 'transferStatusCancelled',
}

function formatDate(isoDate: string, locale: string): string {
  const date = new Date(isoDate)

  if (Number.isNaN(date.getTime())) {
    return isoDate
  }

  return date.toLocaleString(locale === 'kk' ? 'kk-KZ' : 'ru-RU')
}

export function WarehouseTransferList({
  items,
  warehouseNameById,
  productNameById,
  onSubmitTransfer,
  onCompleteTransfer,
  onCancelTransfer,
  completeErrorId,
}: WarehouseTransferListProps) {
  const { locale, t } = useLocalization()

  return (
    <div className="inventory-table-wrap settings-section">
      <table className="inventory-table">
        <thead>
          <tr>
            <th>{t('movementDate')}</th>
            <th>{t('transferSource')}</th>
            <th>{t('transferDestination')}</th>
            <th>{t('inventoryProduct')}</th>
            <th>{t('inventoryQuantity')}</th>
            <th>{t('status')}</th>
            <th>{t('transferActions')}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const canAdvance = item.status === 'draft' || item.status === 'pending'

            return (
              <tr key={item.id}>
                <td>{formatDate(item.createdAt, locale)}</td>
                <td>
                  {warehouseNameById[item.sourceWarehouseId] ??
                    item.sourceWarehouseId}
                </td>
                <td>
                  {warehouseNameById[item.destinationWarehouseId] ??
                    item.destinationWarehouseId}
                </td>
                <td>{productNameById[item.productId] ?? item.productId}</td>
                <td className="is-num">{item.quantity}</td>
                <td>
                  <Badge
                    tone={
                      item.status === 'completed'
                        ? 'success'
                        : item.status === 'cancelled'
                          ? 'danger'
                          : item.status === 'pending'
                            ? 'warning'
                            : 'neutral'
                    }
                  >
                    {t(STATUS_LABEL_KEY[item.status])}
                  </Badge>
                </td>
                <td>
                  {canAdvance ? (
                    <div className="warehouse-card__actions">
                      {item.status === 'draft' ? (
                        <button
                          type="button"
                          className="module-switch"
                          onClick={() => onSubmitTransfer(item.id)}
                        >
                          {t('transferSubmit')}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="module-switch module-switch--on"
                        onClick={() => onCompleteTransfer(item.id)}
                      >
                        {t('transferComplete')}
                      </button>
                      <button
                        type="button"
                        className="module-switch"
                        onClick={() => onCancelTransfer(item.id)}
                      >
                        {t('transferCancel')}
                      </button>
                    </div>
                  ) : null}
                  {completeErrorId === item.id ? (
                    <p className="warehouse-field__error">
                      {t('transferInsufficientStock')}
                    </p>
                  ) : null}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
