import { useLocalization } from '../../../app/context/localization-context'
import type { ProductSalesRow } from './inventory-analytics'

type ProductSalesTableProps = {
  rows: ProductSalesRow[]
  productNameById: Record<string, string>
  currency: string
}

export function ProductSalesTable({
  rows,
  productNameById,
  currency,
}: ProductSalesTableProps) {
  const { t } = useLocalization()

  return (
    <section className="settings-section analytics-block">
      <h2>{t('analyticsProductSales')}</h2>
      {rows.length === 0 ? (
        <p className="analytics-empty">{t('analyticsEmpty')}</p>
      ) : (
        <div className="inventory-table-wrap">
          <table className="inventory-table">
            <thead>
              <tr>
                <th>{t('inventoryProduct')}</th>
                <th>{t('analyticsSold')}</th>
                <th>{t('analyticsRevenue')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.productId}>
                  <td>{productNameById[row.productId] ?? row.productId}</td>
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
