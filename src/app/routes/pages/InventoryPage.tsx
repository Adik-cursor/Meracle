import { useState, type FormEvent } from 'react'
import { useAccess } from '../../context/access-context'
import { useInventory } from '../../context/inventory-context'
import { useLocalization } from '../../context/localization-context'
import { useProducts } from '../../context/product-context'
import { useWarehouses } from '../../context/warehouse-context'
import { isPhysicalProduct } from '../../../core/types/product'
import { InventoryList } from '../../../modules/inventory/components/InventoryList'
import { EmptyState, PageHeader } from '../../../shared/ui'
import { ExcelExportButton } from '../../../shared/components/ExcelExportButton'

export function InventoryPage() {
  const { t } = useLocalization()
  const { hasWarehouseAccess } = useAccess()
  const { warehouses } = useWarehouses()
  const { products } = useProducts()
  const { inventory, receiveStock } = useInventory()
  const physicalProducts = products.filter((product) => isPhysicalProduct(product))
  const stockedProductIds = new Set(inventory.map((item) => item.productId))
  const productsWithoutInventory = physicalProducts.filter(
    (product) => !stockedProductIds.has(product.id),
  )
  const [warehouseId, setWarehouseId] = useState('')
  const [productId, setProductId] = useState('')
  const [quantityInput, setQuantityInput] = useState('')
  const [unitCostInput, setUnitCostInput] = useState('')
  const [note, setNote] = useState('')
  const [errorKey, setErrorKey] = useState<
    'quantityMustBeNumber' | 'quantityNotNegative' | 'INVALID_INPUT' | null
  >(null)

  const canReceive =
    hasWarehouseAccess('receipt.create') &&
    warehouses.length > 0 &&
    physicalProducts.length > 0

  const warehouseNameById = Object.fromEntries(
    warehouses.map((warehouse) => [warehouse.id, warehouse.name]),
  )
  const productNameById = Object.fromEntries(
    products.map((product) => [product.id, product.name]),
  )

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const quantity = Number(quantityInput)
    const unitCost = Number(unitCostInput)

    if (
      quantityInput.trim() === '' ||
      Number.isNaN(quantity) ||
      !Number.isFinite(quantity) ||
      quantity <= 0
    ) {
      setErrorKey('quantityMustBeNumber')
      return
    }

    if (!Number.isFinite(unitCost) || unitCost < 0) {
      setErrorKey('INVALID_INPUT')
      return
    }

    if (!warehouseId || !productId) {
      setErrorKey('INVALID_INPUT')
      return
    }

    const ok = receiveStock({
      warehouseId,
      productId,
      quantity,
      unitCost,
      note: note.trim() || undefined,
    })
    if (!ok) {
      setErrorKey('INVALID_INPUT')
      return
    }

    setQuantityInput('')
    setNote('')
    setErrorKey(null)
  }

  const startReceive = (
    nextProductId: string,
    nextWarehouseId: string,
    nextUnitCost?: number,
  ) => {
    setProductId(nextProductId)
    setWarehouseId(nextWarehouseId || warehouses[0]?.id || '')
    setUnitCostInput(
      nextUnitCost !== undefined && Number.isFinite(nextUnitCost)
        ? String(nextUnitCost)
        : '',
    )
    setQuantityInput('')
    setErrorKey(null)
  }

  return (
    <section className="workspace-page">
      <PageHeader
        title={t('navInventory')}
        actions={<ExcelExportButton dataset="inventory" />}
      />

      {inventory.length === 0 ? (
        <EmptyState title={t('noInventoryItems')} />
      ) : (
        <InventoryList
          items={inventory}
          warehouseNameById={warehouseNameById}
          productNameById={productNameById}
          canReceive={canReceive}
          onReceive={(item) =>
            startReceive(item.productId, item.warehouseId, item.unitCost)
          }
        />
      )}

      {canReceive && productsWithoutInventory.length > 0 ? (
        <div className="inventory-table-wrap">
          <h2>{t('productsWithoutInventory')}</h2>
          <table className="inventory-table">
            <thead>
              <tr>
                <th>{t('inventoryProduct')}</th>
                <th>{t('sku')}</th>
                <th>{t('transferActions')}</th>
              </tr>
            </thead>
            <tbody>
              {productsWithoutInventory.map((product) => (
                <tr key={product.id}>
                  <td>{product.name}</td>
                  <td>{product.sku}</td>
                  <td>
                    <button
                      type="button"
                      className="module-switch module-switch--on"
                      onClick={() =>
                        startReceive(
                          product.id,
                          warehouses[0]?.id ?? '',
                          product.costPrice,
                        )
                      }
                    >
                      {t('receiveStock')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {canReceive ? (
        <form className="warehouse-form settings-section" onSubmit={handleSubmit}>
          <h2>{t('receiveStock')}</h2>

          <label className="warehouse-field">
            <span className="settings-field__label">{t('inventoryProduct')}</span>
            <select
              className="warehouse-input"
              name="productId"
              value={productId}
              onChange={(event) => {
                const nextProductId = event.target.value
                setProductId(nextProductId)
                const product = physicalProducts.find(
                  (entry) => entry.id === nextProductId,
                )
                if (product && unitCostInput.trim() === '') {
                  setUnitCostInput(String(product.costPrice))
                }
              }}
            >
              <option value="">{t('selectProduct')}</option>
              {physicalProducts.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </label>

          <label className="warehouse-field">
            <span className="settings-field__label">{t('inventoryWarehouse')}</span>
            <select
              className="warehouse-input"
              name="warehouseId"
              value={warehouseId}
              onChange={(event) => setWarehouseId(event.target.value)}
            >
              <option value="">{t('selectWarehouse')}</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>
          </label>

          <label className="warehouse-field">
            <span className="settings-field__label">{t('inventoryQuantity')}</span>
            <input
              className="warehouse-input"
              type="number"
              min="0"
              step="any"
              name="quantity"
              value={quantityInput}
              onChange={(event) => setQuantityInput(event.target.value)}
            />
          </label>

          <label className="warehouse-field">
            <span className="settings-field__label">{t('costPrice')}</span>
            <input
              className="warehouse-input"
              type="number"
              min="0"
              step="any"
              name="unitCost"
              value={unitCostInput}
              onChange={(event) => setUnitCostInput(event.target.value)}
            />
          </label>

          <label className="warehouse-field">
            <span className="settings-field__label">{t('receiveStockComment')}</span>
            <input
              className="warehouse-input"
              type="text"
              name="note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </label>

          {errorKey ? (
            <span className="warehouse-field__error">{t(errorKey)}</span>
          ) : null}

          <div className="warehouse-form__actions">
            <button
              type="submit"
              className="module-switch module-switch--on"
              disabled={!warehouseId || !productId}
            >
              {t('receiveStock')}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  )
}
