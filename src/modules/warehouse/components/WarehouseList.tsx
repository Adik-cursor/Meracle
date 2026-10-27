import type { Warehouse } from '../../../core/types'
import { useLocalization } from '../../../app/context/localization-context'
import { Button, StatusBadge, Table } from '../../../shared/ui'

type WarehouseListProps = {
  warehouses: Warehouse[]
  canManage?: boolean
  onEdit?: (warehouse: Warehouse) => void
  onSetStatus?: (warehouse: Warehouse) => void
}

export function WarehouseList({
  warehouses,
  canManage = false,
  onEdit,
  onSetStatus,
}: WarehouseListProps) {
  const { t } = useLocalization()

  return (
    <Table mobileLayout="cards">
      <thead>
        <tr>
          <th>{t('name')}</th>
          <th>{t('address')}</th>
          <th>{t('status')}</th>
          {canManage ? <th>{t('transferActions')}</th> : null}
        </tr>
      </thead>
      <tbody>
        {warehouses.map((warehouse) => {
          const isActive = warehouse.status === 'active'

          return (
            <tr key={warehouse.id}>
              <td>{warehouse.name}</td>
              <td>{warehouse.address ?? ''}</td>
              <td>
                <StatusBadge tone={isActive ? 'success' : 'neutral'}>
                  {isActive ? t('active') : t('inactive')}
                </StatusBadge>
              </td>
              {canManage ? (
                <td>
                  <div className="warehouse-card__actions">
                    <Button onClick={() => onEdit?.(warehouse)}>{t('edit')}</Button>
                    <Button
                      variant={isActive ? 'danger' : 'primary'}
                      onClick={() => onSetStatus?.(warehouse)}
                    >
                      {isActive ? t('turnOff') : t('turnOn')}
                    </Button>
                  </div>
                </td>
              ) : null}
            </tr>
          )
        })}
      </tbody>
    </Table>
  )
}
