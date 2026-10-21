import { useLocalization } from '../../../app/context/localization-context'

type InventoryAnalyticsSummaryProps = {
  revenue: number
  salesCount: number
  unitsSold: number
  productCount: number
  warehouseCount: number
  outOfStockCount: number
  currency: string
}

export function InventoryAnalyticsSummary({
  revenue,
  salesCount,
  unitsSold,
  productCount,
  warehouseCount,
  outOfStockCount,
  currency,
}: InventoryAnalyticsSummaryProps) {
  const { locale, t } = useLocalization()
  const numberLocale = locale === 'kk' ? 'kk-KZ' : 'ru-RU'

  const cards = [
    {
      label: t('analyticsRevenue'),
      value: `${revenue.toLocaleString(numberLocale)} ${currency}`,
    },
    {
      label: t('analyticsSalesCount'),
      value: salesCount.toLocaleString(numberLocale),
    },
    {
      label: t('analyticsUnitsSold'),
      value: unitsSold.toLocaleString(numberLocale),
    },
    {
      label: t('analyticsProductCount'),
      value: productCount.toLocaleString(numberLocale),
    },
    {
      label: t('analyticsWarehouseCount'),
      value: warehouseCount.toLocaleString(numberLocale),
    },
    {
      label: t('analyticsOutOfStock'),
      value: outOfStockCount.toLocaleString(numberLocale),
    },
  ]

  return (
    <div className="analytics-cards">
      {cards.map((card) => (
        <article key={card.label} className="analytics-card">
          <p className="analytics-card__label">{card.label}</p>
          <p className="analytics-card__value">{card.value}</p>
        </article>
      ))}
    </div>
  )
}
