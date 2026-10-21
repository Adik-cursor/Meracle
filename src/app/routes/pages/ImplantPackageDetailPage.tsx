import { useMemo, useState } from 'react'
import { useAccess } from '../../context/access-context'
import { useLocalization } from '../../context/localization-context'
import { usePersistence, usePersistenceVersion } from '../../context/persistence-context'
import { useProducts } from '../../context/product-context'
import { useWarehouses } from '../../context/warehouse-context'
import { AuthRequiredState } from '../../components/AuthRequiredState'
import { PagePlaceholder } from '../../../shared/components/PagePlaceholder'
import { Badge, Button, Input, Select } from '../../../shared/ui'
import { ExcelExportButton } from '../../../shared/components/ExcelExportButton'
import {
  createPackageContractForUser,
  createSaleInvoiceForUser,
  exportExcelDatasetForUser,
  generatePackageContractDocumentForUser,
  getImplantPackageForUser,
  listImplantPackageMovementsForUser,
  listSaleInvoicesForUser,
  recordImplantPackageMovementForUser,
} from '../../../core/services'
import { downloadExcelFile } from '../../../core/utils/excel-workbook'
import { getPackageIdFromPath } from '../app.routes'
import { useAppPath } from '../useAppPath'
import { useSales } from '../../context/sales-context'

export function ImplantPackageDetailPage() {
  const { t } = useLocalization()
  const { pathname, navigate } = useAppPath()
  const { currentUser } = useAccess()
  const persistence = usePersistence()
  const version = usePersistenceVersion()
  const { products } = useProducts()
  const { warehouses } = useWarehouses()
  const { sales } = useSales()
  const packageId = getPackageIdFromPath(pathname)
  const [productId, setProductId] = useState('')
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? '')
  const [quantity, setQuantity] = useState('1')
  const [movementType, setMovementType] = useState<'issued' | 'used' | 'returned'>('issued')
  const [error, setError] = useState<string | null>(null)

  const row = useMemo(() => {
    void version
    if (!packageId) {
      return null
    }
    const loaded = getImplantPackageForUser(persistence, currentUser, packageId)
    return loaded.ok ? loaded.value : null
  }, [currentUser, packageId, persistence, version])

  const history = useMemo(() => {
    void version
    if (!packageId) {
      return []
    }
    const listed = listImplantPackageMovementsForUser(persistence, currentUser, packageId)
    return listed.ok ? listed.value : []
  }, [currentUser, packageId, persistence, version])

  const invoices = useMemo(() => {
    void version
    const listed = listSaleInvoicesForUser(persistence, currentUser)
    if (!listed.ok || !packageId) {
      return []
    }
    return listed.value.filter((invoice) => {
      const sale = persistence.sales.getById(invoice.saleId)
      return sale?.packageId === packageId
    })
  }, [currentUser, packageId, persistence, version])

  if (!currentUser) {
    return <AuthRequiredState />
  }
  if (!packageId || !row) {
    return <PagePlaceholder title={t('PACKAGE_NOT_FOUND')} description={t('PACKAGE_NOT_FOUND')} />
  }

  return (
    <section className="workspace-page">
      <div className="workspace-toolbar">
        <h2 className="workspace-toolbar__title">{row.pkg.name}</h2>
        <Button onClick={() => navigate('/packages')}>{t('packagesAll')}</Button>
        <ExcelExportButton dataset="implant_packages" />
        <Button
          onClick={() => {
            const exported = exportExcelDatasetForUser(
              persistence,
              currentUser,
              'implant_movements',
            )
            if (exported.ok) {
              downloadExcelFile(exported.value.filename, exported.value.bytes)
            }
          }}
        >
          {t('exportImplantHistory')}
        </Button>
      </div>
      <dl className="org-profile__grid">
        <div className="org-profile__item">
          <dt>{t('customer')}</dt>
          <dd>{row.customerName}</dd>
        </div>
        <div className="org-profile__item">
          <dt>{t('price')}</dt>
          <dd>
            {row.pkg.price} {row.pkg.currency}
          </dd>
        </div>
        <div className="org-profile__item">
          <dt>{t('totalImplants')}</dt>
          <dd>{row.balance.total}</dd>
        </div>
        <div className="org-profile__item">
          <dt>{t('issued')}</dt>
          <dd>{row.balance.issued}</dd>
        </div>
        <div className="org-profile__item">
          <dt>{t('used')}</dt>
          <dd>{row.balance.used}</dd>
        </div>
        <div className="org-profile__item">
          <dt>{t('returned')}</dt>
          <dd>{row.balance.returned}</dd>
        </div>
        <div className="org-profile__item">
          <dt>{t('remaining')}</dt>
          <dd>{row.balance.remaining}</dd>
        </div>
        <div className="org-profile__item">
          <dt>{t('paid')}</dt>
          <dd>{row.balance.paid}</dd>
        </div>
        <div className="org-profile__item">
          <dt>{t('debt')}</dt>
          <dd>{row.balance.debt}</dd>
        </div>
        <div className="org-profile__item">
          <dt>{t('contract')}</dt>
          <dd>{row.contractNumber || t('contractTemplatePlaceholder')}</dd>
        </div>
        <div className="org-profile__item">
          <dt>{t('responsible')}</dt>
          <dd>{row.responsibleName || '—'}</dd>
        </div>
        <div className="org-profile__item">
          <dt>{t('status')}</dt>
          <dd>
            <Badge
              tone={
                row.pkg.status === 'active'
                  ? 'success'
                  : row.pkg.status === 'cancelled'
                    ? 'danger'
                    : row.pkg.status === 'completed'
                      ? 'info'
                      : 'neutral'
              }
            >
              {t(
                row.pkg.status === 'active'
                  ? 'active'
                  : row.pkg.status === 'completed'
                    ? 'transferStatusCompleted'
                    : row.pkg.status === 'cancelled'
                      ? 'transferStatusCancelled'
                      : 'transferStatusDraft',
              )}
            </Badge>
          </dd>
        </div>
      </dl>

      <div className="settings-section">
        <h3>{t('issueImplants')}</h3>
        {error ? <p className="warehouse-field__error">{t(error as never)}</p> : null}
        <form
          className="warehouse-form"
          onSubmit={(event) => {
            event.preventDefault()
            const recorded = recordImplantPackageMovementForUser(persistence, currentUser, {
              packageId,
              productId,
              warehouseId,
              movementType,
              quantity: Number(quantity),
            })
            setError(recorded.ok ? null : recorded.error.code)
          }}
        >
          <Select value={productId} onChange={(event) => setProductId(event.target.value)}>
            <option value="">{t('selectProduct')}</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </Select>
          <Select value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)}>
            {warehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.name}
              </option>
            ))}
          </Select>
          <Select
            value={movementType}
            onChange={(event) =>
              setMovementType(event.target.value as 'issued' | 'used' | 'returned')
            }
          >
            <option value="issued">{t('issued')}</option>
            <option value="used">{t('used')}</option>
            <option value="returned">{t('returned')}</option>
          </Select>
          <Input value={quantity} onChange={(event) => setQuantity(event.target.value)} />
          <Button variant="primary" type="submit">
            {t('save')}
          </Button>
        </form>
      </div>

      <div className="settings-section">
        <h3>{t('invoices')}</h3>
        {sales
          .filter((record) => record.sale.packageId === packageId || record.sale.customerId === row.pkg.customerId)
          .slice(0, 8)
          .map((record) => (
            <Button
              key={record.sale.id}
              onClick={() => {
                createSaleInvoiceForUser(persistence, currentUser, { saleId: record.sale.id })
                navigate(`/sales/${record.sale.id}`)
              }}
            >
              {t('createInvoice')} {record.sale.id.slice(-4)}
            </Button>
          ))}
        {invoices.map((invoice) => (
          <p key={invoice.id}>
            {t('invoice')} №{invoice.invoiceNumber} {invoice.total} {invoice.status}
          </p>
        ))}
      </div>

      <div className="settings-section">
        <h3>{t('contract')}</h3>
        <p>{t('contractTemplatePlaceholder')}</p>
        {!row.pkg.contractId ? (
          <Button
            onClick={() => {
              createPackageContractForUser(persistence, currentUser, {
                packageId,
                contractNumber: row.pkg.id.slice(-6).toUpperCase(),
                contractDate: new Date().toISOString().slice(0, 10),
              })
            }}
          >
            {t('createContractPlaceholder')}
          </Button>
        ) : (
          <Button
            onClick={() => {
              const generated = generatePackageContractDocumentForUser(
                persistence,
                currentUser,
                row.pkg.contractId ?? '',
              )
              setError(generated.ok ? null : generated.error.code)
            }}
          >
            {t('openContract')}
          </Button>
        )}
      </div>

      <div className="settings-section">
        <h3>{t('implantHistory')}</h3>
        <table className="inventory-table">
          <thead>
            <tr>
              <th>{t('inventoryProduct')}</th>
              <th>{t('operation')}</th>
              <th>{t('createdAt')}</th>
            </tr>
          </thead>
          <tbody>
            {history.map((item) => (
              <tr key={item.movement.id}>
                <td>{item.productName}</td>
                <td>{item.movement.movementType}</td>
                <td>{item.movement.date.slice(0, 16)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
