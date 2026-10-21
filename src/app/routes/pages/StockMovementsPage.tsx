import { useAccess } from '../../context/access-context'
import { useStockMovements } from '../../context/stock-movement-context'
import { useLocalization } from '../../context/localization-context'
import { useProducts } from '../../context/product-context'
import { useWarehouses } from '../../context/warehouse-context'
import { StockMovementForm } from '../../../modules/inventory/components/StockMovementForm'
import { StockMovementList } from '../../../modules/inventory/components/StockMovementList'
import { EmptyState, PageHeader } from '../../../shared/ui'
import { ExcelExportButton } from '../../../shared/components/ExcelExportButton'

export function StockMovementsPage() {
  const { t } = useLocalization()
  const { hasWarehouseAccess } = useAccess()
  const { warehouses } = useWarehouses()
  const { products } = useProducts()
  const { movements, createMovement } = useStockMovements()
  const canCreateMovement =
    hasWarehouseAccess('inventory.adjust') &&
    warehouses.length > 0 &&
    products.length > 0

  const warehouseNameById = Object.fromEntries(
    warehouses.map((warehouse) => [warehouse.id, warehouse.name]),
  )
  const productNameById = Object.fromEntries(
    products.map((product) => [product.id, product.name]),
  )

  return (
    <section className="workspace-page">
      <PageHeader
        title={t('navMovements')}
        actions={<ExcelExportButton dataset="stock_movements" />}
      />

      {movements.length === 0 ? (
        <EmptyState title={t('noMovements')} />
      ) : (
        <StockMovementList
          items={movements}
          warehouseNameById={warehouseNameById}
          productNameById={productNameById}
        />
      )}

      {canCreateMovement ? (
        <StockMovementForm
          warehouses={warehouses}
          products={products}
          onSubmit={createMovement}
        />
      ) : null}
    </section>
  )
}
