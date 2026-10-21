import { useState } from 'react'
import { useAccess } from '../../context/access-context'
import { useLocalization } from '../../context/localization-context'
import { useProducts } from '../../context/product-context'
import { useWarehouseTransfers } from '../../context/warehouse-transfer-context'
import { useWarehouses } from '../../context/warehouse-context'
import { WarehouseTransferForm } from '../../../modules/inventory/components/WarehouseTransferForm'
import { WarehouseTransferList } from '../../../modules/inventory/components/WarehouseTransferList'
import { EmptyState, PageHeader } from '../../../shared/ui'
import { ExcelExportButton } from '../../../shared/components/ExcelExportButton'

export function WarehouseTransfersPage() {
  const { t } = useLocalization()
  const { hasWarehouseAccess } = useAccess()
  const { warehouses } = useWarehouses()
  const { products } = useProducts()
  const {
    transfers,
    createTransfer,
    submitTransfer,
    completeTransfer,
    cancelTransfer,
  } = useWarehouseTransfers()
  const [completeErrorId, setCompleteErrorId] = useState<string | null>(null)
  const canCreateTransfer =
    hasWarehouseAccess('transfer.create') &&
    warehouses.length > 1 &&
    products.length > 0

  const warehouseNameById = Object.fromEntries(
    warehouses.map((warehouse) => [warehouse.id, warehouse.name]),
  )
  const productNameById = Object.fromEntries(
    products.map((product) => [product.id, product.name]),
  )

  const handleComplete = (id: string) => {
    const completed = completeTransfer(id)
    setCompleteErrorId(completed ? null : id)
    return completed
  }

  return (
    <section className="workspace-page">
      <PageHeader
        title={t('navTransfers')}
        actions={<ExcelExportButton dataset="transfers" />}
      />

      {!canCreateTransfer ? (
        <EmptyState title={t('transferNeedsCatalog')} />
      ) : (
        <>
          {transfers.length === 0 ? (
            <EmptyState title={t('noTransfers')} />
          ) : (
            <WarehouseTransferList
              items={transfers}
              warehouseNameById={warehouseNameById}
              productNameById={productNameById}
              onSubmitTransfer={submitTransfer}
              onCompleteTransfer={handleComplete}
              onCancelTransfer={(id) => {
                cancelTransfer(id)
                if (completeErrorId === id) {
                  setCompleteErrorId(null)
                }
              }}
              completeErrorId={completeErrorId}
            />
          )}

          {canCreateTransfer ? (
            <WarehouseTransferForm
              warehouses={warehouses}
              products={products}
              onSubmit={createTransfer}
            />
          ) : null}
        </>
      )}
    </section>
  )
}
