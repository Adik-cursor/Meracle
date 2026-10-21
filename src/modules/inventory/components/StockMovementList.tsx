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
      <table className="inventory-table">
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
              <td>{formatMovementDate(item.createdAt, locale)}</td>
              <td>{warehouseNameById[item.warehouseId] ?? item.warehouseId}</td>
              <td>{productNameById[item.productId] ?? item.productId}</td>
              <td>
                {item.type === 'transfer'
                  ? item.type
                  : t(TYPE_LABEL_KEY[item.type])}
              </td>
              <td className="is-num">{item.quantity}</td>
              <td>
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
