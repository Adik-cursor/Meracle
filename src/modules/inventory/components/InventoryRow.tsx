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
      <td>{productName}</td>
      <td>{warehouseName}</td>
      <td className="is-num">{quantity}</td>
      <td className="is-num">{unitCost}</td>
      <td className="is-num">{value}</td>
      <td>
        {canReceive ? (
          <Button onClick={onReceive}>{t('receiveStock')}</Button>
        ) : null}
      </td>
    </tr>
  )
}
