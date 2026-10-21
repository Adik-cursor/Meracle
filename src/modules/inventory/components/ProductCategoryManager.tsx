import { useMemo, useState, type FormEvent } from 'react'
import {
  createProductCategoryForUser,
  listProductCategoriesForUser,
} from '../../../core/services'
import { useAccess } from '../../../app/context/access-context'
import { useLocalization } from '../../../app/context/localization-context'
import { usePersistence, usePersistenceVersion } from '../../../app/context/persistence-context'
import { Button, useToast } from '../../../shared/ui'

export function ProductCategoryManager() {
  const { t } = useLocalization()
  const { showToast } = useToast()
  const { currentUser, hasWarehouseAccess } = useAccess()
  const persistence = usePersistence()
  const version = usePersistenceVersion()
  const [categoryName, setCategoryName] = useState('')
  const canManageCatalog = hasWarehouseAccess('products.manage')
  const categories = useMemo(() => {
    void version
    const listed = listProductCategoriesForUser(persistence, currentUser)
    return listed.ok ? listed.value : []
  }, [currentUser, persistence, version])

  const handleCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const created = createProductCategoryForUser(persistence, currentUser, {
      name: categoryName,
      status: 'active',
    })
    if (created.ok) {
      setCategoryName('')
      showToast(t('savedToast'))
    }
  }

  return (
    <div className="product-category-manager">
      {categories.length === 0 ? (
        <p className="workspace-muted">{t('productCategoriesEmpty')}</p>
      ) : (
        <ul className="employee-activity-list">
          {categories.map((category) => (
            <li key={category.id}>
              {category.name} ·{' '}
              {category.status === 'active' ? t('active') : t('inactive')}
            </li>
          ))}
        </ul>
      )}
      {canManageCatalog ? (
        <form className="warehouse-card__actions" onSubmit={handleCreate}>
          <input
            className="warehouse-input"
            value={categoryName}
            onChange={(event) => setCategoryName(event.target.value)}
            placeholder={t('productCategory')}
          />
          <Button type="submit" variant="primary">
            {t('addProductCategory')}
          </Button>
        </form>
      ) : null}
    </div>
  )
}
