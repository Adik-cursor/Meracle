import { useState, type FormEvent } from 'react'
import { useLocalization } from '../../../app/context/localization-context'
import type { Product, Warehouse } from '../../../core/types'
import type {
  JournalMovementType,
  StockMovementDraft,
} from '../../../app/context/stock-movement-context'

type StockMovementFormProps = {
  warehouses: Warehouse[]
  products: Product[]
  onSubmit: (draft: StockMovementDraft) => void
}

export function StockMovementForm({
  warehouses,
  products,
  onSubmit,
}: StockMovementFormProps) {
  const { t } = useLocalization()
  const [warehouseId, setWarehouseId] = useState('')
  const [productId, setProductId] = useState('')
  const [type, setType] = useState<JournalMovementType>('receipt')
  const [quantityInput, setQuantityInput] = useState('')
  const [note, setNote] = useState('')
  const [errorKey, setErrorKey] = useState<
    'quantityMustBeNumber' | 'quantityMustBePositive' | null
  >(null)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const quantity = Number(quantityInput)

    if (quantityInput.trim() === '' || Number.isNaN(quantity)) {
      setErrorKey('quantityMustBeNumber')
      return
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setErrorKey('quantityMustBePositive')
      return
    }

    if (!warehouseId || !productId) {
      return
    }

    onSubmit({
      warehouseId,
      productId,
      type,
      quantity,
      note: note.trim() || undefined,
    })

    setQuantityInput('')
    setNote('')
    setErrorKey(null)
  }

  return (
    <form className="warehouse-form settings-section" onSubmit={handleSubmit}>
      <h2>{t('newMovement')}</h2>

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
        <span className="settings-field__label">{t('movementType')}</span>
        <select
          className="warehouse-input"
          name="type"
          value={type}
          onChange={(event) => {
            const nextType = event.target.value
            if (
              nextType === 'receipt' ||
              nextType === 'shipment' ||
              nextType === 'adjustment'
            ) {
              setType(nextType)
            }
          }}
        >
          <option value="receipt">{t('movementReceipt')}</option>
          <option value="shipment">{t('movementShipment')}</option>
          <option value="adjustment">{t('movementAdjustment')}</option>
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

      <label className="warehouse-field">
        <span className="settings-field__label">{t('movementNote')}</span>
        <textarea
          className="warehouse-input warehouse-input--area"
          name="note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={3}
        />
      </label>

      <div className="warehouse-form__actions">
        <button
          type="submit"
          className="module-switch module-switch--on"
          disabled={!warehouseId || !productId}
        >
          {t('create')}
        </button>
      </div>
    </form>
  )
}
