import type { SaleReturnRecord } from '../../../app/context/sale-return-context'
import { useLocalization } from '../../../app/context/localization-context'
import { SaleReturnCard } from './SaleReturnCard'

type SaleReturnListProps = {
  records: SaleReturnRecord[]
  saleLabelById: Record<string, string>
  warehouseNameById: Record<string, string>
  productNameById: Record<string, string>
  onComplete: (id: string) => void
  onCancel: (id: string) => void
  onDetails: (id: string) => void
  completeErrorId: string | null
}

export function SaleReturnList({
  records,
  saleLabelById,
  warehouseNameById,
  productNameById,
  onComplete,
  onCancel,
  onDetails,
  completeErrorId,
}: SaleReturnListProps) {
  const { t } = useLocalization()

  return (
    <div className="inventory-table-wrap settings-section">
      <table className="inventory-table data-table--mobile-cards">
        <thead>
          <tr>
            <th>{t('movementDate')}</th>
            <th>{t('returnSale')}</th>
            <th>{t('inventoryWarehouse')}</th>
            <th>{t('returnProduct')}</th>
            <th>{t('returnQuantity')}</th>
            <th>{t('returnTotal')}</th>
            <th>{t('status')}</th>
            <th>{t('transferActions')}</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <SaleReturnCard
              key={record.return.id}
              record={record}
              saleLabel={
                saleLabelById[record.return.saleId] ?? record.return.saleId
              }
              warehouseName={
                record.return.warehouseId
                  ? warehouseNameById[record.return.warehouseId] ??
                    record.return.warehouseId
                  : t('warehouseNotRequired')
              }
              productNames={record.items
                .map((item) => productNameById[item.productId] ?? item.productId)
                .join(', ')}
              quantity={record.items.reduce(
                (sum, item) => sum + item.quantity,
                0,
              )}
              onComplete={onComplete}
              onCancel={onCancel}
              onDetails={onDetails}
              completeError={completeErrorId === record.return.id}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}
