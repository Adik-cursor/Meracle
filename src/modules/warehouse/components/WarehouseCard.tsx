import { useLocalization } from '../../../app/context/localization-context'
import type { Warehouse } from '../../../core/types'

type WarehouseCardProps = {
  warehouse: Warehouse
  onEdit: (warehouse: Warehouse) => void
  onSetStatus: (warehouse: Warehouse) => void
}

export function WarehouseCard({
  warehouse,
  onEdit,
  onSetStatus,
}: WarehouseCardProps) {
  const { t } = useLocalization()
  const isActive = warehouse.status === 'active'

  return (
    <article className="warehouse-card">
      <div className="module-row__info">
        <p className="module-row__title">{warehouse.name}</p>
        {warehouse.description ? (
          <p className="module-row__description">{warehouse.description}</p>
        ) : null}
        {warehouse.address ? (
          <p className="module-row__description">{warehouse.address}</p>
        ) : null}
        <p className="warehouse-card__status">
          {isActive ? t('active') : t('inactive')}
        </p>
      </div>
      <div className="warehouse-card__actions">
        <button
          type="button"
          className="module-switch"
          onClick={() => onEdit(warehouse)}
        >
          {t('edit')}
        </button>
        <button
          type="button"
          className={isActive ? 'module-switch' : 'module-switch module-switch--on'}
          onClick={() => onSetStatus(warehouse)}
        >
          {isActive ? t('turnOff') : t('turnOn')}
        </button>
      </div>
    </article>
  )
}
