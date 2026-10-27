import type { StockMovement } from '../../../core/types'
import type { TranslationKey } from '../../../core/localization/translations'
import { useLocalization } from '../../../app/context/localization-context'

type StockMovementListProps = {
  items: StockMovement[]
  warehouseNameById: Record<string, string>
  productNameById: Record<string, string>
}

const TYPE_LABEL_KEY: Record<
  'receipt' | 'shipment' | 'adjustment' | 'return',
  TranslationKey
> = {
  receipt: 'movementReceipt',
  shipment: 'movementShipment',
  adjustment: 'movementAdjustment',
  return: 'movementReturn',
}

function formatMovementDate(isoDate: string, locale: string): string {
  const date = new Date(isoDate)

  if (Number.isNaN(date.getTime())) {
    return isoDate
  }

  return date.toLocaleString(locale === 'kk' ? 'kk-KZ' : 'ru-RU')
}

export function StockMovementList({
  items,
  warehouseNameById,
  productNameById,
}: StockMovementListProps) {
  const { locale, t } = useLocalization()

  return (
    <div className="inventory-table-wrap settings-section">
      <table className="inventory-table data-table--mobile-cards">
        <thead>
          <tr>
            <th>{t('movementDate')}</th>
            <th>{t('inventoryWarehouse')}</th>
            <th>{t('inventoryProduct')}</th>
            <th>{t('movementType')}</th>
            <th>{t('inventoryQuantity')}</th>
            <th>{t('movementNote')}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td data-label={t('movementDate')}>{formatMovementDate(item.createdAt, locale)}</td>
              <td data-label={t('inventoryWarehouse')}>{warehouseNameById[item.warehouseId] ?? item.warehouseId}</td>
              <td data-label={t('inventoryProduct')}>{productNameById[item.productId] ?? item.productId}</td>
              <td data-label={t('movementType')}>
                {item.type === 'transfer'
                  ? item.type
                  : t(TYPE_LABEL_KEY[item.type])}
              </td>
              <td className="is-num" data-label={t('inventoryQuantity')}>{item.quantity}</td>
              <td data-label={t('movementNote')}>
                {item.note === 'initial_stock'
                  ? t('initialStockMovement')
                  : (item.note ?? '')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
