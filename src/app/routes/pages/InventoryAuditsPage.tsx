import { useMemo, useState } from 'react'
import { useAccess } from '../../context/access-context'
import { useLocalization } from '../../context/localization-context'
import { usePersistence, usePersistenceVersion } from '../../context/persistence-context'
import { useWarehouses } from '../../context/warehouse-context'
import { AuthRequiredState } from '../../components/AuthRequiredState'
import { Button, EmptyState, FilterBar, PageHeader, Select, StatusBadge } from '../../../shared/ui'
import {
  listAuditsForUser,
  startInventoryAuditForUser,
} from '../../../core/services'
import { useAppPath } from '../useAppPath'

export function InventoryAuditsPage() {
  const { t } = useLocalization()
  const { navigate } = useAppPath()
  const { currentUser, hasWarehouseAccess } = useAccess()
  const persistence = usePersistence()
  const version = usePersistenceVersion()
  const { warehouses } = useWarehouses()
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? '')

  const audits = useMemo(() => {
    void version
    const listed = listAuditsForUser(persistence, currentUser)
    return listed.ok ? listed.value : []
  }, [currentUser, persistence, version])

  if (!currentUser) {
    return <AuthRequiredState />
  }

  const canCreate = hasWarehouseAccess('audit.create')

  return (
    <section className="workspace-page">
      <PageHeader
        title={t('navInventoryAudits')}
        actions={
          canCreate ? (
            <Button
              variant="primary"
              onClick={() => {
                if (!warehouseId) {
                  return
                }
                const created = startInventoryAuditForUser(
                  persistence,
                  currentUser,
                  warehouseId,
                )
                if (created.ok) {
                  navigate(`/inventory/audits/${created.value.id}?autoExcel=1`)
                }
              }}
            >
              {t('createInventoryAudit')}
            </Button>
          ) : null
        }
      />
      {canCreate ? (
        <FilterBar
          filters={
            <Select
              value={warehouseId}
              onChange={(event) => setWarehouseId(event.target.value)}
              aria-label={t('inventoryWarehouse')}
            >
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </Select>
          }
        />
      ) : null}
      {audits.length === 0 ? (
        <EmptyState title={t('noInventoryAudits')} />
      ) : (
        <div className="inventory-table-wrap">
          <table className="inventory-table">
            <thead>
              <tr>
                <th>{t('createdAt')}</th>
                <th>{t('inventoryWarehouse')}</th>
                <th>{t('status')}</th>
              </tr>
            </thead>
            <tbody>
              {audits.map((audit) => (
                <tr key={audit.id}>
                  <td>{audit.createdAt.slice(0, 16)}</td>
                  <td>
                    {warehouses.find((item) => item.id === audit.warehouseId)?.name ?? ''}
                  </td>
                  <td>
                    <StatusBadge
                      tone={
                        audit.status === 'completed'
                          ? 'success'
                          : audit.status === 'cancelled'
                            ? 'danger'
                            : audit.status === 'in_progress'
                              ? 'warning'
                              : 'neutral'
                      }
                    >
                      {audit.status}
                    </StatusBadge>
                  </td>
                  <td>
                    <Button onClick={() => navigate(`/inventory/audits/${audit.id}`)}>
                      {t('open')}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
