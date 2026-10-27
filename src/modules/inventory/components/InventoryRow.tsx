import { useLocalization } from '../../../app/context/localization-context'
import { Button } from '../../../shared/ui'

type InventoryRowProps = {
  warehouseName: string
  productName: string
  quantity: number
  unitCost: number
  canReceive: boolean
  onReceive: () => void
}

export function InventoryRow({
  warehouseName,
  productName,
  quantity,
  unitCost,
  canReceive,
  onReceive,
}: InventoryRowProps) {
  const { t } = useLocalization()
  const value = Math.round(quantity * unitCost * 100) / 100

  return (
    <tr>
      <td data-label={t('inventoryProduct')}>{productName}</td>
      <td data-label={t('inventoryWarehouse')}>{warehouseName}</td>
      <td className="is-num" data-label={t('inventoryQuantity')}>{quantity}</td>
      <td className="is-num" data-label={t('costPrice')}>{unitCost}</td>
      <td className="is-num" data-label={t('inventoryStockValue')}>{value}</td>
      <td data-label={t('transferActions')}>
        {canReceive ? (
          <Button onClick={onReceive}>{t('receiveStock')}</Button>
        ) : null}
      </td>
    </tr>
  )
}
