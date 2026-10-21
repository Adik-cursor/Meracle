import type { SaleRecord } from '../../../app/context/sales-context'
import { useLocalization } from '../../../app/context/localization-context'
import { SaleCard } from './SaleCard'

type SaleListProps = {
  records: SaleRecord[]
  warehouseNameById: Record<string, string>
  productNameById: Record<string, string>
  customerNameById: Record<string, string>
  onConfirm: (id: string) => void
  onComplete: (id: string) => void
  onCancel: (id: string) => void
  actionErrorById: Record<string, string>
}

export function SaleList({
  records,
  warehouseNameById,
  productNameById,
  customerNameById,
  onConfirm,
  onComplete,
  onCancel,
  actionErrorById,
}: SaleListProps) {
  const { t } = useLocalization()

  return (
    <div className="inventory-table-wrap settings-section">
      <table className="inventory-table">
        <thead>
          <tr>
            <th>{t('movementDate')}</th>
            <th>{t('inventoryWarehouse')}</th>
            <th>{t('customerName')}</th>
            <th>{t('status')}</th>
            <th>{t('saleTotal')}</th>
            <th>{t('paidAmount')}</th>
            <th>{t('paymentDue')}</th>
            <th>{t('payment')}</th>
            <th>{t('saleItems')}</th>
            <th>{t('transferActions')}</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <SaleCard
              key={record.sale.id}
              record={record}
              warehouseName={
                record.sale.warehouseId
                  ? (warehouseNameById[record.sale.warehouseId] ??
                    record.sale.warehouseId)
                  : ''
              }
              customerName={
                record.sale.customerId
                  ? (customerNameById[record.sale.customerId] ??
                    record.sale.customerId)
                  : null
              }
              productNameById={productNameById}
              onConfirm={onConfirm}
              onComplete={onComplete}
              onCancel={onCancel}
              actionError={actionErrorById[record.sale.id] ?? null}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}
