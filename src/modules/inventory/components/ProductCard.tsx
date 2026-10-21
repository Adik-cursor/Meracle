import { ProductImageThumb } from './ProductImageThumb'
import { useLocalization } from '../../../app/context/localization-context'
import type { Product } from '../../../core/types'

type ProductCardProps = {
  product: Product
  onEdit: (product: Product) => void
  onSetStatus: (product: Product) => void
}

export function ProductCard({ product, onEdit, onSetStatus }: ProductCardProps) {
  const { t } = useLocalization()
  const isActive = product.status === 'active'

  return (
    <article className="warehouse-card">
      <ProductImageThumb imageUrl={product.imageUrl} name={product.name} size="md" />
      <div className="module-row__info">
        <p className="module-row__title">{product.name}</p>
        <p className="module-row__description">
          {t('sku')}: {product.sku}
        </p>
        <p className="module-row__description">
          {t('unit')}: {product.unit}
        </p>
        {product.description ? (
          <p className="module-row__description">{product.description}</p>
        ) : null}
        <p className="warehouse-card__status">
          {isActive ? t('active') : t('inactive')}
        </p>
      </div>
      <div className="warehouse-card__actions">
        <button
          type="button"
          className="module-switch"
          onClick={() => onEdit(product)}
        >
          {t('edit')}
        </button>
        <button
          type="button"
          className={isActive ? 'module-switch' : 'module-switch module-switch--on'}
          onClick={() => onSetStatus(product)}
        >
          {isActive ? t('turnOff') : t('turnOn')}
        </button>
      </div>
    </article>
  )
}
