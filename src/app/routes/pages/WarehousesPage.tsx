import { useState } from 'react'
import { useAccess } from '../../context/access-context'
import { useWarehouses } from '../../context/warehouse-context'
import { useLocalization } from '../../context/localization-context'
import { WarehouseForm } from '../../../modules/warehouse/components/WarehouseForm'
import { WarehouseList } from '../../../modules/warehouse/components/WarehouseList'
import type { Warehouse } from '../../../core/types'
import type { WarehouseDraft } from '../../../modules/warehouse/warehouse.types'
import { AuthRequiredState } from '../../components/AuthRequiredState'
import { Button, EmptyState, PageHeader, useToast } from '../../../shared/ui'

export function WarehousesPage() {
  const { t } = useLocalization()
  const { showToast } = useToast()
  const { currentUser, hasWarehouseAccess } = useAccess()
  const canManageWarehouses = hasWarehouseAccess('warehouses.manage')
  const { warehouses, createWarehouse, updateWarehouse, setWarehouseStatus } =
    useWarehouses()
  const [formMode, setFormMode] = useState<'closed' | 'create' | 'edit'>(
    'closed',
  )
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(
    null,
  )

  const closeForm = () => {
    setFormMode('closed')
    setEditingWarehouse(null)
  }

  const handleCreate = (draft: WarehouseDraft) => {
    createWarehouse(draft)
    showToast(t('savedToast'))
    closeForm()
  }

  const selectedWarehouse =
    formMode === 'edit' && editingWarehouse
      ? warehouses.find((warehouse) => warehouse.id === editingWarehouse.id)
      : undefined

  const handleUpdate = (draft: WarehouseDraft) => {
    if (!selectedWarehouse) {
      return
    }

    updateWarehouse(selectedWarehouse.id, draft)
    showToast(t('savedToast'))
    closeForm()
  }

  const handleEdit = (warehouse: Warehouse) => {
    setEditingWarehouse(warehouse)
    setFormMode('edit')
  }

  const handleSetStatus = (warehouse: Warehouse) => {
    setWarehouseStatus(
      warehouse.id,
      warehouse.status === 'active' ? 'inactive' : 'active',
    )
  }

  if (!currentUser) {
    return <AuthRequiredState />
  }

  return (
    <section className="workspace-page">
      <PageHeader
        title={t('navWarehouses')}
        actions={
          formMode === 'closed' && warehouses.length > 0 && canManageWarehouses ? (
            <Button variant="primary" onClick={() => setFormMode('create')}>
              + {t('addWarehouse')}
            </Button>
          ) : null
        }
      />

      {formMode === 'create' ? (
        <WarehouseForm
          mode="create"
          onSubmit={handleCreate}
          onCancel={closeForm}
        />
      ) : null}

      {formMode === 'edit' && selectedWarehouse ? (
        <WarehouseForm
          key={`${selectedWarehouse.id}-${selectedWarehouse.updatedAt}`}
          mode="edit"
          warehouse={selectedWarehouse}
          onSubmit={handleUpdate}
          onCancel={closeForm}
        />
      ) : null}

      {warehouses.length === 0 && formMode === 'closed' ? (
        <EmptyState
          title={t('noWarehouses')}
          action={
            canManageWarehouses ? (
              <Button variant="primary" onClick={() => setFormMode('create')}>
                + {t('addWarehouse')}
              </Button>
            ) : undefined
          }
        />
      ) : null}

      {warehouses.length > 0 ? (
        <WarehouseList
          warehouses={warehouses}
          canManage={canManageWarehouses}
          onEdit={canManageWarehouses ? handleEdit : undefined}
          onSetStatus={canManageWarehouses ? handleSetStatus : undefined}
        />
      ) : null}
    </section>
  )
}
