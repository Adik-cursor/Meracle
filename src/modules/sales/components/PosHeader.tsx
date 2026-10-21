import { userDisplayName } from '../../crm/users/user-name'
import type { Customer, User, Warehouse } from '../../../core/types'
import { useLocalization } from '../../../app/context/localization-context'
import { Button, Select } from '../../../shared/ui'

type CustomerOption = {
  id: string
  name: string
  taxId: string
}

type PosHeaderProps = {
  companyName: string
  currentUser: User
  warehouses: Warehouse[]
  warehouseId: string
  lockWarehouse: boolean
  warehousesEnabled: boolean
  view: 'sale' | 'history'
  customerId: string
  customers: CustomerOption[]
  selectedCustomer?: Customer
  onWarehouseChange: (warehouseId: string) => void
  onViewChange: (view: 'sale' | 'history') => void
  onCustomerChange: (customerId: string) => void
  onCreateCustomer: () => void
}

export function PosHeader({
  companyName,
  currentUser,
  warehouses,
  warehouseId,
  lockWarehouse,
  warehousesEnabled,
  view,
  customerId,
  customers,
  selectedCustomer,
  onWarehouseChange,
  onViewChange,
  onCustomerChange,
  onCreateCustomer,
}: PosHeaderProps) {
  const { t } = useLocalization()
  const warehouse = warehouses.find((item) => item.id === warehouseId)
  const customerName =
    customers.find((item) => item.id === customerId)?.name ?? customerId

  return (
    <div className="pos-header">
      <div className="pos-header__row">
        <div className="pos-header__intro">
          <p className="pos-header__company">{companyName}</p>
        </div>
        <div className="pos-header__tabs" aria-label={t('navSales')}>
          <button
            type="button"
            className="pos-header__tab pos-header__tab--active"
            onClick={() => onViewChange(view === 'sale' ? 'history' : 'sale')}
          >
            {view === 'sale' ? t('posHistoryTab') : t('posSaleTab')}
          </button>
        </div>
      </div>
      {view === 'sale' ? (
        <div className="pos-topbar">
          <div className="pos-topbar__meta">
            <div className="pos-header__field pos-header__field--inline">
              <span className="pos-header__label">{t('customer')}:</span>
              {selectedCustomer ? (
                <div className="pos-customer-chip">
                  <span className="pos-header__value">{customerName}</span>
                  <Button
                    variant="ghost"
                    className="pos-header__link"
                    onClick={() => onCustomerChange('')}
                  >
                    {t('posChangeCustomer')}
                  </Button>
                </div>
              ) : (
                <div className="pos-customer-pick">
                  <Select
                    className="pos-header__select"
                    name="customerId"
                    value={customerId}
                    onChange={(event) => onCustomerChange(event.target.value)}
                  >
                    <option value="">{t('selectCustomer')}</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name}
                      </option>
                    ))}
                  </Select>
                  <Button
                    variant="ghost"
                    className="pos-header__link"
                    onClick={onCreateCustomer}
                  >
                    {t('createCustomerFromSale')}
                  </Button>
                </div>
              )}
            </div>
            {warehousesEnabled ? (
              <div className="pos-header__field pos-header__field--inline">
                <span className="pos-header__label">{t('inventoryWarehouse')}:</span>
                {lockWarehouse ? (
                  <span className="pos-header__value">
                    {warehouse?.name ?? t('USER_WAREHOUSE_REQUIRED')}
                  </span>
                ) : (
                  <Select
                    className="pos-header__select"
                    name="warehouseId"
                    value={warehouseId}
                    onChange={(event) => onWarehouseChange(event.target.value)}
                  >
                    {warehouses.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </Select>
                )}
              </div>
            ) : (
              <div className="pos-header__field pos-header__field--inline">
                <span className="pos-header__label">{t('inventoryWarehouse')}:</span>
                <span className="pos-header__value">{t('warehouseNotRequired')}</span>
              </div>
            )}
            <div className="pos-header__field pos-header__field--inline">
              <span className="pos-header__label">{t('posCashier')}:</span>
              <span className="pos-header__value">{userDisplayName(currentUser)}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="pos-header__meta">
          <div className="pos-header__field pos-header__field--inline">
            <span className="pos-header__label">{t('posCashier')}:</span>
            <span className="pos-header__value">{userDisplayName(currentUser)}</span>
          </div>
        </div>
      )}
    </div>
  )
}
