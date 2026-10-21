import { useLocalization } from '../../../app/context/localization-context'
import type { TranslationKey } from '../../../core/localization/translations'
import type { Product, Warehouse } from '../../../core/types'
import type { AnalyticsPeriod } from './inventory-analytics'

type InventoryAnalyticsFiltersProps = {
  period: AnalyticsPeriod
  warehouseId: string
  productId: string
  warehouses: Warehouse[]
  products: Product[]
  onPeriodChange: (period: AnalyticsPeriod) => void
  onWarehouseChange: (warehouseId: string) => void
  onProductChange: (productId: string) => void
}

const PERIODS: AnalyticsPeriod[] = ['today', '7d', '30d', 'all']

const PERIOD_LABEL: Record<AnalyticsPeriod, TranslationKey> = {
  today: 'analyticsPeriodToday',
  '7d': 'analyticsPeriod7d',
  '30d': 'analyticsPeriod30d',
  all: 'analyticsPeriodAll',
}

export function InventoryAnalyticsFilters({
  period,
  warehouseId,
  productId,
  warehouses,
  products,
  onPeriodChange,
  onWarehouseChange,
  onProductChange,
}: InventoryAnalyticsFiltersProps) {
  const { t } = useLocalization()

  return (
    <div className="analytics-filters settings-section">
      <label className="warehouse-field">
        <span className="settings-field__label">{t('analyticsPeriod')}</span>
        <select
          className="warehouse-input"
          name="period"
          value={period}
          onChange={(event) => {
            const nextPeriod = PERIODS.find((value) => value === event.target.value)
            if (nextPeriod) {
              onPeriodChange(nextPeriod)
            }
          }}
        >
          {PERIODS.map((value) => (
            <option key={value} value={value}>
              {t(PERIOD_LABEL[value])}
            </option>
          ))}
        </select>
      </label>

      <label className="warehouse-field">
        <span className="settings-field__label">{t('inventoryWarehouse')}</span>
        <select
          className="warehouse-input"
          name="warehouseId"
          value={warehouseId}
          onChange={(event) => onWarehouseChange(event.target.value)}
        >
          <option value="">{t('analyticsAllWarehouses')}</option>
          {warehouses.map((warehouse) => (
            <option key={warehouse.id} value={warehouse.id}>
              {warehouse.name}
            </option>
          ))}
        </select>
      </label>

      <label className="warehouse-field">
        <span className="settings-field__label">{t('inventoryProduct')}</span>
        <select
          className="warehouse-input"
          name="productId"
          value={productId}
          onChange={(event) => onProductChange(event.target.value)}
        >
          <option value="">{t('analyticsAllProducts')}</option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
