import { useEffect, useMemo, useState } from 'react'
import { useAccess } from '../../context/access-context'
import { useLocalization } from '../../context/localization-context'
import { usePersistence, usePersistenceVersion } from '../../context/persistence-context'
import { useProducts } from '../../context/product-context'
import { AuthRequiredState } from '../../components/AuthRequiredState'
import { PagePlaceholder } from '../../../shared/components/PagePlaceholder'
import { Button, Input } from '../../../shared/ui'
import {
  completeInventoryAuditForUser,
  exportInventoryAuditExcelForUser,
  getInventoryAuditForUser,
  importInventoryAuditSheetForUser,
  updateInventoryAuditActualsForUser,
} from '../../../core/services'
import {
  downloadExcelFile,
  parseCsv,
  parseExcelWorkbookAsync,
  workbookToObjectUrl,
} from '../../../core/utils/excel-workbook'
import { getAuditIdFromPath } from '../app.routes'
import { useAppPath } from '../useAppPath'

export function InventoryAuditDetailPage() {
  const { t } = useLocalization()
  const { pathname, search, navigate } = useAppPath()
  const { currentUser, hasWarehouseAccess } = useAccess()
  const persistence = usePersistence()
  const version = usePersistenceVersion()
  const { products } = useProducts()
  const auditId = getAuditIdFromPath(pathname)
  const [error, setError] = useState<string | null>(null)
  const [excelHref, setExcelHref] = useState<string | null>(null)
  const [excelName, setExcelName] = useState('')

  const view = useMemo(() => {
    void version
    if (!auditId) {
      return null
    }
    const loaded = getInventoryAuditForUser(persistence, currentUser, auditId)
    return loaded.ok ? loaded.value : null
  }, [auditId, currentUser, persistence, version])

  const applyGeneratedExcel = (filename: string, bytes: Uint8Array, autoDownload: boolean) => {
    if (excelHref) {
      URL.revokeObjectURL(excelHref)
    }
    const url = URL.createObjectURL(workbookToObjectUrl(bytes))
    setExcelHref(url)
    setExcelName(filename)
    if (autoDownload) {
      downloadExcelFile(filename, bytes)
    }
  }

  useEffect(() => {
    return () => {
      if (excelHref) {
        URL.revokeObjectURL(excelHref)
      }
    }
  }, [excelHref])

  useEffect(() => {
    if (!auditId || !currentUser) {
      return
    }
    const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
    if (params.get('autoExcel') !== '1') {
      return
    }
    const exported = exportInventoryAuditExcelForUser(persistence, currentUser, auditId)
    if (exported.ok) {
      applyGeneratedExcel(exported.value.filename, exported.value.bytes, true)
    }
    navigate(`/inventory/audits/${auditId}`, { replace: true })
    // Generate once after create; subsequent search changes should not re-download.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auditId, currentUser, search])

  if (!currentUser) {
    return <AuthRequiredState />
  }
  if (!auditId || !view) {
    return (
      <PagePlaceholder title={t('AUDIT_NOT_FOUND')} description={t('AUDIT_NOT_FOUND')} />
    )
  }

  const completed = view.audit.status === 'completed'
  const canEdit = hasWarehouseAccess('audit.create') && !completed
  const canComplete = hasWarehouseAccess('audit.complete') && !completed

  return (
    <section className="workspace-page">
      <div className="workspace-toolbar">
        <h2 className="workspace-toolbar__title">{t('navInventoryAudits')}</h2>
        <Button onClick={() => navigate('/inventory/audits')}>{t('back')}</Button>
        <Button
          onClick={() => {
            const exported = exportInventoryAuditExcelForUser(
              persistence,
              currentUser,
              auditId,
            )
            if (exported.ok) {
              applyGeneratedExcel(exported.value.filename, exported.value.bytes, true)
            }
          }}
        >
          {t('exportExcel')}
        </Button>
        {excelHref ? (
          <a className="btn" href={excelHref} download={excelName}>
            {t('openAuditExcel')}
          </a>
        ) : null}
        {canEdit ? (
          <label className="btn">
            {t('importExcel')}
            <input
              type="file"
              accept=".xlsx,.csv"
              hidden
              onChange={async (event) => {
                const file = event.target.files?.[0]
                if (!file) {
                  return
                }
                const buffer = new Uint8Array(await file.arrayBuffer())
                const sheet = file.name.endsWith('.csv')
                  ? parseCsv(await file.text())
                  : (await parseExcelWorkbookAsync(buffer))[0]
                if (!sheet) {
                  setError('INVALID_INPUT')
                  return
                }
                const imported = importInventoryAuditSheetForUser(
                  persistence,
                  currentUser,
                  auditId,
                  sheet,
                )
                setError(imported.ok ? null : imported.error.code)
              }}
            />
          </label>
        ) : null}
        {canComplete ? (
          <Button
            variant="primary"
            onClick={() => {
              const done = completeInventoryAuditForUser(
                persistence,
                currentUser,
                auditId,
              )
              setError(done.ok ? null : done.error.code)
            }}
          >
            {t('completeInventoryAudit')}
          </Button>
        ) : null}
      </div>
      {error ? <p className="warehouse-field__error">{t(error as never)}</p> : null}
      <div className="inventory-table-wrap">
        <table className="inventory-table">
          <thead>
            <tr>
              <th>{t('sku')}</th>
              <th>{t('inventoryProduct')}</th>
              <th>{t('systemQuantity')}</th>
              <th>{t('actualQuantity')}</th>
              <th>{t('difference')}</th>
            </tr>
          </thead>
          <tbody>
            {view.items.map((item) => {
              const product = products.find((entry) => entry.id === item.productId)
              const difference =
                item.actualQuantity === undefined
                  ? ''
                  : item.actualQuantity - item.systemQuantity
              return (
                <tr key={item.id}>
                  <td>{product?.sku}</td>
                  <td>{product?.name}</td>
                  <td>{item.systemQuantity}</td>
                  <td>
                    {canEdit ? (
                      <Input
                        type="number"
                        min="0"
                        defaultValue={item.actualQuantity ?? ''}
                        onBlur={(event) => {
                          const value = event.target.value.trim()
                          if (value === '') {
                            return
                          }
                          updateInventoryAuditActualsForUser(
                            persistence,
                            currentUser,
                            auditId,
                            [{ productId: item.productId, actualQuantity: Number(value) }],
                          )
                        }}
                      />
                    ) : (
                      item.actualQuantity ?? ''
                    )}
                  </td>
                  <td>{difference}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
