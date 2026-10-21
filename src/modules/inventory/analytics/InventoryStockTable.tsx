import { useLocalization } from '../../../app/context/localization-context'
import type { InventoryItem } from '../../../core/types'

type InventoryStockTableProps = {
  title: string
  items: InventoryItem[]
  warehouseNameById: Record<string, string>
  productNameById: Record<string, string>
}

export function InventoryStockTable({
  title,
  items,
  warehouseNameById,
  productNameById,
}: InventoryStockTableProps) {
  const { t } = useLocalization()

  return (
    <section className="settings-section analytics-block">
      <h2>{title}</h2>
      {items.length === 0 ? (
        <p className="analytics-empty">{t('analyticsEmpty')}</p>
      ) : (
        <div className="inventory-table-wrap">
          <table className="inventory-table">
            <thead>
              <tr>
                <th>{t('inventoryProduct')}</th>
                <th>{t('inventoryWarehouse')}</th>
                <th>{t('inventoryQuantity')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{productNameById[item.productId] ?? item.productId}</td>
                  <td>
                    {warehouseNameById[item.warehouseId] ?? item.warehouseId}
                  </td>
                  <td>{item.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
