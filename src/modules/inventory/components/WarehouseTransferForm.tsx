import { useState, type FormEvent } from 'react'
import { useLocalization } from '../../../app/context/localization-context'
import type { Product, Warehouse } from '../../../core/types'
import type { WarehouseTransferDraft } from '../../../app/context/warehouse-transfer-context'

type WarehouseTransferFormProps = {
  warehouses: Warehouse[]
  products: Product[]
  onSubmit: (draft: WarehouseTransferDraft) => boolean
}

export function WarehouseTransferForm({
  warehouses,
  products,
  onSubmit,
}: WarehouseTransferFormProps) {
  const { t } = useLocalization()
  const [sourceWarehouseId, setSourceWarehouseId] = useState('')
  const [destinationWarehouseId, setDestinationWarehouseId] = useState('')
  const [productId, setProductId] = useState('')
  const [quantityInput, setQuantityInput] = useState('')
  const [errorKey, setErrorKey] = useState<
    | 'quantityMustBeNumber'
    | 'quantityMustBePositive'
    | 'transferSameWarehouse'
    | null
  >(null)

  const destinationOptions = warehouses.filter(
    (warehouse) => warehouse.id !== sourceWarehouseId,
  )

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!sourceWarehouseId || !destinationWarehouseId || !productId) {
      return
    }

    if (sourceWarehouseId === destinationWarehouseId) {
      setErrorKey('transferSameWarehouse')
      return
    }

    const quantity = Number(quantityInput)

    if (quantityInput.trim() === '' || Number.isNaN(quantity)) {
      setErrorKey('quantityMustBeNumber')
      return
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setErrorKey('quantityMustBePositive')
      return
    }

    const created = onSubmit({
      sourceWarehouseId,
      destinationWarehouseId,
      productId,
      quantity,
    })

    if (!created) {
      setErrorKey('transferSameWarehouse')
      return
    }

    setQuantityInput('')
    setErrorKey(null)
  }

  return (
    <form className="warehouse-form settings-section" onSubmit={handleSubmit}>
      <h2>{t('newTransfer')}</h2>

      <label className="warehouse-field">
        <span className="settings-field__label">{t('transferSource')}</span>
        <select
          className="warehouse-input"
          name="sourceWarehouseId"
          value={sourceWarehouseId}
          onChange={(event) => {
            const nextSource = event.target.value
            setSourceWarehouseId(nextSource)
            if (destinationWarehouseId === nextSource) {
              setDestinationWarehouseId('')
            }
            if (errorKey) {
              setErrorKey(null)
            }
          }}
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
        <span className="settings-field__label">{t('transferDestination')}</span>
        <select
          className="warehouse-input"
          name="destinationWarehouseId"
          value={destinationWarehouseId}
          onChange={(event) => {
            setDestinationWarehouseId(event.target.value)
            if (errorKey) {
              setErrorKey(null)
            }
          }}
        >
          <option value="">{t('selectWarehouse')}</option>
          {destinationOptions.map((warehouse) => (
            <option key={warehouse.id} value={warehouse.id}>
              {warehouse.name}
            </option>
          ))}
        </select>
      </label>

      <label className="warehouse-field">
        <span className="settings-field__label">{t('inventoryProduct')}</span>
        <select
          className="warehouse-input"
          name="productId"
          value={productId}
          onChange={(event) => setProductId(event.target.value)}
        >
          <option value="">{t('selectProduct')}</option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name}
            </option>
          ))}
        </select>
      </label>

      <label className="warehouse-field">
        <span className="settings-field__label">{t('inventoryQuantity')}</span>
        <input
          className="warehouse-input"
          type="number"
          name="quantity"
          min="0"
          step="any"
          value={quantityInput}
          onChange={(event) => {
            setQuantityInput(event.target.value)
            if (errorKey) {
              setErrorKey(null)
            }
          }}
        />
        {errorKey ? (
          <span className="warehouse-field__error">{t(errorKey)}</span>
        ) : null}
      </label>

      <div className="warehouse-form__actions">
        <button
          type="submit"
          className="module-switch module-switch--on"
          disabled={!sourceWarehouseId || !destinationWarehouseId || !productId}
        >
          {t('create')}
        </button>
      </div>
    </form>
  )
}
