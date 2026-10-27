import { useMemo, useState, type FormEvent } from 'react'
import {
  completeWriteoffForUser,
  createWriteoffForUser,
  listProductCategoriesForUser,
} from '../../../core/services'
import { useAccess } from '../../context/access-context'
import { useInventory } from '../../context/inventory-context'
import { useProducts } from '../../context/product-context'
import { useLocalization } from '../../context/localization-context'
import { useOrganization } from '../../context/organization-context'
import { usePersistence, usePersistenceVersion } from '../../context/persistence-context'
import { useWarehouses } from '../../context/warehouse-context'
import { ProductForm } from '../../../modules/inventory/components/ProductForm'
import { ProductList } from '../../../modules/inventory/components/ProductList'
import type { Product, ProductItemType } from '../../../core/types'
import type { ProductDraft } from '../../../modules/inventory/product.types'
import {
  ActionRow,
  Button,
  EmptyState,
  FilterBar,
  KpiStrip,
  Input,
  Modal,
  PageHeader,
  SectionTabs,
  Select,
  useToast,
} from '../../../shared/ui'
import { ExcelExportButton } from '../../../shared/components/ExcelExportButton'
import { ProductCategoryManager } from '../../../modules/inventory/components/ProductCategoryManager'

type ItemFilter = 'all' | ProductItemType

export function ProductsPage() {
  const { t } = useLocalization()
  const { showToast } = useToast()
  const { modules, organization } = useOrganization()
  const { currentUser, hasWarehouseAccess } = useAccess()
  const persistence = usePersistence()
  const version = usePersistenceVersion()
  const { products, createProduct, updateProduct, setProductStatus } =
    useProducts()
  const { warehouses } = useWarehouses()
  const { inventory } = useInventory()
  const [formMode, setFormMode] = useState<'closed' | 'create' | 'edit'>(
    'closed',
  )
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [query, setQuery] = useState('')
  const [warehouseId, setWarehouseId] = useState('')
  const [itemFilter, setItemFilter] = useState<ItemFilter>('all')
  const [categoriesOpen, setCategoriesOpen] = useState(false)
  const [writeoffProduct, setWriteoffProduct] = useState<Product | null>(null)
  const [writeoffWarehouseId, setWriteoffWarehouseId] = useState('')
  const [writeoffQuantity, setWriteoffQuantity] = useState('1')
  const [writeoffNote, setWriteoffNote] = useState('')
  const [writeoffError, setWriteoffError] = useState<
    | 'quantityMustBeNumber'
    | 'quantityNotNegative'
    | 'quantityMustBePositive'
    | 'writeoffInsufficientStock'
    | 'INVALID_INPUT'
    | null
  >(null)
  const warehousesEnabled = modules.warehouses === true
  const canManageCatalog = hasWarehouseAccess('products.manage')
  const canWriteoff =
    warehousesEnabled &&
    warehouses.length > 0 &&
    hasWarehouseAccess('writeoff.create') &&
    hasWarehouseAccess('writeoff.complete')
  const categories = useMemo(() => {
    void version
    const listed = listProductCategoriesForUser(persistence, currentUser)
    return listed.ok ? listed.value : []
  }, [currentUser, persistence, version])

  const closeForm = () => {
    setFormMode('closed')
    setEditingProduct(null)
  }

  const handleCreate = (draft: ProductDraft) => {
    const created = createProduct(draft)
    if (!created) {
      return false
    }

    showToast(t('savedToast'))
    closeForm()
    return true
  }

  const selectedProduct =
    formMode === 'edit' && editingProduct
      ? products.find((product) => product.id === editingProduct.id)
      : undefined

  const handleUpdate = (draft: ProductDraft) => {
    if (!selectedProduct) {
      return false
    }

    const updated = updateProduct(selectedProduct.id, {
      ...draft,
      warehouseId: undefined,
      initialQuantity: undefined,
    })
    if (!updated) {
      return false
    }

    showToast(t('savedToast'))
    closeForm()
    return true
  }

  const handleWriteoff = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!writeoffProduct) {
      return
    }

    const quantity = Number(writeoffQuantity)
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setWriteoffError('quantityMustBePositive')
      return
    }

    const available = inventory.find(
      (item) =>
        item.productId === writeoffProduct.id &&
        item.warehouseId === writeoffWarehouseId,
    )?.quantity ?? 0
    if (!writeoffWarehouseId || quantity > available) {
      setWriteoffError('writeoffInsufficientStock')
      return
    }

    const created = createWriteoffForUser(
      persistence,
      currentUser,
      organization.id,
      {
        warehouseId: writeoffWarehouseId,
        reason: t('stockWriteoff'),
        note: writeoffNote.trim() || undefined,
        items: [{ productId: writeoffProduct.id, quantity }],
      },
    )
    if (!created.ok) {
      setWriteoffError('INVALID_INPUT')
      return
    }

    const completed = completeWriteoffForUser(
      persistence,
      currentUser,
      organization.id,
      created.value.id,
    )
    if (!completed.ok) {
      setWriteoffError('INVALID_INPUT')
      return
    }

    setWriteoffProduct(null)
    setWriteoffError(null)
    setWriteoffQuantity('1')
    setWriteoffNote('')
    showToast(t('savedToast'))
  }

  const openWriteoff = (product: Product) => {
    const stockedWarehouse = inventory.find(
      (item) =>
        item.productId === product.id &&
        item.quantity > 0 &&
        warehouses.some((warehouse) => warehouse.id === item.warehouseId),
    )?.warehouseId
    setWriteoffProduct(product)
    setWriteoffWarehouseId(stockedWarehouse ?? '')
    setWriteoffQuantity('1')
    setWriteoffNote('')
    setWriteoffError(null)
  }

  const stockByProductId = useMemo(() => {
    const totals: Record<string, number> = {}
    const present = new Set<string>()
    inventory.forEach((item) => {
      if (warehouseId && item.warehouseId !== warehouseId) {
        return
      }
      present.add(item.productId)
      totals[item.productId] = (totals[item.productId] ?? 0) + item.quantity
    })
    return { totals, present }
  }, [inventory, warehouseId])

  const visibleProducts = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return products.filter((product) => {
      if (itemFilter !== 'all' && product.itemType !== itemFilter) {
        return false
      }
      if (!needle) {
        return true
      }
      return (
        product.name.toLowerCase().includes(needle) ||
        product.sku.toLowerCase().includes(needle)
      )
    })
  }, [itemFilter, products, query])

  return (
    <section className="workspace-page products-page">
      <PageHeader
        title={t('navNomenclature')}
        actions={
          <ActionRow>
            <ExcelExportButton dataset="products" />
            <Button type="button" onClick={() => setCategoriesOpen(true)}>
              {t('productCategories')}
            </Button>
            {formMode === 'closed' && canManageCatalog ? (
              <Button variant="primary" onClick={() => setFormMode('create')}>
                {t('addProductShort')}
              </Button>
            ) : null}
          </ActionRow>
        }
      />
      {products.length > 0 ? (
        <KpiStrip
          variant="inline"
          items={[
            {
              id: 'positions',
              label: t('navNomenclature'),
              value: String(products.length),
            },
            {
              id: 'goods',
              label: t('navProducts'),
              value: String(products.filter((item) => item.itemType !== 'service').length),
            },
            {
              id: 'services',
              label: t('nomenclatureServices'),
              value: String(products.filter((item) => item.itemType === 'service').length),
            },
          ]}
        />
      ) : null}
      <FilterBar
        search={
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label={t('searchProduct')}
            placeholder={t('searchPlaceholder')}
          />
        }
        filters={
          <>
            <SectionTabs
              label={t('navNomenclature')}
              activeId={itemFilter}
              onSelect={(id) => setItemFilter(id as ItemFilter)}
              tabs={[
                { id: 'all', label: t('nomenclatureAll') },
                { id: 'product', label: t('navProducts') },
                { id: 'service', label: t('nomenclatureServices') },
              ]}
            />
            {warehousesEnabled ? (
              <Select
                value={warehouseId}
                onChange={(event) => setWarehouseId(event.target.value)}
                aria-label={t('inventoryWarehouse')}
              >
                <option value="">{t('analyticsAllWarehouses')}</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </option>
                ))}
              </Select>
            ) : null}
          </>
        }
      />

      {formMode === 'create' ? (
        <ProductForm
          mode="create"
          warehousesEnabled={warehousesEnabled}
          warehouses={warehouses}
          categories={categories.filter((item) => item.status === 'active')}
          onSubmit={handleCreate}
          onCancel={closeForm}
        />
      ) : null}

      {formMode === 'edit' && selectedProduct ? (
        <ProductForm
          key={`${selectedProduct.id}-${selectedProduct.updatedAt}`}
          mode="edit"
          product={selectedProduct}
          stockLabel={
            selectedProduct.itemType === 'service' ||
            !stockByProductId.present.has(selectedProduct.id)
              ? undefined
              : String(stockByProductId.totals[selectedProduct.id] ?? 0)
          }
          warehousesEnabled={warehousesEnabled}
          warehouses={warehouses}
          categories={categories.filter((item) => item.status === 'active')}
          onSubmit={handleUpdate}
          onCancel={closeForm}
        />
      ) : null}

      {products.length === 0 && formMode === 'closed' ? (
        <EmptyState title={t('noProducts')} />
      ) : null}

      {products.length > 0 && visibleProducts.length === 0 ? (
        <EmptyState
          title={t('noProducts')}
          description={t('tryChangeFilter')}
        />
      ) : null}

      {categoriesOpen ? (
        <Modal title={t('productCategories')} onClose={() => setCategoriesOpen(false)}>
          <ProductCategoryManager />
        </Modal>
      ) : null}

      {writeoffProduct ? (
        <Modal
          title={`${t('stockWriteoff')}: ${writeoffProduct.name}`}
          onClose={() => setWriteoffProduct(null)}
        >
          <form className="finance-form" onSubmit={handleWriteoff}>
            <label>
              <span className="settings-field__label">{t('inventoryWarehouse')}</span>
              <Select
                value={writeoffWarehouseId}
                onChange={(event) => setWriteoffWarehouseId(event.target.value)}
                required
              >
                <option value="">{t('selectWarehouse')}</option>
                {warehouses
                  .filter((warehouse) =>
                    inventory.some(
                      (item) =>
                        item.productId === writeoffProduct.id &&
                        item.warehouseId === warehouse.id &&
                        item.quantity > 0,
                    ),
                  )
                  .map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name} · {t('inventoryQuantity')}{' '}
                      {inventory.find(
                        (item) =>
                          item.productId === writeoffProduct.id &&
                          item.warehouseId === warehouse.id,
                      )?.quantity ?? 0}
                    </option>
                  ))}
              </Select>
            </label>
            <label>
              <span className="settings-field__label">{t('inventoryQuantity')}</span>
              <Input
                type="number"
                min="0"
                step="any"
                max={inventory.find(
                  (item) =>
                    item.productId === writeoffProduct.id &&
                    item.warehouseId === writeoffWarehouseId,
                )?.quantity ?? 0}
                value={writeoffQuantity}
                onChange={(event) => setWriteoffQuantity(event.target.value)}
                required
              />
            </label>
            <label>
              <span className="settings-field__label">{t('writeoffNote')}</span>
              <Input
                value={writeoffNote}
                onChange={(event) => setWriteoffNote(event.target.value)}
              />
            </label>
            {writeoffError ? (
              <p className="field__error">{t(writeoffError)}</p>
            ) : null}
            <div className="finance-form__actions">
              <Button type="button" onClick={() => setWriteoffProduct(null)}>
                {t('cancel')}
              </Button>
              <Button type="submit" variant="primary">
                {t('confirmStockWriteoff')}
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}

      {visibleProducts.length > 0 ? (
        <ProductList
          products={visibleProducts}
          stockByProductId={stockByProductId.totals}
          stockPresentIds={stockByProductId.present}
          canManage={canManageCatalog}
          canWriteoff={canWriteoff}
          showCost={canManageCatalog}
          onEdit={
            canManageCatalog
              ? (product) => {
                  setEditingProduct(product)
                  setFormMode('edit')
                }
              : undefined
          }
          onSetStatus={
            canManageCatalog
              ? (product) =>
                  setProductStatus(
                    product.id,
                    product.status === 'active' ? 'inactive' : 'active',
                  )
              : undefined
          }
          onWriteoff={canWriteoff ? openWriteoff : undefined}
        />
      ) : null}
    </section>
  )
}
