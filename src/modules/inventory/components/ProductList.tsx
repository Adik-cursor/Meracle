import { useMemo, useState } from 'react'
import type { Product } from '../../../core/types'
import { useLocalization } from '../../../app/context/localization-context'
import { useOrganization } from '../../../app/context/organization-context'
import { Badge, Button, RowMenu, Table } from '../../../shared/ui'
import { ProductImageThumb } from './ProductImageThumb'

type SortKey = 'name' | 'sku' | 'stock'

type ProductListProps = {
  products: Product[]
  stockByProductId: Record<string, number>
  stockPresentIds: Set<string>
  canManage?: boolean
  showCost?: boolean
  onEdit?: (product: Product) => void
  onSetStatus?: (product: Product) => void
}

const PAGE_SIZE = 20

export function ProductList({
  products,
  stockByProductId,
  stockPresentIds,
  canManage = false,
  showCost = false,
  onEdit,
  onSetStatus,
}: ProductListProps) {
  const { t, locale } = useLocalization()
  const { settings } = useOrganization()
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)

  const sorted = useMemo(() => {
    const next = [...products]
    next.sort((left, right) => {
      const leftValue =
        sortKey === 'stock'
          ? stockByProductId[left.id] ?? 0
          : left[sortKey].toLowerCase()
      const rightValue =
        sortKey === 'stock'
          ? stockByProductId[right.id] ?? 0
          : right[sortKey].toLowerCase()
      if (leftValue < rightValue) {
        return sortDir === 'asc' ? -1 : 1
      }
      if (leftValue > rightValue) {
        return sortDir === 'asc' ? 1 : -1
      }
      return 0
    })
    return next
  }, [products, sortDir, sortKey, stockByProductId])

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const visible = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const allVisibleSelected =
    visible.length > 0 && visible.every((product) => selected[product.id])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(key)
    setSortDir('asc')
  }

  const money = (value: number) =>
    `${value.toLocaleString(locale === 'kk' ? 'kk-KZ' : 'ru-RU')} ${settings.currency}`

  return (
    <>
      <Table className="entity-table">
        <thead>
          <tr>
            <th>
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={() => {
                  const next = { ...selected }
                  visible.forEach((product) => {
                    next[product.id] = !allVisibleSelected
                  })
                  setSelected(next)
                }}
                aria-label={t('name')}
              />
            </th>
            <th>
              <button type="button" className="table-sort" onClick={() => toggleSort('name')}>
                {t('name')}
              </button>
            </th>
            <th className="is-num">{t('basePrice')}</th>
            <th className="is-num">
              <button type="button" className="table-sort" onClick={() => toggleSort('stock')}>
                {t('inventoryQuantity')}
              </button>
            </th>
            <th>{t('status')}</th>
            {canManage ? <th>{t('transferActions')}</th> : null}
          </tr>
        </thead>
        <tbody>
          {visible.map((product) => {
            const isActive = product.status === 'active'
            const stock = stockByProductId[product.id] ?? 0
            const typeLabel =
              product.itemType === 'service' ? t('itemTypeService') : t('itemTypeProduct')

            return (
              <tr key={product.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={Boolean(selected[product.id])}
                    onChange={() =>
                      setSelected((current) => ({
                        ...current,
                        [product.id]: !current[product.id],
                      }))
                    }
                    aria-label={product.name}
                  />
                </td>
                <td>
                  <div className="entity-cell entity-cell--identity">
                    <ProductImageThumb
                      imageUrl={product.imageUrl}
                      name={product.name}
                      size="identity"
                    />
                    <span>
                      <span className="entity-cell__title">{product.name}</span>
                      <span className="entity-cell__meta">
                        {typeLabel} · {t('sku')} {product.sku}
                      </span>
                    </span>
                  </div>
                </td>
                <td className="is-num">
                  <div className="entity-metric">
                    <span className="entity-metric__value">{money(product.basePrice)}</span>
                    {showCost ? (
                      <span className="entity-metric__meta">
                        {product.itemType === 'service'
                          ? '—'
                          : `${t('costPrice')} ${money(product.costPrice)}`}
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className="is-num">
                  <span className="entity-metric__value">
                    {product.itemType === 'service'
                      ? t('stockWithoutWarehouse')
                      : stockPresentIds.has(product.id)
                        ? stock
                        : t('stockNotSet')}
                  </span>
                </td>
                <td>
                  <Badge tone={isActive ? 'success' : 'neutral'}>
                    {isActive ? t('active') : t('inactive')}
                  </Badge>
                </td>
                {canManage ? (
                  <td>
                    <div className="action-row">
                      {onEdit ? (
                        <Button onClick={() => onEdit(product)}>{t('edit')}</Button>
                      ) : null}
                      {onSetStatus ? (
                        <RowMenu
                          label={t('moreActions')}
                          items={[
                            {
                              id: 'status',
                              label: isActive ? t('turnOff') : t('turnOn'),
                              danger: isActive,
                              onSelect: () => onSetStatus(product),
                            },
                          ]}
                        />
                      ) : null}
                    </div>
                  </td>
                ) : null}
              </tr>
            )
          })}
        </tbody>
      </Table>
      {pageCount > 1 ? (
        <div className="table-pager">
          <Button disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>
            {t('prevPage')}
          </Button>
          <span>
            {t('tablePage')} {currentPage} / {pageCount}
          </span>
          <Button
            disabled={currentPage >= pageCount}
            onClick={() => setPage(currentPage + 1)}
          >
            {t('nextPage')}
          </Button>
        </div>
      ) : null}
    </>
  )
}
