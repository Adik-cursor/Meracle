import { useState, type FormEvent } from 'react'
import { useLocalization } from '../../../app/context/localization-context'
import type { SaleDraft, SaleItemDraft } from '../../../app/context/sales-context'
import type { Product, ProductNotAvailableError, Warehouse, InventoryItem } from '../../../core/types'
import { calcLineTotal, calcSaleTotals, getAvailableQuantity } from '../sale-stock'
import { SaleItemForm } from './SaleItemForm'

type SaleCustomerOption = {
  id: string
  name: string
}

type SaleFormProps = {
  warehouses: Warehouse[]
  products: Product[]
  customers: SaleCustomerOption[]
  assignedWarehouseId?: string
  lockWarehouse?: boolean
  getStock: (warehouseId: string, productId: string) => InventoryItem | undefined
  onSubmit: (draft: SaleDraft) => { ok: true } | { ok: false; error: ProductNotAvailableError }
}

function formatStockError(
  error: ProductNotAvailableError,
  t: (key: 'saleProductMissingOnWarehouse' | 'saleInsufficientStock') => string,
): string {
  if (error.availableQuantity === 0) {
    return t('saleProductMissingOnWarehouse')
  }

  return `${t('saleInsufficientStock')} ${error.availableQuantity}`
}

export function SaleForm({
  warehouses,
  products,
  customers,
  assignedWarehouseId,
  lockWarehouse = false,
  getStock,
  onSubmit,
}: SaleFormProps) {
  const { t } = useLocalization()
  const [warehouseId, setWarehouseId] = useState(
    lockWarehouse ? (assignedWarehouseId ?? '') : '',
  )
  const [customerId, setCustomerId] = useState('')
  const [items, setItems] = useState<SaleItemDraft[]>([])
  const [discountInput, setDiscountInput] = useState('0')
  const [error, setError] = useState<string | null>(null)

  const assignedWarehouse = assignedWarehouseId
    ? warehouses.find((warehouse) => warehouse.id === assignedWarehouseId)
    : undefined
  const productNameById = Object.fromEntries(
    products.map((product) => [product.id, product.name]),
  )
  const lineTotals = items.map((item) =>
    calcLineTotal(item.quantity, item.unitPrice, item.discount),
  )
  const discount = Number(discountInput)
  const totals = calcSaleTotals(
    lineTotals,
    Number.isFinite(discount) ? Math.max(0, discount) : 0,
  )

  const handleAddItem = (item: SaleItemDraft) => {
    setItems((current) => [...current, item])
    setError(null)
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!warehouseId) {
      setError(t('saleWarehouseRequired'))
      return
    }

    if (items.length === 0) {
      setError(t('saleItemsRequired'))
      return
    }

    if (discountInput.trim() === '' || Number.isNaN(discount)) {
      setError(t('quantityMustBeNumber'))
      return
    }

    if (!Number.isFinite(discount) || discount < 0) {
      setError(t('saleDiscountInvalid'))
      return
    }

    const result = onSubmit({
      warehouseId,
      discount,
      items,
      customerId: customerId ? customerId : undefined,
    })

    if (!result.ok) {
      setError(formatStockError(result.error, t))
      return
    }

    setItems([])
    setDiscountInput('0')
    setCustomerId('')
    setError(null)
  }

  return (
    <div>
      <div className="warehouse-form settings-section">
        <h2>{t('newSale')}</h2>

        <label className="warehouse-field">
          <span className="settings-field__label">{t('inventoryWarehouse')}</span>
          {lockWarehouse ? (
            <span className="settings-field__value">
              {assignedWarehouse?.name ?? t('USER_WAREHOUSE_REQUIRED')}
            </span>
          ) : (
            <select
              className="warehouse-input"
              name="warehouseId"
              value={warehouseId}
              onChange={(event) => {
                setWarehouseId(event.target.value)
                setItems([])
                setError(null)
              }}
            >
              <option value="">{t('selectWarehouse')}</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>
          )}
        </label>

        <label className="warehouse-field">
          <span className="settings-field__label">{t('selectCustomer')}</span>
          <select
            className="warehouse-input"
            name="customerId"
            value={customerId}
            onChange={(event) => setCustomerId(event.target.value)}
          >
            <option value="">{t('customerNotSelected')}</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {warehouseId ? (
        <SaleItemForm
          warehouseId={warehouseId}
          products={products}
          excludedProductIds={items.map((item) => item.productId)}
          getAvailable={(productId) =>
            getAvailableQuantity(getStock(warehouseId, productId))
          }
          onAdd={handleAddItem}
        />
      ) : null}

      <form className="warehouse-form settings-section" onSubmit={handleSubmit}>
        <label className="warehouse-field">
          <span className="settings-field__label">{t('saleDiscount')}</span>
          <input
            className="warehouse-input"
            type="number"
            name="saleDiscount"
            min="0"
            step="any"
            value={discountInput}
            onChange={(event) => {
              setDiscountInput(event.target.value)
              setError(null)
            }}
          />
        </label>

        {items.length > 0 ? (
          <div className="inventory-table-wrap">
            <table className="inventory-table">
              <thead>
                <tr>
                  <th>{t('inventoryProduct')}</th>
                  <th>{t('saleQuantity')}</th>
                  <th>{t('saleUnitPrice')}</th>
                  <th>{t('saleDiscount')}</th>
                  <th>{t('saleLineTotal')}</th>
                  <th>{t('transferActions')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={`${item.productId}-${index}`}>
                    <td>{productNameById[item.productId] ?? item.productId}</td>
                    <td>{item.quantity}</td>
                    <td>{item.unitPrice}</td>
                    <td>{item.discount}</td>
                    <td>
                      {calcLineTotal(item.quantity, item.unitPrice, item.discount)}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="module-switch"
                        onClick={() =>
                          setItems((current) =>
                            current.filter((_, itemIndex) => itemIndex !== index),
                          )
                        }
                      >
                        {t('removeSaleItem')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <div className="warehouse-field">
          <span className="settings-field__label">{t('saleSubtotal')}</span>
          <span className="settings-field__value">{totals.subtotal}</span>
        </div>
        <div className="warehouse-field">
          <span className="settings-field__label">{t('saleTotal')}</span>
          <span className="settings-field__value">{totals.total}</span>
        </div>

        {error ? <p className="warehouse-field__error">{error}</p> : null}

        <div className="warehouse-form__actions">
          <button
            type="submit"
            className="module-switch module-switch--on"
            disabled={!warehouseId || items.length === 0}
          >
            {t('create')}
          </button>
        </div>
      </form>
    </div>
  )
}
