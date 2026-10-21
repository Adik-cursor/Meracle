import type { RefObject } from 'react'
import { useLocalization } from '../../../app/context/localization-context'
import { ProductImageThumb } from '../../inventory/components/ProductImageThumb'
import { Button } from '../../../shared/ui'
import { formatMoney } from '../pos-format'
import type { Locale, Product } from '../../../core/types'
import { isPhysicalProduct } from '../../../core/types/product'

type PosCatalogProps = {
  products: Product[]
  totalCount: number
  locale: Locale
  currency: string
  catalogEmpty: boolean
  warehousesEnabled: boolean
  search: string
  searchRef: RefObject<HTMLInputElement | null>
  getAvailable: (productId: string) => number
  getHasInventory: (productId: string) => boolean
  getPrice: (productId: string) => number
  onSearchChange: (value: string) => void
  onSearchEnter: () => void
  onAdd: (product: Product) => void
}

export function PosCatalog({
  products,
  totalCount,
  locale,
  currency,
  catalogEmpty,
  warehousesEnabled,
  search,
  searchRef,
  getAvailable,
  getHasInventory,
  getPrice,
  onSearchChange,
  onSearchEnter,
  onAdd,
}: PosCatalogProps) {
  const { t } = useLocalization()

  return (
    <section className="pos-catalog">
      <div className="pos-pane__heading">
        <h2 className="pos-pane__title">{t('navNomenclature')}</h2>
        <span className="pos-pane__count">{products.length}/{totalCount}</span>
      </div>
      <label className="pos-search">
        <input
          ref={searchRef}
          className="pos-search__input"
          type="search"
          name="productSearch"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault()
              onSearchChange('')
              return
            }
            if (event.key === 'Enter') {
              event.preventDefault()
              onSearchEnter()
            }
          }}
          placeholder={t('posSearchProduct')}
          autoComplete="off"
        />
      </label>
      {catalogEmpty ? (
        <p className="pos-catalog__empty">{t('posNoProductsYet')}</p>
      ) : products.length === 0 ? (
        <p className="pos-catalog__empty">{t('posNoProducts')}</p>
      ) : (
        <div className="pos-catalog__grid">
          {products.map((product) => {
            const physical = isPhysicalProduct(product)
            const available = getAvailable(product.id)
            const hasInventory = physical ? getHasInventory(product.id) : true
            const price = getPrice(product.id)
            const blockedProduct = physical && !warehousesEnabled
            const missingStock = physical && warehousesEnabled && !hasInventory
            const canAdd = physical
              ? !blockedProduct && hasInventory && available > 0
              : true

            return (
              <article key={product.id} className="pos-card">
                <ProductImageThumb imageUrl={product.imageUrl} name={product.name} size="sm" />
                <div className="pos-card__details">
                  <h3 className="pos-card__name">{product.name}</h3>
                  <p className="pos-card__sku">{product.sku}</p>
                  <p className="pos-card__price">
                    {price > 0 ? formatMoney(price, locale, currency) : '—'}
                  </p>
                  <p className="pos-card__stock">
                    {physical
                      ? blockedProduct
                        ? t('productUnavailableWithoutWarehouse')
                        : missingStock
                          ? t('stockNotSet')
                          : `${t('posStock')}: ${available}`
                      : t('serviceHasNoStock')}
                  </p>
                </div>
                {canAdd ? (
                  <Button
                    variant="primary"
                    className="pos-card__add"
                    onClick={() => onAdd(product)}
                  >
                    {t('posAdd')}
                  </Button>
                ) : (
                  <span className="pos-card__unavailable">
                    {blockedProduct
                      ? t('productUnavailableWithoutWarehouse')
                      : missingStock
                        ? t('stockNotSet')
                        : t('posOutOfStock')}
                  </span>
                )}
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
