import { useMemo, useState } from 'react'
import { useAccess } from '../../context/access-context'
import { useLocalization } from '../../context/localization-context'
import { usePersistence, usePersistenceVersion } from '../../context/persistence-context'
import { useAppPath } from '../useAppPath'
import { AuthRequiredState } from '../../components/AuthRequiredState'
import { useProducts } from '../../context/product-context'
import { useSaleReturns } from '../../context/sale-return-context'
import { useSales } from '../../context/sales-context'
import { useWarehouses } from '../../context/warehouse-context'
import { SaleReturnForm } from '../../../modules/sales/components/SaleReturnForm'
import { SaleReturnList } from '../../../modules/sales/components/SaleReturnList'
import { SaleReturnDetailModal } from '../../../modules/sales/components/SaleReturnDetailModal'
import { getSaleReturnDetailForUser } from '../../../core/services'
import { EmptyState } from '../../../shared/ui'

export function SaleReturnsPage() {
  const { t } = useLocalization()
  const { search } = useAppPath()
  const { currentUser, hasFinancialAccess } = useAccess()
  const persistence = usePersistence()
  const version = usePersistenceVersion()
  const { sales } = useSales()
  const { warehouses } = useWarehouses()
  const { products } = useProducts()
  const {
    returns,
    createReturn,
    completeReturn,
    cancelReturn,
    getReturnedQuantity,
    getReturnableQuantity,
  } = useSaleReturns()
  const initialSaleId = new URLSearchParams(search).get('saleId') ?? ''
  const [completeErrorId, setCompleteErrorId] = useState<string | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)

  const completedSales = sales.filter(
    (record) => record.sale.status === 'completed',
  )
  const warehouseNameById = Object.fromEntries(
    warehouses.map((warehouse) => [warehouse.id, warehouse.name]),
  )
  const productNameById = Object.fromEntries(
    products.map((product) => [product.id, product.name]),
  )
  const saleLabelById = Object.fromEntries(
    sales.map((record) => [
      record.sale.id,
      `${record.financialView?.canReadAmount ? record.sale.total : '—'} ${record.sale.currency}`,
    ]),
  )
  const detail = useMemo(() => {
    void version
    if (!detailId) {
      return undefined
    }
    const loaded = getSaleReturnDetailForUser(persistence, currentUser, detailId)
    return loaded.ok ? loaded.value : undefined
  }, [currentUser, detailId, persistence, version])

  if (!currentUser) {
    return <AuthRequiredState />
  }

  return (
    <section className="workspace-page">
      <div className="workspace-toolbar">
        <h2 className="workspace-toolbar__title">{t('navSaleReturns')}</h2>
      </div>

      {returns.length === 0 ? (
        <EmptyState title={t('noReturns')} />
      ) : (
        <SaleReturnList
          records={returns}
          saleLabelById={saleLabelById}
          warehouseNameById={warehouseNameById}
          productNameById={productNameById}
          onComplete={(id) => {
            const completed = completeReturn(id)
            setCompleteErrorId(completed ? null : id)
          }}
          onCancel={(id) => {
            cancelReturn(id)
            if (completeErrorId === id) {
              setCompleteErrorId(null)
            }
          }}
          onDetails={setDetailId}
          completeErrorId={completeErrorId}
        />
      )}

      {detail ? (
        <SaleReturnDetailModal detail={detail} onClose={() => setDetailId(null)} />
      ) : null}

      {!hasFinancialAccess('returns.create') ? (
        <p className="pos-ticket__error">{t('returnsCreateDenied')}</p>
      ) : null}

      {hasFinancialAccess('returns.create') ? (
        <SaleReturnForm
          sales={completedSales}
          initialSaleId={
            completedSales.some((record) => record.sale.id === initialSaleId)
              ? initialSaleId
              : ''
          }
          getItemOptions={(saleId) => {
            const record = completedSales.find((item) => item.sale.id === saleId)
            if (!record) {
              return []
            }

            return record.items.map((item) => ({
              saleItemId: item.id,
              productName: productNameById[item.productId] ?? item.productId,
              soldQuantity: item.quantity,
              returnedQuantity: getReturnedQuantity(item.id),
              returnableQuantity: getReturnableQuantity(item.id),
              unitPrice: item.unitPrice,
            }))
          }}
          onSubmit={createReturn}
        />
      ) : null}
    </section>
  )
}
