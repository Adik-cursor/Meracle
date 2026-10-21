import type { InventoryItem } from '../../../core/types'
import { useLocalization } from '../../../app/context/localization-context'
import { InventoryRow } from './InventoryRow'

type InventoryListProps = {
  items: InventoryItem[]
  warehouseNameById: Record<string, string>
  productNameById: Record<string, string>
  canReceive: boolean
  onReceive: (item: InventoryItem) => void
}

export function InventoryList({
  items,
  warehouseNameById,
  productNameById,
  canReceive,
  onReceive,
}: InventoryListProps) {
  const { t } = useLocalization()

  return (
    <div className="inventory-table-wrap settings-section">
      <table className="inventory-table">
        <thead>
          <tr>
            <th>{t('inventoryProduct')}</th>
            <th>{t('inventoryWarehouse')}</th>
            <th>{t('inventoryQuantity')}</th>
            <th>{t('costPrice')}</th>
            <th>{t('inventoryStockValue')}</th>
            <th>{t('transferActions')}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <InventoryRow
              key={item.id}
              warehouseName={
                warehouseNameById[item.warehouseId] ?? item.warehouseId
              }
              productName={productNameById[item.productId] ?? item.productId}
              quantity={item.quantity}
              unitCost={item.unitCost}
              canReceive={canReceive}
              onReceive={() => onReceive(item)}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}
