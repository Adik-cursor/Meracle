import { useState, type FormEvent } from 'react'
import { useLocalization } from '../../../app/context/localization-context'
import type { SaleItemDraft } from '../../../app/context/sales-context'
import type { Id, Product } from '../../../core/types'
import { calcLineTotal } from '../sale-stock'

type SaleItemFormProps = {
  warehouseId: Id
  products: Product[]
  excludedProductIds: Id[]
  getAvailable: (productId: Id) => number
  onAdd: (item: SaleItemDraft) => void
}

export function SaleItemForm({
  warehouseId,
  products,
  excludedProductIds,
  getAvailable,
  onAdd,
}: SaleItemFormProps) {
  const { t } = useLocalization()
  const [productId, setProductId] = useState('')
  const [quantityInput, setQuantityInput] = useState('')
  const [unitPriceInput, setUnitPriceInput] = useState('')
  const [discountInput, setDiscountInput] = useState('0')
  const [error, setError] = useState<string | null>(null)

  const availableProducts = products.filter(
    (product) => !excludedProductIds.includes(product.id),
  )
  const availableQuantity = productId ? getAvailable(productId) : 0
  const quantity = Number(quantityInput)
  const unitPrice = Number(unitPriceInput)
  const discount = Number(discountInput)
  const lineTotal =
    productId &&
    Number.isFinite(quantity) &&
    Number.isFinite(unitPrice) &&
    Number.isFinite(discount)
      ? calcLineTotal(quantity, unitPrice, discount)
      : 0

  const stockMessage = (() => {
    if (!productId) {
      return null
    }

    if (availableQuantity === 0) {
      return t('saleProductMissingOnWarehouse')
    }

    if (Number.isFinite(quantity) && quantity > availableQuantity) {
      return `${t('saleInsufficientStock')} ${availableQuantity}`
    }

    return null
  })()

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!warehouseId || !productId) {
      return
    }

    if (
      quantityInput.trim() === '' ||
      unitPriceInput.trim() === '' ||
      discountInput.trim() === '' ||
      Number.isNaN(quantity) ||
      Number.isNaN(unitPrice) ||
      Number.isNaN(discount)
    ) {
      setError(t('quantityMustBeNumber'))
      return
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError(t('quantityMustBePositive'))
      return
    }

    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      setError(t('quantityNotNegative'))
      return
    }

    if (!Number.isFinite(discount) || discount < 0) {
      setError(t('saleDiscountInvalid'))
      return
    }

    if (quantity * unitPrice - discount < 0) {
      setError(t('saleLineTotalInvalid'))
      return
    }

    if (availableQuantity === 0) {
      setError(t('saleProductMissingOnWarehouse'))
      return
    }

    if (quantity > availableQuantity) {
      setError(`${t('saleInsufficientStock')} ${availableQuantity}`)
      return
    }

    onAdd({
      productId,
      quantity,
      unitPrice,
      discount,
    })
    setProductId('')
    setQuantityInput('')
    setUnitPriceInput('')
    setDiscountInput('0')
    setError(null)
  }

  return (
    <form className="warehouse-form settings-section" onSubmit={handleSubmit}>
      <h2>{t('addSaleItem')}</h2>

      <label className="warehouse-field">
        <span className="settings-field__label">{t('inventoryProduct')}</span>
        <select
          className="warehouse-input"
          name="productId"
          value={productId}
          onChange={(event) => {
            setProductId(event.target.value)
            setError(null)
          }}
        >
          <option value="">{t('selectProduct')}</option>
          {availableProducts.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name}
            </option>
          ))}
        </select>
        {stockMessage ? (
          <span className="warehouse-field__error">{stockMessage}</span>
        ) : null}
      </label>

      <label className="warehouse-field">
        <span className="settings-field__label">{t('saleQuantity')}</span>
        <input
          className="warehouse-input"
          type="number"
          name="quantity"
          min="0"
          step="any"
          value={quantityInput}
          onChange={(event) => {
            setQuantityInput(event.target.value)
            setError(null)
          }}
        />
      </label>

      <label className="warehouse-field">
        <span className="settings-field__label">{t('saleUnitPrice')}</span>
        <input
          className="warehouse-input"
          type="number"
          name="unitPrice"
          min="0"
          step="any"
          value={unitPriceInput}
          onChange={(event) => {
            setUnitPriceInput(event.target.value)
            setError(null)
          }}
        />
      </label>

      <label className="warehouse-field">
        <span className="settings-field__label">{t('saleDiscount')}</span>
        <input
          className="warehouse-input"
          type="number"
          name="discount"
          min="0"
          step="any"
          value={discountInput}
          onChange={(event) => {
            setDiscountInput(event.target.value)
            setError(null)
          }}
        />
      </label>

      <div className="warehouse-field">
        <span className="settings-field__label">{t('saleLineTotal')}</span>
        <span className="settings-field__value">{lineTotal}</span>
      </div>

      {error ? <p className="warehouse-field__error">{error}</p> : null}

      <div className="warehouse-form__actions">
        <button
          type="submit"
          className="module-switch module-switch--on"
          disabled={!warehouseId || !productId || availableQuantity === 0}
        >
          {t('addSaleItem')}
        </button>
      </div>
    </form>
  )
}
