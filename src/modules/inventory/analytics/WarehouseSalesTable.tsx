import { useLocalization } from '../../../app/context/localization-context'
import type { WarehouseSalesRow } from './inventory-analytics'

type WarehouseSalesTableProps = {
  rows: WarehouseSalesRow[]
  warehouseNameById: Record<string, string>
  currency: string
}

export function WarehouseSalesTable({
  rows,
  warehouseNameById,
  currency,
}: WarehouseSalesTableProps) {
  const { t } = useLocalization()

  return (
    <section className="settings-section analytics-block">
      <h2>{t('analyticsWarehouseSales')}</h2>
      {rows.length === 0 ? (
        <p className="analytics-empty">{t('analyticsEmpty')}</p>
      ) : (
        <div className="inventory-table-wrap">
          <table className="inventory-table">
            <thead>
              <tr>
                <th>{t('inventoryWarehouse')}</th>
                <th>{t('analyticsSold')}</th>
                <th>{t('analyticsRevenue')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.warehouseId}>
                  <td>
                    {warehouseNameById[row.warehouseId] ?? row.warehouseId}
                  </td>
                  <td>{row.sold}</td>
                  <td>
                    {row.revenue} {currency}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
