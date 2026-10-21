import type { ProductCategory } from '../../../core/types'
import { useLocalization } from '../../../app/context/localization-context'
import type { PosCategoryFilter } from '../pos-catalog-filter'

type PosCategoriesProps = {
  categories: ProductCategory[]
  selected: PosCategoryFilter
  onSelect: (value: PosCategoryFilter) => void
}

export function PosCategories({
  categories,
  selected,
  onSelect,
}: PosCategoriesProps) {
  const { t } = useLocalization()
  const items: { id: PosCategoryFilter; name: string }[] = [
    { id: 'all', name: t('nomenclatureAll') },
    ...categories.map((category) => ({ id: category.id, name: category.name })),
    { id: 'uncategorized', name: t('posUncategorized') },
  ]

  return (
    <nav className="pos-categories" aria-label={t('navNomenclature')}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={
            selected === item.id ? 'pos-category pos-category--active' : 'pos-category'
          }
          onClick={() => onSelect(item.id)}
        >
          {item.name}
        </button>
      ))}
    </nav>
  )
}
