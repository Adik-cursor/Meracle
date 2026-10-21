import { useMemo, useState } from 'react'
import { useAccess } from '../../context/access-context'
import { useInventory } from '../../context/inventory-context'
import { useLocalization } from '../../context/localization-context'
import { useOrganization } from '../../context/organization-context'
import { useProducts } from '../../context/product-context'
import { useSales } from '../../context/sales-context'
import { useStockMovements } from '../../context/stock-movement-context'
import { useWarehouses } from '../../context/warehouse-context'
import { AuthRequiredState } from '../../components/AuthRequiredState'
import { InventoryAnalyticsFilters } from '../../../modules/inventory/analytics/InventoryAnalyticsFilters'
import { InventoryAnalyticsSummary } from '../../../modules/inventory/analytics/InventoryAnalyticsSummary'
import { InventorySalesChart } from '../../../modules/inventory/analytics/InventorySalesChart'
import { InventoryStockTable } from '../../../modules/inventory/analytics/InventoryStockTable'
import { ProductSalesTable } from '../../../modules/inventory/analytics/ProductSalesTable'
import { WarehouseSalesTable } from '../../../modules/inventory/analytics/WarehouseSalesTable'
import {
  computeInventoryAnalytics,
  type AnalyticsPeriod,
} from '../../../modules/inventory/analytics/inventory-analytics'

export function InventoryAnalyticsPage() {
  const { t } = useLocalization()
  const { currentUser, hasFinancialAccess } = useAccess()
  const { modules, settings } = useOrganization()
  const { analyticsWarehouses } = useWarehouses()
  const { products } = useProducts()
  const { analyticsInventory } = useInventory()
  const { analyticsSales } = useSales()
  useStockMovements()
  const [period, setPeriod] = useState<AnalyticsPeriod>('all')
  const [warehouseId, setWarehouseId] = useState('')
  const [productId, setProductId] = useState('')

  const warehouseNameById = Object.fromEntries(
    analyticsWarehouses.map((warehouse) => [warehouse.id, warehouse.name]),
  )
  const productNameById = Object.fromEntries(
    products.map((product) => [product.id, product.name]),
  )

  const analytics = useMemo(
    () =>
      computeInventoryAnalytics({
        sales: analyticsSales,
        inventory: analyticsInventory,
        productCount: products.length,
        warehouseCount: analyticsWarehouses.length,
        includeSales:
          modules.sales === true && hasFinancialAccess('financial_analytics.read'),
        period,
        warehouseId,
        productId,
        timeZone: settings.timezone,
      }),
    [
      analyticsInventory,
      analyticsSales,
      analyticsWarehouses.length,
      modules.sales,
      period,
      productId,
      products.length,
      settings.timezone,
      warehouseId,
      hasFinancialAccess,
    ],
  )

  if (!currentUser) {
    return <AuthRequiredState />
  }

  return (
    <section className="workspace-page analytics-page">
      <div className="workspace-toolbar">
        <h2 className="workspace-toolbar__title">{t('navAnalytics')}</h2>
      </div>

      <InventoryAnalyticsFilters
        period={period}
        warehouseId={warehouseId}
        productId={productId}
        warehouses={analyticsWarehouses}
        products={products}
        onPeriodChange={setPeriod}
        onWarehouseChange={setWarehouseId}
        onProductChange={setProductId}
      />

      <InventoryAnalyticsSummary
        revenue={analytics.revenue}
        salesCount={analytics.salesCount}
        unitsSold={analytics.unitsSold}
        productCount={analytics.productCount}
        warehouseCount={analytics.warehouseCount}
        outOfStockCount={analytics.outOfStockCount}
        currency={settings.currency}
      />

      <InventorySalesChart points={analytics.chart} />

      <ProductSalesTable
        rows={analytics.productSales}
        productNameById={productNameById}
        currency={settings.currency}
      />

      <WarehouseSalesTable
        rows={analytics.warehouseSales}
        warehouseNameById={warehouseNameById}
        currency={settings.currency}
      />

      <InventoryStockTable
        title={t('analyticsStock')}
        items={analytics.stock}
        warehouseNameById={warehouseNameById}
        productNameById={productNameById}
      />

      <InventoryStockTable
        title={t('analyticsOutOfStockTitle')}
        items={analytics.outOfStock}
        warehouseNameById={warehouseNameById}
        productNameById={productNameById}
      />
    </section>
  )
}
