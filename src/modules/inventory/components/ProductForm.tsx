import { useState, type FormEvent } from 'react'
import { useLocalization } from '../../../app/context/localization-context'
import type { Product, ProductItemType, Warehouse, ProductCategory } from '../../../core/types'
import type { ProductDraft, ProductFormMode } from '../product.types'
import { ProductImageField } from './ProductImageField'
import { ProductImageThumb } from './ProductImageThumb'
import { Badge, Button } from '../../../shared/ui'

type ProductFormProps = {
  mode: ProductFormMode
  product?: Product
  warehousesEnabled: boolean
  warehouses: Warehouse[]
  categories: ProductCategory[]
  stockLabel?: string
  onSubmit: (draft: ProductDraft) => boolean
  onCancel: () => void
}

export function ProductForm({
  mode,
  product,
  warehousesEnabled,
  warehouses,
  categories,
  stockLabel,
  onSubmit,
  onCancel,
}: ProductFormProps) {
  const { t } = useLocalization()
  const [itemType, setItemType] = useState<ProductItemType>(
    product?.itemType ?? 'product',
  )
  const [name, setName] = useState(product?.name ?? '')
  const [sku, setSku] = useState(product?.sku ?? '')
  const [description, setDescription] = useState(product?.description ?? '')
  const [unit, setUnit] = useState(product?.unit ?? '')
  const [basePrice, setBasePrice] = useState(String(product?.basePrice ?? 0))
  const [costPrice, setCostPrice] = useState(String(product?.costPrice ?? 0))
  const [initialQuantity, setInitialQuantity] = useState('0')
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? '')
  const [status, setStatus] = useState(product?.status ?? 'active')
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? '')
  const [imageUrl, setImageUrl] = useState(product?.imageUrl)
  const [nameError, setNameError] = useState(false)
  const [skuError, setSkuError] = useState(false)
  const [unitError, setUnitError] = useState(false)
  const [priceError, setPriceError] = useState(false)
  const [warehouseError, setWarehouseError] = useState(false)
  const [quantityError, setQuantityError] = useState(false)
  const [submitError, setSubmitError] = useState(false)
  const isProduct = itemType === 'product'
  const showOpeningStock =
    mode === 'create' && isProduct && warehousesEnabled

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const nextNameError = !name.trim()
    const nextSkuError = !sku.trim()
    const nextUnitError = !unit.trim()
    const parsedPrice = Number(basePrice)
    const parsedCost = Number(costPrice)
    const opening = Number(initialQuantity)
    const nextPriceError =
      !Number.isFinite(parsedPrice) ||
      parsedPrice < 0 ||
      (isProduct && (!Number.isFinite(parsedCost) || parsedCost < 0))
    const nextWarehouseError = showOpeningStock && !warehouseId
    const nextQuantityError =
      showOpeningStock &&
      (initialQuantity.trim() === '' ||
        Number.isNaN(opening) ||
        !Number.isFinite(opening) ||
        opening < 0)

    setNameError(nextNameError)
    setSkuError(nextSkuError)
    setUnitError(nextUnitError)
    setPriceError(nextPriceError)
    setWarehouseError(nextWarehouseError)
    setQuantityError(nextQuantityError)
    setSubmitError(false)

    if (
      nextNameError ||
      nextSkuError ||
      nextUnitError ||
      nextPriceError ||
      nextWarehouseError ||
      nextQuantityError
    ) {
      return
    }

    const saved = onSubmit({
      name: name.trim(),
      sku: sku.trim(),
      description: description.trim() || undefined,
      unit: unit.trim(),
      itemType,
      basePrice: parsedPrice,
      costPrice: isProduct ? parsedCost : 0,
      status,
      categoryId: categoryId || undefined,
      imageUrl,
      warehouseId: showOpeningStock ? warehouseId : undefined,
      initialQuantity: showOpeningStock ? opening : undefined,
    })

    if (!saved) {
      setSubmitError(true)
    }
  }

  return (
    <form className="warehouse-form settings-section product-form" onSubmit={handleSubmit}>
      <h2>{mode === 'create' ? t('newProduct') : t('editProduct')}</h2>
      {product ? (
        <div className="entity-cell entity-cell--identity">
          <ProductImageThumb imageUrl={product.imageUrl} name={product.name} size="identity" />
          <span>
            <span className="entity-cell__title">{product.name}</span>
            <span className="entity-cell__meta">
              {product.itemType === 'service' ? t('itemTypeService') : t('itemTypeProduct')}
              {' · '}
              {t('sku')} {product.sku}
              {stockLabel ? ` · ${t('dashboardKpiStock')} ${stockLabel}` : ''}
            </span>
          </span>
          <Badge tone={product.status === 'active' ? 'success' : 'neutral'}>
            {product.status === 'active' ? t('active') : t('inactive')}
          </Badge>
        </div>
      ) : null}

      <h3 className="product-form__group">{t('productFormMain')}</h3>
      <fieldset className="warehouse-field">
        <legend className="settings-field__label">{t('navNomenclature')}</legend>
        <div className="nomenclature-type">
          <label className="nomenclature-type__option">
            <input
              type="radio"
              name="itemType"
              checked={itemType === 'product'}
              onChange={() => setItemType('product')}
            />
            {t('itemTypeProduct')}
          </label>
          <label className="nomenclature-type__option">
            <input
              type="radio"
              name="itemType"
              checked={itemType === 'service'}
              onChange={() => setItemType('service')}
            />
            {t('itemTypeService')}
          </label>
        </div>
        <p className="nomenclature-hint">
          {isProduct
            ? t('productRequiresWarehouse')
            : t('serviceDoesNotRequireWarehouse')}
        </p>
      </fieldset>

      <label className="warehouse-field">
        <span className="settings-field__label">{t('name')}</span>
        <input
          className="warehouse-input"
          type="text"
          name="name"
          value={name}
          onChange={(event) => {
            setName(event.target.value)
            if (nameError) {
              setNameError(false)
            }
          }}
          aria-invalid={nameError ? true : undefined}
        />
        {nameError ? (
          <span className="warehouse-field__error">{t('nameRequired')}</span>
        ) : null}
      </label>

      <label className="warehouse-field">
        <span className="settings-field__label">{t('sku')}</span>
        <input
          className="warehouse-input"
          type="text"
          name="sku"
          value={sku}
          onChange={(event) => {
            setSku(event.target.value)
            if (skuError) {
              setSkuError(false)
            }
          }}
          aria-invalid={skuError ? true : undefined}
        />
        {skuError ? (
          <span className="warehouse-field__error">{t('skuRequired')}</span>
        ) : null}
      </label>

      <h3 className="product-form__group">{t('productFormPricing')}</h3>
      <label className="warehouse-field">
        <span className="settings-field__label">{t('basePrice')}</span>
        <input
          className="warehouse-input"
          type="number"
          min="0"
          step="any"
          name="basePrice"
          value={basePrice}
          onChange={(event) => {
            setBasePrice(event.target.value)
            if (priceError) {
              setPriceError(false)
            }
          }}
          aria-invalid={priceError ? true : undefined}
        />
      </label>

      {isProduct ? (
        <label className="warehouse-field">
          <span className="settings-field__label">{t('costPrice')}</span>
          <input
            className="warehouse-input"
            type="number"
            min="0"
            step="any"
            name="costPrice"
            value={costPrice}
            onChange={(event) => {
              setCostPrice(event.target.value)
              if (priceError) {
                setPriceError(false)
              }
            }}
            aria-invalid={priceError ? true : undefined}
          />
        </label>
      ) : null}

      {priceError ? (
        <span className="warehouse-field__error">{t('INVALID_INPUT')}</span>
      ) : null}

      <label className="warehouse-field">
        <span className="settings-field__label">{t('unit')}</span>
        <input
          className="warehouse-input"
          type="text"
          name="unit"
          value={unit}
          onChange={(event) => {
            setUnit(event.target.value)
            if (unitError) {
              setUnitError(false)
            }
          }}
          aria-invalid={unitError ? true : undefined}
        />
        {unitError ? (
          <span className="warehouse-field__error">{t('unitRequired')}</span>
        ) : null}
      </label>

      <label className="warehouse-field">
        <span className="settings-field__label">{t('productCategory')}</span>
        <select
          className="warehouse-input"
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
        >
          <option value="">{t('dealPartyNone')}</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>

      <ProductImageField imageUrl={imageUrl} onChange={setImageUrl} />

      {showOpeningStock ? (
        <>
          <h3 className="product-form__group">{t('productFormStock')}</h3>
          <label className="warehouse-field">
            <span className="settings-field__label">{t('initialQuantity')}</span>
            <input
              className="warehouse-input"
              type="number"
              min="0"
              step="any"
              name="initialQuantity"
              value={initialQuantity}
              onChange={(event) => {
                setInitialQuantity(event.target.value)
                if (quantityError) {
                  setQuantityError(false)
                }
              }}
              aria-invalid={quantityError ? true : undefined}
            />
            {quantityError ? (
              <span className="warehouse-field__error">
                {t('quantityNotNegative')}
              </span>
            ) : null}
          </label>
          <label className="warehouse-field">
            <span className="settings-field__label">{t('inventoryWarehouse')}</span>
            <select
              className="warehouse-input"
              name="warehouseId"
              value={warehouseId}
              onChange={(event) => {
                setWarehouseId(event.target.value)
                if (warehouseError) {
                  setWarehouseError(false)
                }
              }}
              aria-invalid={warehouseError ? true : undefined}
            >
              <option value="">{t('selectWarehouse')}</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>
            {warehouseError ? (
              <span className="warehouse-field__error">
                {t('selectWarehouse')}
              </span>
            ) : null}
          </label>
        </>
      ) : null}

      {isProduct && !warehousesEnabled ? (
        <p className="nomenclature-hint">{t('productUnavailableWithoutWarehouse')}</p>
      ) : null}

      <label className="warehouse-field">
        <span className="settings-field__label">{t('description')}</span>
        <textarea
          className="warehouse-input warehouse-input--area"
          name="description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
        />
      </label>

      <label className="warehouse-field">
        <span className="settings-field__label">{t('status')}</span>
        <select
          className="warehouse-input"
          name="status"
          value={status}
          onChange={(event) =>
            setStatus(event.target.value === 'inactive' ? 'inactive' : 'active')
          }
        >
          <option value="active">{t('active')}</option>
          <option value="inactive">{t('inactive')}</option>
        </select>
      </label>

      {submitError ? (
        <p className="warehouse-field__error">{t('INVALID_INPUT')}</p>
      ) : null}

      <div className="warehouse-form__actions">
        <Button type="button" onClick={onCancel}>
          {t('cancel')}
        </Button>
        <Button type="submit" variant="primary">
          {mode === 'create' ? t('create') : t('save')}
        </Button>
      </div>
    </form>
  )
}
